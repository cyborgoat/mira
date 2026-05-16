import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, stat, unlink, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { createId } from "../common/ids";
import { TaskPriority, TaskStatus } from "../common/workspace-types";
import { PrismaService } from "../prisma/prisma.service";

export type WorkspaceTask = {
  id: string;
  ownerNodeId: string;
  title: string;
  details: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string | null;
  createdAt: string;
  completedAt: string | null;
  updatedAt: string;
};

export type WorkspaceNote = {
  id: string;
  ownerNodeId: string;
  title: string;
  date: string;
  content: string;
  tags: string;
  createdAt: string;
  updatedAt: string;
};

type PersonFolder = {
  nodeId: string;
  dir: string;
  name: string;
  title: string;
};

@Injectable()
export class WorkspaceContentService {
  constructor(private readonly prisma: PrismaService) {}

  async listTasks(query: { nodeIds?: string[]; query?: string; status?: TaskStatus; priority?: TaskPriority } = {}) {
    const tasks = await this.allTasks();
    const needle = query.query?.toLowerCase().trim();
    return tasks
      .filter((task) => !query.nodeIds || query.nodeIds.includes(task.ownerNodeId))
      .filter((task) => !query.status || task.status === query.status)
      .filter((task) => !query.priority || task.priority === query.priority)
      .filter((task) => !needle || `${task.title} ${task.details}`.toLowerCase().includes(needle))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async createTask(ownerNodeId: string, payload: { title: string; details?: string; priority?: TaskPriority; dueDate?: string | null }) {
    const title = payload.title.trim();
    if (!title) throw new BadRequestException("Task title is required");
    const folder = await this.ensurePersonFolder(ownerNodeId);
    const tasks = await this.tasksForFolder(folder);
    const now = new Date().toISOString();
    const task: WorkspaceTask = {
      id: createId("task"),
      ownerNodeId,
      title,
      details: payload.details?.trim() || "",
      status: "open",
      priority: payload.priority || "normal",
      dueDate: payload.dueDate ? new Date(payload.dueDate).toISOString() : null,
      createdAt: now,
      completedAt: null,
      updatedAt: now,
    };
    await this.writeTasks(folder, [...tasks, task]);
    return task;
  }

  async updateTask(id: string, payload: { title?: string; details?: string; status?: TaskStatus; priority?: TaskPriority; dueDate?: string | null }, ownerNodeId?: string) {
    const { folder, tasks, task } = await this.findTask(id, ownerNodeId);
    const now = new Date().toISOString();
    if (!payload.title && payload.title !== undefined) throw new BadRequestException("Task title is required");
    const next: WorkspaceTask = {
      ...task,
      title: payload.title !== undefined ? payload.title.trim() : task.title,
      details: payload.details !== undefined ? payload.details.trim() : task.details,
      priority: payload.priority !== undefined ? payload.priority : task.priority,
      dueDate: payload.dueDate !== undefined ? (payload.dueDate ? new Date(payload.dueDate).toISOString() : null) : task.dueDate,
      status: payload.status !== undefined ? payload.status : task.status,
      completedAt: payload.status === "complete" ? (task.completedAt || now) : payload.status === "open" ? null : task.completedAt,
      updatedAt: now,
    };
    await this.writeTasks(folder, tasks.map((item) => item.id === id ? next : item));
    return next;
  }

  async deleteTask(id: string, ownerNodeId?: string) {
    const { folder, tasks } = await this.findTask(id, ownerNodeId);
    await this.writeTasks(folder, tasks.filter((task) => task.id !== id));
    return { ok: true };
  }

  async listNotes(query: { nodeIds?: string[]; query?: string } = {}) {
    const notes = await this.allNotes();
    const needle = query.query?.toLowerCase().trim();
    return notes
      .filter((note) => !query.nodeIds || query.nodeIds.includes(note.ownerNodeId))
      .filter((note) => !needle || `${note.title} ${note.content}`.toLowerCase().includes(needle))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async createNote(ownerNodeId: string, payload: { title: string; date: string; content: string; tags?: string }) {
    const title = payload.title.trim();
    if (!title) throw new BadRequestException("Note title is required");
    const folder = await this.ensurePersonFolder(ownerNodeId);
    const notesDir = join(folder.dir, "notes");
    await mkdir(notesDir, { recursive: true });
    const id = createId("note");
    const now = new Date().toISOString();
    const note: WorkspaceNote = {
      id,
      ownerNodeId,
      title,
      date: new Date(payload.date).toISOString(),
      content: this.composeNote(title, payload.date, payload.tags || "", payload.content),
      tags: payload.tags?.trim() || "",
      createdAt: now,
      updatedAt: now,
    };
    await writeFile(join(notesDir, `${id}.md`), note.content, "utf8");
    return note;
  }

  async updateNote(id: string, payload: { title?: string; date?: string; content?: string; tags?: string }, ownerNodeId?: string) {
    const found = await this.findNote(id, ownerNodeId);
    if (!payload.title && payload.title !== undefined) throw new BadRequestException("Note title is required");
    const title = payload.title !== undefined ? payload.title.trim() : found.note.title;
    const date = payload.date !== undefined ? payload.date : found.note.date;
    const tags = payload.tags !== undefined ? payload.tags.trim() : found.note.tags;
    const sourceContent = payload.content !== undefined ? payload.content : found.note.content;
    const content = this.composeNote(title, date, tags, sourceContent);
    await writeFile(found.file, content, "utf8");
    const info = await stat(found.file);
    return {
      ...found.note,
      title,
      date: new Date(date).toISOString(),
      content,
      tags,
      updatedAt: info.mtime.toISOString(),
    };
  }

  async deleteNote(id: string, ownerNodeId?: string) {
    const found = await this.findNote(id, ownerNodeId);
    await unlink(found.file);
    return { ok: true };
  }

  private async allTasks() {
    const folders = await this.personFolders();
    const nested = await Promise.all(folders.map((folder) => this.tasksForFolder(folder)));
    return nested.flat();
  }

  private async allNotes() {
    const folders = await this.personFolders();
    const nested = await Promise.all(folders.map((folder) => this.notesForFolder(folder)));
    return nested.flat();
  }

  private async findTask(id: string, ownerNodeId?: string) {
    const folders = ownerNodeId ? [await this.ensurePersonFolder(ownerNodeId)] : await this.personFolders();
    for (const folder of folders) {
      const tasks = await this.tasksForFolder(folder);
      const task = tasks.find((item) => item.id === id);
      if (task) return { folder, tasks, task };
    }
    throw new NotFoundException("Task not found");
  }

  private async findNote(id: string, ownerNodeId?: string) {
    const folders = ownerNodeId ? [await this.ensurePersonFolder(ownerNodeId)] : await this.personFolders();
    for (const folder of folders) {
      const notesDir = join(folder.dir, "notes");
      if (!existsSync(notesDir)) continue;
      for (const file of await readdir(notesDir)) {
        if (!file.endsWith(".md")) continue;
        const noteId = basename(file, ".md");
        if (noteId !== id) continue;
        const fullPath = join(notesDir, file);
        const note = await this.noteFromFile(folder, fullPath);
        return { folder, file: fullPath, note };
      }
    }
    throw new NotFoundException("Note not found");
  }

  private async tasksForFolder(folder: PersonFolder) {
    const file = join(folder.dir, "tasks.md");
    if (!existsSync(file)) {
      await writeFile(file, `# ${folder.name} Tasks\n`, "utf8");
      return [];
    }
    const content = await readFile(file, "utf8");
    const info = await stat(file);
    const tasks: WorkspaceTask[] = [];
    let current: Partial<WorkspaceTask> & { complete?: boolean } | null = null;
    const push = () => {
      if (!current?.title) return;
      const id = current.id || this.stableId("task", `${folder.nodeId}:${current.title}`);
      const status = current.status || (current.complete ? "complete" : "open");
      const createdAt = current.createdAt || info.birthtime.toISOString();
      tasks.push({
        id,
        ownerNodeId: folder.nodeId,
        title: current.title,
        details: current.details || "",
        status,
        priority: current.priority || "normal",
        dueDate: current.dueDate || null,
        createdAt,
        completedAt: status === "complete" ? (current.completedAt || current.updatedAt || info.mtime.toISOString()) : null,
        updatedAt: current.updatedAt || info.mtime.toISOString(),
      });
      current = null;
    };

    for (const line of content.split(/\r?\n/)) {
      const task = line.match(/^-\s+\[([ xX])]\s+(.+)$/);
      if (task) {
        push();
        current = { title: task[2].trim(), complete: task[1].toLowerCase() === "x" };
        continue;
      }
      if (!current) continue;
      const property = line.match(/^\s+-\s+([^:]+):\s*(.*)$/);
      if (!property) continue;
      const key = property[1].trim().toLowerCase();
      const value = property[2].trim();
      if (key === "id") current.id = value;
      if (key === "priority" && this.isTaskPriority(value)) current.priority = value;
      if (key === "details") current.details = value;
      if (key === "due") current.dueDate = value ? new Date(value).toISOString() : null;
      if (key === "created") current.createdAt = new Date(value).toISOString();
      if (key === "updated") current.updatedAt = new Date(value).toISOString();
      if (key === "completed") current.completedAt = value ? new Date(value).toISOString() : null;
    }
    push();
    return tasks;
  }

  private async writeTasks(folder: PersonFolder, tasks: WorkspaceTask[]) {
    const lines = [`# ${folder.name} Tasks`, ""];
    for (const task of tasks) {
      lines.push(`- [${task.status === "complete" ? "x" : " "}] ${task.title}`);
      lines.push(`  - Id: ${task.id}`);
      lines.push(`  - Priority: ${task.priority}`);
      lines.push(`  - Details: ${task.details}`);
      if (task.dueDate) lines.push(`  - Due: ${task.dueDate.slice(0, 10)}`);
      lines.push(`  - Created: ${task.createdAt}`);
      lines.push(`  - Updated: ${task.updatedAt}`);
      if (task.completedAt) lines.push(`  - Completed: ${task.completedAt}`);
      lines.push("");
    }
    await writeFile(join(folder.dir, "tasks.md"), lines.join("\n"), "utf8");
  }

  private async notesForFolder(folder: PersonFolder) {
    const notesDir = join(folder.dir, "notes");
    if (!existsSync(notesDir)) return [];
    const files = (await readdir(notesDir)).filter((file) => file.endsWith(".md")).sort();
    return Promise.all(files.map((file) => this.noteFromFile(folder, join(notesDir, file))));
  }

  private async noteFromFile(folder: PersonFolder, file: string): Promise<WorkspaceNote> {
    const content = await readFile(file, "utf8");
    const info = await stat(file);
    const date = this.markdownMetadata(content, "Date");
    return {
      id: basename(file, ".md"),
      ownerNodeId: folder.nodeId,
      title: this.markdownTitle(content) || basename(file, ".md").replace(/[-_]+/g, " "),
      date: date ? new Date(date).toISOString() : info.mtime.toISOString(),
      content,
      tags: this.markdownMetadata(content, "Tags").replace(/\s*,\s*/g, ","),
      createdAt: info.birthtime.toISOString(),
      updatedAt: info.mtime.toISOString(),
    };
  }

  private composeNote(title: string, date: string, tags: string, content: string) {
    const body = this.noteBody(content);
    return [`# ${title}`, "", `Date: ${new Date(date).toISOString().slice(0, 10)}`, `Tags: ${tags}`, "", body].join("\n").trimEnd() + "\n";
  }

  private noteBody(content: string) {
    const lines = content.split(/\r?\n/);
    let index = 0;
    if (lines[index]?.startsWith("# ")) index += 1;
    while (index < lines.length && !lines[index].trim()) index += 1;
    while (/^(Date|Tags):/i.test(lines[index] || "")) index += 1;
    while (index < lines.length && !lines[index].trim()) index += 1;
    return lines.slice(index).join("\n").trimEnd();
  }

  private async personFolders(): Promise<PersonFolder[]> {
    const peopleDir = this.peopleDir();
    await mkdir(peopleDir, { recursive: true });
    const entries = await readdir(peopleDir, { withFileTypes: true });
    const folders = await Promise.all(entries.filter((entry) => entry.isDirectory()).map((entry) => this.personFolderFromDir(join(peopleDir, entry.name))));
    return folders.filter((folder): folder is PersonFolder => Boolean(folder));
  }

  private async ensurePersonFolder(nodeId: string) {
    const existing = (await this.personFolders()).find((folder) => folder.nodeId === nodeId);
    if (existing) return existing;
    const node = await this.prisma.teamNode.findFirst({ where: { id: nodeId, active: true } });
    if (!node) throw new NotFoundException("Team node not found");
    const dir = await this.uniquePersonDir(node.name, node.id);
    await mkdir(join(dir, "notes"), { recursive: true });
    await writeFile(join(dir, "person.md"), [
      `# ${node.name}`,
      "",
      `Node id: \`${node.id}\``,
      `Team title: ${node.title || ""}`,
      "",
      `This folder owns ${node.name}'s tasks and notes.`,
      "",
    ].join("\n"), "utf8");
    await writeFile(join(dir, "tasks.md"), `# ${node.name} Tasks\n`, "utf8");
    return { nodeId: node.id, dir, name: node.name, title: node.title || "" };
  }

  private async personFolderFromDir(dir: string): Promise<PersonFolder | null> {
    const personFile = join(dir, "person.md");
    if (!existsSync(personFile)) return null;
    const content = await readFile(personFile, "utf8");
    const nodeId = content.match(/Node id:\s*`([^`]+)`/)?.[1]?.trim();
    if (!nodeId) return null;
    return {
      nodeId,
      dir,
      name: this.markdownTitle(content) || basename(dir),
      title: this.markdownMetadata(content, "Team title"),
    };
  }

  private async uniquePersonDir(name: string, nodeId: string) {
    const peopleDir = this.peopleDir();
    const base = this.slugify(name) || "person";
    const first = join(peopleDir, base);
    if (!existsSync(first)) return first;
    return join(peopleDir, `${base}-${nodeId.slice(-6)}`);
  }

  private peopleDir() {
    return join(this.workspaceRoot(), "people");
  }

  private workspaceRoot() {
    return resolve(process.env.MIRA_WORKSPACE_ROOT || join(this.dataDir(), "workspace"));
  }

  private dataDir() {
    const candidates = [
      resolve(__dirname, "../../data"),
      resolve(process.cwd(), "apps/api/data"),
      resolve(process.cwd(), "data"),
    ];
    return candidates.find((path) => existsSync(path)) || candidates[0];
  }

  private markdownTitle(content: string) {
    return content.split(/\r?\n/).find((line) => line.startsWith("# "))?.replace(/^#\s+/, "").trim() || "";
  }

  private markdownMetadata(content: string, key: string) {
    const line = content.split(/\r?\n/).find((item) => item.toLowerCase().startsWith(`${key.toLowerCase()}:`));
    return line?.slice(line.indexOf(":") + 1).trim() || "";
  }

  private stableId(prefix: string, value: string) {
    return `${prefix}_${createHash("sha1").update(value).digest("hex").slice(0, 12)}`;
  }

  private slugify(value: string) {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  }

  private isTaskPriority(value: string): value is TaskPriority {
    return ["low", "normal", "high", "urgent"].includes(value);
  }
}
