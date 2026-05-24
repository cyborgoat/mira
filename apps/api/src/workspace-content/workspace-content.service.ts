import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, rename, stat, unlink, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { createId } from "../common/ids";
import { TaskPriority, TaskStatus } from "../common/workspace-types";
import { PrismaService } from "../prisma/prisma.service";

export type WorkspaceTask = {
  id: string;
  ownerUserId: string;
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
  ownerUserId: string;
  ownerNodeId: string;
  title: string;
  date: string;
  content: string;
  tags: string;
  createdAt: string;
  updatedAt: string;
};

type WorkspaceUser = {
  id: string;
  email: string;
  role: string | null;
  teamNodeId: string | null;
  teamNode: { id: string; name: string; title: string | null; active: boolean } | null;
};

type PersonFolder = {
  userId: string;
  nodeId: string;
  dir: string;
  name: string;
  email: string;
  role: string;
  title: string;
};

@Injectable()
export class WorkspaceContentService {
  constructor(private readonly prisma: PrismaService) {}

  async syncWorkspaceUsers() {
    const users = await this.prisma.user.findMany({
      where: { teamNodeId: { not: null }, teamNode: { active: true } },
      include: { teamNode: true },
    });
    await Promise.all(users.map((user) => this.ensurePersonFolderForUser(user.id)));
  }

  async syncUser(userId: string) {
    await this.ensurePersonFolderForUser(userId);
  }

  async syncTeamNodeUsers(nodeId: string) {
    const users = await this.prisma.user.findMany({
      where: { teamNodeId: nodeId, teamNode: { active: true } },
      select: { id: true },
    });
    await Promise.all(users.map((user) => this.ensurePersonFolderForUser(user.id)));
  }

