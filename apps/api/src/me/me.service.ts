import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Prisma } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { AiService, LlmWikiOwner, LlmWikiReferenceStats } from "../ai/ai.service";
import { AuthUser } from "../auth/current-user";
import { periodStart, Period } from "../common/period";
import { TaskPriority, TaskStatus } from "../common/workspace-types";
import { CreateNoteDto, UpdateNoteDto } from "../notes/dto/note.dto";
import { PrismaService } from "../prisma/prisma.service";
import { CreateTaskDto, UpdateTaskDto } from "../tasks/dto/task.dto";
import { UsersService } from "../users/users.service";
import { WorkspaceContentService } from "../workspace-content/workspace-content.service";
import { UpdatePasswordDto, UpdateProfileDto } from "./dto/account.dto";
import { GenerateLlmWikiDto, IngestLlmWikiSourceDto, LintLlmWikiDto, LlmWikiScope, LlmWikiViewMode, QueryLlmWikiDto, UpdateLlmWikiPageDto, UploadLlmWikiSourceDto } from "./dto/llm-wiki.dto";

@Injectable()
export class MeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly config: ConfigService,
    private readonly ai: AiService,
    private readonly content: WorkspaceContentService,
  ) {}

  async personalWork(user: AuthUser, filters: { period: Period; query?: string; status?: TaskStatus; priority?: TaskPriority }) {
    const ownerNodeId = this.requireOwnNode(user);
    const [selectedNode, tasks, notes] = await Promise.all([
      this.prisma.teamNode.findUnique({ where: { id: ownerNodeId } }),
      this.content.listTasks({ nodeIds: [ownerNodeId], query: filters.query, status: filters.status, priority: filters.priority }),
      this.content.listNotes({ nodeIds: [ownerNodeId] }),
    ]);
    return this.viewPayload(selectedNode, [ownerNodeId], this.filterByPeriod(tasks, notes, filters.period));
  }

  async teamView(user: AuthUser, period: Period, nodeId?: string) {
    const ownerNodeId = this.requireOwnNode(user);
    const rootId = nodeId || ownerNodeId;
    const allowedIds = user.isSuperuser ? await this.activeNodeIds() : [ownerNodeId, ...(await this.descendantIds(ownerNodeId))];
    if (!allowedIds.includes(rootId)) throw new ForbiddenException("Team view is limited to your subtree");

    const visibleRootIds = rootId === ownerNodeId && !user.isSuperuser ? await this.descendantIds(rootId) : [rootId, ...(await this.descendantIds(rootId))];
    const descendantIds = visibleRootIds.filter((id) => allowedIds.includes(id));
    if (descendantIds.length <= 1 && !user.isSuperuser) throw new ForbiddenException("No subordinate team view is available");

    const [selectedNode, tasks, notes] = await Promise.all([
      this.prisma.teamNode.findUnique({ where: { id: rootId } }),
      this.content.listTasks({ nodeIds: descendantIds }),
      this.content.listNotes({ nodeIds: descendantIds }),
    ]);
    return this.viewPayload(selectedNode, descendantIds, this.filterByPeriod(tasks, notes, period));
  }

  async updateProfile(user: AuthUser, payload: UpdateProfileDto) {
    const data: Prisma.UserUpdateInput = {};
    if (payload.email !== undefined) {
      const email = payload.email.toLowerCase().trim();
      const existing = await this.prisma.user.findUnique({ where: { email } });
      if (existing && existing.id !== user.id) throw new ConflictException("Email is already in use");
      data.email = email;
    }
    if (payload.role !== undefined) data.role = payload.role?.trim() || null;

    if (Object.keys(data).length) await this.prisma.user.update({ where: { id: user.id }, data });
    if (payload.name !== undefined) {
      const name = payload.name.trim();
      if (!name) throw new BadRequestException("Name is required");
      const ownerNodeId = this.requireOwnNode(user);
      await this.prisma.teamNode.update({ where: { id: ownerNodeId }, data: { name } });
    }

    const updated = await this.users.findById(user.id);
    if (!updated) throw new NotFoundException("User not found");
    return this.users.toPublicUser(updated);
  }

  async updatePassword(user: AuthUser, payload: UpdatePasswordDto) {
    const current = await this.prisma.user.findUnique({ where: { id: user.id } });
    if (!current) throw new NotFoundException("User not found");
    const matches = await bcrypt.compare(payload.currentPassword, current.passwordHash);
    if (!matches) throw new ForbiddenException("Current password is incorrect");
    const rounds = Number(this.config.get<string>("MIRA_BCRYPT_ROUNDS", "12")) || 12;
    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await bcrypt.hash(payload.newPassword, rounds) },
    });
    return { ok: true };
  }

  async llmWikiOverview(user: AuthUser, options: { ownerId?: string; view?: LlmWikiViewMode; scope?: LlmWikiScope }) {
    const target = await this.resolveWikiTarget(user, options);
    const overview = await this.ai.wikiOverview(target.vaultId);
    const referenceStats = await this.referenceStats(target.nodeIds, overview.pages.length, overview.sources.length);
    return {
      ...overview,
      owner: target.publicOwner,
      referenceStats,
    };
  }

  async llmWikiOwners(user: AuthUser) {
    const ownerNodeId = this.requireOwnNode(user);
    const allowedNodeIds = user.isSuperuser ? await this.activeNodeIds() : [ownerNodeId, ...(await this.descendantIds(ownerNodeId))];
    const owners = await this.prisma.user.findMany({
      where: { teamNodeId: { in: allowedNodeIds } },
      include: { teamNode: true },
      orderBy: { email: "asc" },
    });
    return owners
      .sort((a, b) => (a.teamNode?.sortOrder ?? 0) - (b.teamNode?.sortOrder ?? 0) || a.email.localeCompare(b.email))
      .map((owner) => this.publicWikiOwner(owner, owner.id === user.id));
  }

  uploadLlmWikiSource(user: AuthUser, payload: UploadLlmWikiSourceDto) {
    return this.ai.uploadWikiSource(this.editableWikiVaultId(user, payload.view), payload);
  }

  ingestLlmWikiSource(user: AuthUser, payload: IngestLlmWikiSourceDto) {
    return this.ai.ingestWikiSource(this.editableWikiVaultId(user, payload.view), payload);
  }

  async llmWikiReferenceStats(
    user: AuthUser,
    period: GenerateLlmWikiDto["period"],
    scope: NonNullable<GenerateLlmWikiDto["scope"]>,
    ownerId?: string,
  ) {
    if (!["daily", "weekly", "monthly", "historical"].includes(period)) throw new BadRequestException("Invalid wiki period");
    if (!["personal", "team"].includes(scope)) throw new BadRequestException("Invalid wiki scope");
    const target = await this.resolveWikiTarget(user, { view: scope === "team" ? "team" : "personal", scope, ownerId });
    const [overview, tasks, notes] = await Promise.all([
      this.ai.wikiOverview(target.vaultId),
      this.content.listTasks({ nodeIds: target.nodeIds }),
      this.content.listNotes({ nodeIds: target.nodeIds }),
    ]);
    const filtered = this.filterWikiPeriod(tasks, notes, period);
    return {
      wikiPages: overview.pages.length,
      tasks: filtered.tasks.length,
      meetingNotes: filtered.notes.length,
      resources: overview.sources.length,
    };
  }

  async generateLlmWiki(user: AuthUser, payload: GenerateLlmWikiDto) {
    const ownerNodeId = this.requireOwnNode(user);
    const scope = payload.scope || "personal";
    const nodeIds = scope === "team" ? [ownerNodeId, ...(await this.descendantIds(ownerNodeId))] : [ownerNodeId];
    if (scope === "team" && nodeIds.length <= 1 && !user.isSuperuser) throw new ForbiddenException("No subordinate team view is available");
    const [node, tasks, notes] = await Promise.all([
      this.prisma.teamNode.findUnique({ where: { id: ownerNodeId } }),
      this.content.listTasks({ nodeIds }),
      this.content.listNotes({ nodeIds }),
    ]);
    const filtered = this.filterWikiPeriod(tasks, notes, payload.period);
    const result = await this.ai.ingestWikiContent(this.editableWikiVaultId(user, scope === "team" ? "team" : "personal"), {
      language: payload.language,
      sourceName: `workspace-${scope}-${payload.period}`,
      content: this.workspaceWikiSource(payload.period, scope, node?.name || user.email, filtered),
    });
    return {
      ...result,
      referenceStats: {
        wikiPages: result.writtenPages.filter((path) => path.startsWith("pages/")).length,
        tasks: filtered.tasks.length,
        meetingNotes: filtered.notes.length,
        resources: 0,
      },
    };
  }

  async queryLlmWiki(user: AuthUser, payload: QueryLlmWikiDto) {
    const target = await this.resolveWikiTarget(user, payload);
    return this.ai.queryWiki(target.vaultId, { ...payload, saveAsPage: target.canEdit && payload.saveAsPage });
  }

  lintLlmWiki(user: AuthUser, payload: LintLlmWikiDto) {
    return this.ai.lintWiki(this.editableWikiVaultId(user, payload.view), payload);
  }

  async readLlmWikiPage(user: AuthUser, pagePath: string, options: { ownerId?: string; view?: LlmWikiViewMode; scope?: LlmWikiScope }) {
    const target = await this.resolveWikiTarget(user, options);
    return this.ai.readWikiPage(target.vaultId, pagePath);
  }

  updateLlmWikiPage(user: AuthUser, payload: UpdateLlmWikiPageDto) {
    return this.ai.updateWikiPage(this.editableWikiVaultId(user, payload.view), payload);
  }

  deleteLlmWikiPage(user: AuthUser, pagePath: string, view?: LlmWikiViewMode) {
    return this.ai.deleteWikiPage(this.editableWikiVaultId(user, view), pagePath);
  }

  async createTask(user: AuthUser, payload: Omit<CreateTaskDto, "ownerNodeId">) {
    const ownerNodeId = this.requireOwnNode(user);
    return this.content.createTask(ownerNodeId, payload);
  }

  async updateTask(user: AuthUser, id: string, payload: UpdateTaskDto) {
    return this.content.updateTask(id, payload, this.requireOwnNode(user));
  }

  async deleteTask(user: AuthUser, id: string) {
    return this.content.deleteTask(id, this.requireOwnNode(user));
  }

  async createNote(user: AuthUser, payload: Omit<CreateNoteDto, "ownerNodeId">) {
    const ownerNodeId = this.requireOwnNode(user);
    return this.content.createNote(ownerNodeId, payload);
  }

  async updateNote(user: AuthUser, id: string, payload: UpdateNoteDto) {
    return this.content.updateNote(id, payload, this.requireOwnNode(user));
  }

  async deleteNote(user: AuthUser, id: string) {
    return this.content.deleteNote(id, this.requireOwnNode(user));
  }

  private viewPayload(selectedNode: unknown, descendantIds: string[], data: { tasks: Array<{ status: TaskStatus }>; notes: unknown[] }) {
    const completedTasks = data.tasks.filter((task) => task.status === "complete").length;
    return {
      selectedNode,
      descendantIds,
      tasks: data.tasks,
      notes: data.notes,
      stats: {
        totalTasks: data.tasks.length,
        completedTasks,
        openTasks: data.tasks.length - completedTasks,
        notes: data.notes.length,
        completionRate: data.tasks.length ? Math.round((completedTasks / data.tasks.length) * 100) : 0,
      },
    };
  }

  private filterByPeriod<TTask, TNote>(tasks: TTask[], notes: TNote[], period: Period) {
    const start = periodStart(period);
    return {
      tasks: tasks.filter((task) => {
        const value = task as { createdAt: Date | string; completedAt: Date | string | null };
        const createdAt = value.createdAt instanceof Date ? value.createdAt : new Date(value.createdAt);
        const completedAt = value.completedAt ? (value.completedAt instanceof Date ? value.completedAt : new Date(value.completedAt)) : null;
        return createdAt >= start || Boolean(completedAt && completedAt >= start);
      }),
      notes: notes.filter((note) => {
        const date = (note as { date: Date | string }).date;
        return (date instanceof Date ? date : new Date(date)) >= start;
      }),
    };
  }

  private filterWikiPeriod<TTask, TNote>(tasks: TTask[], notes: TNote[], period: GenerateLlmWikiDto["period"]) {
    if (period === "historical") return { tasks, notes };
    return this.filterByPeriod(tasks, notes, period);
  }

  private workspaceWikiSource(
    period: GenerateLlmWikiDto["period"],
    scope: NonNullable<GenerateLlmWikiDto["scope"]>,
    ownerName: string,
    data: { tasks: unknown[]; notes: unknown[] },
  ) {
    const taskLines = data.tasks.map((task) => {
      const item = task as { title: string; details: string; status: string; priority: string; dueDate: string | null; updatedAt: string };
      return [
        `- ${item.title}`,
        `  - Status: ${item.status}`,
        `  - Priority: ${item.priority}`,
        item.dueDate ? `  - Due: ${item.dueDate.slice(0, 10)}` : "",
        item.details ? `  - Details: ${item.details}` : "",
        `  - Updated: ${item.updatedAt}`,
      ].filter(Boolean).join("\n");
    });
    const noteLines = data.notes.map((note) => {
      const item = note as { title: string; date: string; tags: string; content: string };
      return [
        `## ${item.title}`,
        `Date: ${item.date.slice(0, 10)}`,
        item.tags ? `Tags: ${item.tags}` : "",
        "",
        item.content,
      ].filter(Boolean).join("\n");
    });
    return [
      `# Workspace Source: ${ownerName}`,
      "",
      `Period: ${period}`,
      `Scope: ${scope}`,
      `Generated at: ${new Date().toISOString()}`,
      "",
      "## Tasks",
      taskLines.length ? taskLines.join("\n\n") : "No tasks in this period.",
      "",
      "## Notes",
      noteLines.length ? noteLines.join("\n\n") : "No notes in this period.",
    ].join("\n");
  }

  private requireOwnNode(user: AuthUser) {
    if (!user.teamNodeId) throw new ForbiddenException("Your account is not linked to a team node");
    return user.teamNodeId;
  }

  private editableWikiVaultId(user: AuthUser, view?: LlmWikiViewMode) {
    if (view === "team") {
      this.requireOwnNode(user);
      return this.teamWikiVaultId(user.id);
    }
    return user.id;
  }

  private async resolveWikiTarget(
    user: AuthUser,
    options: { ownerId?: string; view?: LlmWikiViewMode; scope?: LlmWikiScope },
  ): Promise<{ vaultId: string; publicOwner: LlmWikiOwner; nodeIds: string[]; canEdit: boolean }> {
    const ownerNodeId = this.requireOwnNode(user);
    if (options.view !== "team") {
      const owner = await this.prisma.user.findUnique({ where: { id: user.id }, include: { teamNode: true } });
      if (!owner) throw new NotFoundException("Wiki owner not found");
      return {
        vaultId: owner.id,
        publicOwner: this.publicWikiOwner(owner, true),
        nodeIds: owner.teamNodeId ? [owner.teamNodeId] : [],
        canEdit: true,
      };
    }

    const allowedNodeIds = user.isSuperuser ? await this.activeNodeIds() : [ownerNodeId, ...(await this.descendantIds(ownerNodeId))];
    if (allowedNodeIds.length <= 1 && !user.isSuperuser) throw new ForbiddenException("No subordinate team view is available");

    if (options.scope === "team") {
      const node = await this.prisma.teamNode.findUnique({ where: { id: ownerNodeId } });
      return {
        vaultId: this.teamWikiVaultId(user.id),
        publicOwner: {
          id: `team:${user.id}`,
          name: `${node?.name || user.email} team`,
          title: "Team scope",
          email: user.email,
          teamNodeId: ownerNodeId,
          canEdit: true,
        },
        nodeIds: allowedNodeIds,
        canEdit: true,
      };
    }

    const targetId = options.ownerId || user.id;
    const owner = await this.prisma.user.findUnique({ where: { id: targetId }, include: { teamNode: true } });
    if (!owner) throw new NotFoundException("Wiki owner not found");
    if (!owner.teamNodeId || !allowedNodeIds.includes(owner.teamNodeId)) throw new ForbiddenException("Wiki owner is outside your team view");
    return {
      vaultId: owner.id,
      publicOwner: this.publicWikiOwner(owner, false),
      nodeIds: owner.teamNodeId ? [owner.teamNodeId] : [],
      canEdit: false,
    };
  }

  private teamWikiVaultId(userId: string) {
    return `${userId}__team`;
  }

  private publicWikiOwner(
    owner: Prisma.UserGetPayload<{ include: { teamNode: true } }>,
    canEdit: boolean,
  ): LlmWikiOwner {
    return {
      id: owner.id,
      name: owner.teamNode?.name || owner.email,
      title: owner.teamNode?.title || owner.role || null,
      email: owner.email,
      teamNodeId: owner.teamNodeId,
      canEdit,
    };
  }

  private async referenceStats(nodeIds: string[], wikiPages: number, resources: number): Promise<LlmWikiReferenceStats> {
    if (!nodeIds.length) return { wikiPages, tasks: 0, meetingNotes: 0, resources };
    const [tasks, notes] = await Promise.all([
      this.content.listTasks({ nodeIds }),
      this.content.listNotes({ nodeIds }),
    ]);
    return { wikiPages, tasks: tasks.length, meetingNotes: notes.length, resources };
  }

  private async activeNodeIds() {
    const nodes = await this.prisma.teamNode.findMany({ where: { active: true }, select: { id: true } });
    return nodes.map((node) => node.id);
  }

  private async descendantIds(rootId: string) {
    const nodes = await this.prisma.teamNode.findMany({ where: { active: true }, select: { id: true, parentId: true } });
    const byParent = new Map<string, string[]>();
    for (const node of nodes) {
      if (!node.parentId) continue;
      byParent.set(node.parentId, [...(byParent.get(node.parentId) || []), node.id]);
    }
    const result: string[] = [];
    const queue = [...(byParent.get(rootId) || [])];
    while (queue.length) {
      const id = queue.shift()!;
      result.push(id);
      queue.push(...(byParent.get(id) || []));
    }
    return result;
  }
}