  async listTasks(query: { nodeIds?: string[]; userIds?: string[]; query?: string; status?: TaskStatus; priority?: TaskPriority } = {}) {
    const tasks = await this.allTasks();
    const needle = query.query?.toLowerCase().trim();
    return tasks
      .filter((task) => !query.userIds || query.userIds.includes(task.ownerUserId))
      .filter((task) => !query.nodeIds || query.nodeIds.includes(task.ownerNodeId))
      .filter((task) => !query.status || task.status === query.status)
      .filter((task) => !query.priority || task.priority === query.priority)
      .filter((task) => !needle || `${task.title} ${task.details}`.toLowerCase().includes(needle))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async createTask(ownerNodeId: string, payload: { title: string; details?: string; priority?: TaskPriority; dueDate?: string | null }) {
    const folder = await this.ensurePersonFolderForNode(ownerNodeId);
    return this.createTaskInFolder(folder, payload);
  }

  async createTaskForUser(ownerUserId: string, payload: { title: string; details?: string; priority?: TaskPriority; dueDate?: string | null }) {
    const folder = await this.ensurePersonFolderForUser(ownerUserId);
    return this.createTaskInFolder(folder, payload);
  }

  async updateTask(id: string, payload: { title?: string; details?: string; status?: TaskStatus; priority?: TaskPriority; dueDate?: string | null }, ownerNodeId?: string) {
    const { folder, tasks, task } = await this.findTask(id, { ownerNodeId });
    return this.updateTaskInFolder(folder, tasks, task, payload);
  }

  async updateTaskForUser(id: string, payload: { title?: string; details?: string; status?: TaskStatus; priority?: TaskPriority; dueDate?: string | null }, ownerUserId: string) {
    const { folder, tasks, task } = await this.findTask(id, { ownerUserId });
    return this.updateTaskInFolder(folder, tasks, task, payload);
  }

  async deleteTask(id: string, ownerNodeId?: string) {
    const { folder, tasks } = await this.findTask(id, { ownerNodeId });
    await this.writeTasks(folder, tasks.filter((task) => task.id !== id));
    return { ok: true };
  }

  async deleteTaskForUser(id: string, ownerUserId: string) {
    const { folder, tasks } = await this.findTask(id, { ownerUserId });
    await this.writeTasks(folder, tasks.filter((task) => task.id !== id));
    return { ok: true };
  }

  async listNotes(query: { nodeIds?: string[]; userIds?: string[]; query?: string } = {}) {
    const notes = await this.allNotes();
    const needle = query.query?.toLowerCase().trim();
    return notes
      .filter((note) => !query.userIds || query.userIds.includes(note.ownerUserId))
      .filter((note) => !query.nodeIds || query.nodeIds.includes(note.ownerNodeId))
      .filter((note) => !needle || `${note.title} ${note.content}`.toLowerCase().includes(needle))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async createNote(ownerNodeId: string, payload: { title: string; date: string; content: string; tags?: string }) {
    const folder = await this.ensurePersonFolderForNode(ownerNodeId);
    return this.createNoteInFolder(folder, payload);
  }

  async createNoteForUser(ownerUserId: string, payload: { title: string; date: string; content: string; tags?: string }) {
    const folder = await this.ensurePersonFolderForUser(ownerUserId);
    return this.createNoteInFolder(folder, payload);
  }

  async updateNote(id: string, payload: { title?: string; date?: string; content?: string; tags?: string }, ownerNodeId?: string) {
    const found = await this.findNote(id, { ownerNodeId });
    return this.updateNoteFile(found.file, found.note, payload);
  }

  async updateNoteForUser(id: string, payload: { title?: string; date?: string; content?: string; tags?: string }, ownerUserId: string) {
    const found = await this.findNote(id, { ownerUserId });
    return this.updateNoteFile(found.file, found.note, payload);
  }

  async deleteNote(id: string, ownerNodeId?: string) {
    const found = await this.findNote(id, { ownerNodeId });
    await unlink(found.file);
    return { ok: true };
  }

  async deleteNoteForUser(id: string, ownerUserId: string) {
    const found = await this.findNote(id, { ownerUserId });
    await unlink(found.file);
    return { ok: true };
  }

  private async createTaskInFolder(folder: PersonFolder, payload: { title: string; details?: string; priority?: TaskPriority; dueDate?: string | null }) {
    const title = payload.title.trim();
    if (!title) throw new BadRequestException("Task title is required");
    const tasks = await this.tasksForFolder(folder);
    const now = new Date().toISOString();
    const task: WorkspaceTask = {
      id: createId("task"),
      ownerUserId: folder.userId,
      ownerNodeId: folder.nodeId,
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

  private async updateTaskInFolder(
    folder: PersonFolder,
    tasks: WorkspaceTask[],
    task: WorkspaceTask,
    payload: { title?: string; details?: string; status?: TaskStatus; priority?: TaskPriority; dueDate?: string | null },
  ) {
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
    await this.writeTasks(folder, tasks.map((item) => item.id === task.id ? next : item));
    return next;
  }

  private async createNoteInFolder(folder: PersonFolder, payload: { title: string; date: string; content: string; tags?: string }) {
    const title = payload.title.trim();
    if (!title) throw new BadRequestException("Note title is required");
    const notesDir = join(folder.dir, "notes");
    await mkdir(notesDir, { recursive: true });
    const id = createId("note");
    const now = new Date().toISOString();
    const note: WorkspaceNote = {
      id,
      ownerUserId: folder.userId,
      ownerNodeId: folder.nodeId,
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

  private async updateNoteFile(file: string, note: WorkspaceNote, payload: { title?: string; date?: string; content?: string; tags?: string }) {
    if (!payload.title && payload.title !== undefined) throw new BadRequestException("Note title is required");
    const title = payload.title !== undefined ? payload.title.trim() : note.title;
    const date = payload.date !== undefined ? payload.date : note.date;
    const tags = payload.tags !== undefined ? payload.tags.trim() : note.tags;
    const sourceContent = payload.content !== undefined ? payload.content : note.content;
    const content = this.composeNote(title, date, tags, sourceContent);
    await writeFile(file, content, "utf8");
    const info = await stat(file);
    return {
      ...note,
      title,
      date: new Date(date).toISOString(),
      content,
      tags,
      updatedAt: info.mtime.toISOString(),
    };
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

  private async findTask(id: string, owner?: { ownerNodeId?: string; ownerUserId?: string }) {
    const folders = await this.scopedFolders(owner);
    for (const folder of folders) {
      const tasks = await this.tasksForFolder(folder);
      const task = tasks.find((item) => item.id === id);
      if (task) return { folder, tasks, task };
    }
    throw new NotFoundException("Task not found");
  }

  private async findNote(id: string, owner?: { ownerNodeId?: string; ownerUserId?: string }) {
    const folders = await this.scopedFolders(owner);
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

  private async scopedFolders(owner?: { ownerNodeId?: string; ownerUserId?: string }) {
    if (owner?.ownerUserId) return [await this.ensurePersonFolderForUser(owner.ownerUserId)];
    if (owner?.ownerNodeId) return [await this.ensurePersonFolderForNode(owner.ownerNodeId)];
    return this.personFolders();
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
      const id = current.id || this.stableId("task", `${folder.userId}:${current.title}`);
      const status = current.status || (current.complete ? "complete" : "open");
      const createdAt = current.createdAt || info.birthtime.toISOString();
      tasks.push({
        id,
        ownerUserId: folder.userId,
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
      ownerUserId: folder.userId,
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
    const byUser = new Map<string, PersonFolder>();
    for (const folder of folders) {
      if (folder) byUser.set(folder.userId, folder);
    }
    return [...byUser.values()];
  }

  private async ensurePersonFolderForNode(nodeId: string) {
    const users = await this.prisma.user.findMany({
      where: { teamNodeId: nodeId, teamNode: { active: true } },
      orderBy: { createdAt: "asc" },
    });
    if (!users.length) throw new NotFoundException("No user is linked to this team node");
    if (users.length > 1) throw new BadRequestException("Multiple users are linked to this team node; use ownerUserId");
    return this.ensurePersonFolderForUser(users[0].id);
  }

  private async ensurePersonFolderForUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { teamNode: true },
    });
    if (!user || !user.teamNode || !user.teamNode.active) throw new NotFoundException("Workspace user not found");

    const dir = await this.canonicalPersonDir(user);
    await mkdir(join(dir, "notes"), { recursive: true });
    if (!existsSync(join(dir, "tasks.md"))) await writeFile(join(dir, "tasks.md"), `# ${user.teamNode.name} Tasks\n`, "utf8");
    await this.writePersonFile(dir, user);
    return this.folderFromUser(user, dir);
  }

  private async canonicalPersonDir(user: WorkspaceUser) {
    const peopleDir = this.peopleDir();
    await mkdir(peopleDir, { recursive: true });
    const canonical = join(peopleDir, user.id);
    if (existsSync(canonical)) return canonical;

    const legacy = await this.findLegacyPersonDir(user);
    if (legacy && legacy !== canonical) {
      await rename(legacy, canonical);
      return canonical;
    }

    return canonical;
  }

  private async findLegacyPersonDir(user: WorkspaceUser) {
    const peopleDir = this.peopleDir();
    const entries = await readdir(peopleDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name === user.id) continue;
      const dir = join(peopleDir, entry.name);
      const personFile = join(dir, "person.md");
      if (!existsSync(personFile)) continue;
      const content = await readFile(personFile, "utf8");
      const userId = this.codeMetadata(content, "User id") || this.codeMetadata(content, "User");
      const email = this.codeMetadata(content, "Email") || this.codeMetadata(content, "User");
      const nodeId = this.codeMetadata(content, "Team node id") || this.codeMetadata(content, "Node id");
      if (userId === user.id || email.toLowerCase() === user.email.toLowerCase() || nodeId === user.teamNodeId) return dir;
    }
    return null;
  }

  private async personFolderFromDir(dir: string): Promise<PersonFolder | null> {
    const personFile = join(dir, "person.md");
    if (!existsSync(personFile)) return null;
    const content = await readFile(personFile, "utf8");
    const userId = this.codeMetadata(content, "User id");
    const email = this.codeMetadata(content, "Email") || this.codeMetadata(content, "User");
    const nodeId = this.codeMetadata(content, "Team node id") || this.codeMetadata(content, "Node id");

    const user = userId
      ? await this.prisma.user.findUnique({ where: { id: userId }, include: { teamNode: true } })
      : email
        ? await this.prisma.user.findUnique({ where: { email: email.toLowerCase() }, include: { teamNode: true } })
        : nodeId
          ? await this.prisma.user.findFirst({ where: { teamNodeId: nodeId, teamNode: { active: true } }, include: { teamNode: true } })
          : null;
    if (!user || !user.teamNode || !user.teamNode.active) return null;

    const canonical = await this.canonicalPersonDir(user);
    if (dir !== canonical) return this.ensurePersonFolderForUser(user.id);
    await this.writePersonFile(canonical, user);
    return this.folderFromUser(user, canonical);
  }

  private folderFromUser(user: WorkspaceUser, dir: string): PersonFolder {
    return {
      userId: user.id,
      nodeId: user.teamNodeId!,
      dir,
      name: user.teamNode?.name || user.email,
      email: user.email,
      role: user.role || "",
      title: user.teamNode?.title || "",
    };
  }

  private async writePersonFile(dir: string, user: WorkspaceUser) {
    await writeFile(join(dir, "person.md"), [
      `# ${user.teamNode?.name || user.email}`,
      "",
      `User id: \`${user.id}\``,
      `Email: \`${user.email}\``,
      `Role: ${user.role || ""}`,
      `Team node id: \`${user.teamNodeId || ""}\``,
      `Team title: ${user.teamNode?.title || ""}`,
      "",
      `This folder owns ${user.teamNode?.name || user.email}'s tasks and notes.`,
      "",
    ].join("\n"), "utf8");
  }

  private peopleDir() {
    return join(this.workspaceRoot(), "people");
  }

  private workspaceRoot() {
    return resolve(process.env.MIRA_WORKSPACE_ROOT || join(this.dataDir(), "workspace"));
  }

  private dataDir() {
    const candidates = [
      resolve(process.cwd(), "../../mira-workspace"),
      resolve(process.cwd(), "mira-workspace"),
      resolve(__dirname, "../../../../mira-workspace"),
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

  private codeMetadata(content: string, key: string) {
    const value = this.markdownMetadata(content, key);
    return value.replace(/^`|`$/g, "").trim();
  }

  private stableId(prefix: string, value: string) {
    return `${prefix}_${createHash("sha1").update(value).digest("hex").slice(0, 12)}`;
  }

  private isTaskPriority(value: string): value is TaskPriority {
    return ["low", "normal", "high", "urgent"].includes(value);
  }
}
