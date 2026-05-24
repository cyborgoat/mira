import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
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
import { AskMiraDto, AskMiraResult, type AskMiraSourceType } from "./dto/ask-mira.dto";
import { GenerateLlmWikiDto, IngestLlmWikiSourceDto, LintLlmWikiDto, LlmWikiScope, LlmWikiViewMode, UpdateLlmWikiPageDto, UploadLlmWikiSourceDto } from "./dto/llm-wiki.dto";

type AskIndexRow = {
  sourceId: string;
  sourceType: string;
  title: string;
  ownerId: string;
  ownerName: string;
  path: string | null;
  content: string;
  updatedAt: string;
};

type AskIndexDocument = {
  sourceId: string;
  sourceType: string;
  title: string;
  ownerId: string;
  ownerName: string;
  path?: string;
  content: string;
  updatedAt: string;
};

type WikiOwnerRecord = {
  id: string;
  email: string;
  role: string | null;
  teamNodeId: string | null;
  teamNode: { id: string; name: string; title: string | null; sortOrder?: number | null } | null;
};

@Injectable()
export class MeService {
  private askIndexEnsured = false;

  private readonly askIndexPageLimit = 16;
  private readonly askIndexTaskLimit = 80;
  private readonly askIndexNoteLimit = 60;
  private readonly askIndexResults = 12;
  private readonly askIndexSourceLength = 1800;

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
    const data: { email?: string; role?: string | null } = {};
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
    await this.content.syncUser(user.id);
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
      .sort((a: WikiOwnerRecord, b: WikiOwnerRecord) => (a.teamNode?.sortOrder ?? 0) - (b.teamNode?.sortOrder ?? 0) || a.email.localeCompare(b.email))
      .map((owner: WikiOwnerRecord) => this.publicWikiOwner(owner, owner.id === user.id));
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

  async askMira(user: AuthUser, payload: AskMiraDto): Promise<AskMiraResult> {
    const scope = payload.scope === "team" ? "team" : "personal";
    const targetUsers = await this.resolveAskUsers(user, scope, payload.ownerId);
    const scopeKey = this.askScopeKey(user.id, scope, payload.ownerId);
    await this.ensureAskIndexTable();
    await this.buildAskIndex(scopeKey, targetUsers);

    const question = payload.question.trim();
    const queryTerms = this.tokenize(question);
    const hits = await this.searchAskIndex(scopeKey, question);
    if (!hits.length) {
      return {
        answer: "I could not find matching workspace content for this question.",
        sources: [],
      };
    }

    const responseTerms = queryTerms.length ? queryTerms : this.tokenize(question);
    const topSources = hits.map((item) => ({
      id: item.sourceId,
      type: item.sourceType as AskMiraSourceType,
      title: item.title,
      snippet: this.sourceSnippet(item.content, queryTerms),
    }));
    const response = await this.ai.askFromSources(payload.language, question, topSources);
    const usedIds = new Set(response.usedSourceIds);
    const returnedSources = hits
      .filter((item) => !usedIds.size || usedIds.has(item.sourceId))
      .slice(0, this.askIndexResults)
      .map((item) => ({
        id: item.sourceId,
        title: item.title,
        type: item.sourceType as AskMiraSourceType,
        snippet: this.sourceSnippet(item.content, responseTerms),
        ownerId: item.ownerId,
        ownerName: item.ownerName,
        path: item.path || undefined,
        content: item.content,
      }));

    return {
      answer: response.answer,
      sources: returnedSources,
    };
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

  private async buildAskIndex(scopeKey: string, targetUsers: WikiOwnerRecord[]) {
    const documents: AskIndexDocument[] = [];
    for (const owner of targetUsers) {
      const ownerId = owner.id;
      const ownerName = owner.teamNode?.name || owner.email;
      const ownerNodeId = owner.teamNodeId;
      documents.push({
        sourceId: `team-member:${ownerId}`,
        sourceType: "team-member",
        title: `${ownerName} profile`,
        ownerId,
        ownerName,
        content: `Owner: ${ownerName}\nEmail: ${owner.email}\nRole: ${owner.teamNode?.title || owner.role || "No role"}\nTeam node: ${owner.teamNode?.name || "Unknown"}\nNode title: ${owner.teamNode?.title || "Untitled"}`,
        updatedAt: new Date().toISOString(),
      });

      if (!ownerNodeId) continue;

      const [overview, tasks, notes] = await Promise.all([
        this.ai.wikiOverview(ownerId),
        this.content.listTasks({ nodeIds: [ownerNodeId] }),
        this.content.listNotes({ nodeIds: [ownerNodeId] }),
      ]);

      documents.push({
        sourceId: `wiki-index:${ownerId}`,
        sourceType: "wiki-index",
        title: `Wiki index for ${ownerName}`,
        ownerId,
        ownerName,
        path: "index.md",
        content: overview.index || `No wiki index for ${ownerName}.`,
        updatedAt: new Date().toISOString(),
      });

      for (const page of overview.pages.slice(0, this.askIndexPageLimit)) {
        try {
          const pageContent = await this.ai.readWikiPage(ownerId, page.path);
          documents.push({
            sourceId: `wiki-page:${ownerId}:${page.path}`,
            sourceType: "wiki-page",
            title: `${ownerName} wiki page ${page.path}`,
            ownerId,
            ownerName,
            path: page.path,
            content: `# ${page.title}\n${pageContent.content}`,
            updatedAt: new Date().toISOString(),
          });
        } catch {
          // Ignore unavailable page snapshots while indexing.
        }
      }

      for (const task of tasks.slice(0, this.askIndexTaskLimit)) {
        const item = task as { id: string; title: string; details: string; status: string; priority: string; dueDate: string | null; updatedAt: string };
        documents.push({
          sourceId: `task:${ownerId}:${item.id}`,
          sourceType: "task",
          title: `${ownerName} task: ${item.title}`,
          ownerId,
          ownerName,
          content: [
            `Task: ${item.title}`,
            `Status: ${item.status}`,
            `Priority: ${item.priority}`,
            item.dueDate ? `Due date: ${item.dueDate.slice(0, 10)}` : "",
            `Updated: ${item.updatedAt}`,
            item.details ? `Details: ${item.details}` : "",
          ].filter(Boolean).join("\n"),
          updatedAt: new Date().toISOString(),
        });
      }

      for (const note of notes.slice(0, this.askIndexNoteLimit)) {
        const item = note as { id: string; title: string; date: string; tags: string; content: string };
        documents.push({
          sourceId: `note:${ownerId}:${item.id}`,
          sourceType: "note",
          title: `${ownerName} note: ${item.title}`,
          ownerId,
          ownerName,
          content: [
            `Note: ${item.title}`,
            `Date: ${item.date?.slice?.(0, 10) ?? item.date}`,
            item.tags ? `Tags: ${item.tags}` : "",
            "",
            item.content,
          ].filter(Boolean).join("\n"),
          updatedAt: new Date().toISOString(),
        });
      }
    }

    const sanitized = documents
      .map((document) => ({
        ...document,
        content: document.content.trim(),
      }))
      .filter((document) => document.content.trim());
    const chunks = sanitized.slice(0, 420);

    await this.prisma.$transaction(async (tx: any) => {
      await tx.$executeRawUnsafe("DELETE FROM mira_ask_index WHERE scope_key = ?", scopeKey);
      for (const doc of chunks) {
        await tx.$executeRawUnsafe(
          `
            INSERT INTO mira_ask_index
            (scope_key, source_id, source_type, title, owner_id, owner_name, path, content, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,
          scopeKey,
          doc.sourceId,
          doc.sourceType,
          doc.title,
          doc.ownerId,
          doc.ownerName,
          doc.path || "",
          doc.content.slice(0, this.askIndexSourceLength),
          doc.updatedAt,
        );
      }
    });
  }

  private async resolveAskUsers(user: AuthUser, scope: "personal" | "team", ownerId?: string): Promise<WikiOwnerRecord[]> {
    const ownerNodeId = this.requireOwnNode(user);
    if (scope === "personal") {
      const owner = await this.prisma.user.findUnique({
        where: { id: user.id },
        include: { teamNode: true },
      });
      if (!owner) throw new NotFoundException("User not found");
      return [owner];
    }

    const allowedNodeIds = user.isSuperuser ? await this.activeNodeIds() : [ownerNodeId, ...(await this.descendantIds(ownerNodeId))];
    if (allowedNodeIds.length <= 1 && !user.isSuperuser) {
      throw new ForbiddenException("No subordinate team view is available");
    }

    if (ownerId && ownerId !== "team") {
      const selected = await this.prisma.user.findUnique({ where: { id: ownerId }, include: { teamNode: true } });
      if (!selected?.teamNodeId || !allowedNodeIds.includes(selected.teamNodeId)) {
        throw new ForbiddenException("Selected user is outside your team view");
      }
      return [selected];
    }

    return this.prisma.user.findMany({
      where: { teamNodeId: { in: allowedNodeIds } },
      include: { teamNode: true },
      orderBy: {
        teamNode: {
          sortOrder: "asc",
        },
      },
    }) as Promise<WikiOwnerRecord[]>;
  }

  private askScopeKey(userId: string, scope: "personal" | "team", ownerId?: string) {
    if (scope === "personal") return `ask:${userId}:personal`;
    if (!ownerId || ownerId === "team") return `ask:${userId}:team`;
    return `ask:${userId}:team:${ownerId}`;
  }

  private async ensureAskIndexTable() {
    if (this.askIndexEnsured) return;
    await this.prisma.$executeRawUnsafe(
      `
        CREATE TABLE IF NOT EXISTS mira_ask_index (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          scope_key TEXT NOT NULL,
          source_id TEXT NOT NULL,
          source_type TEXT NOT NULL,
          title TEXT NOT NULL,
          owner_id TEXT NOT NULL,
          owner_name TEXT NOT NULL,
          path TEXT DEFAULT '',
          content TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          UNIQUE(scope_key, source_id)
        )
      `,
    );
    await this.prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS mira_ask_index_scope_key_idx ON mira_ask_index(scope_key)
    `);
    this.askIndexEnsured = true;
  }

  private async searchAskIndex(scopeKey: string, question: string): Promise<AskIndexRow[]> {
    const rows = await (this.prisma.$queryRawUnsafe as (...args: unknown[]) => Promise<AskIndexRow[]>)(
      `
        SELECT
          source_id AS sourceId,
          source_type AS sourceType,
          title,
          owner_id AS ownerId,
          owner_name AS ownerName,
          path,
          content,
          updated_at AS updatedAt
        FROM mira_ask_index
        WHERE scope_key = ?
        ORDER BY updated_at DESC
      `,
      scopeKey,
    );
    if (!rows.length) return [];

    const terms = this.tokenize(question);
    const scored = rows
      .map((row: AskIndexRow) => {
        const score = this.scoreDocument(row, terms);
        return { ...row, score };
      })
      .sort((a: AskIndexRow & { score: number }, b: AskIndexRow & { score: number }) => b.score - a.score)
      .slice(0, 200);

    const topScored = scored
      .filter((row: AskIndexRow & { score: number }) => row.score > 0)
      .map((row: AskIndexRow & { score: number }) => ({ ...row }));

    if (topScored.length) {
      return topScored.map((item: AskIndexRow & { score: number }) => ({
        sourceId: item.sourceId,
        sourceType: item.sourceType,
        title: item.title,
        ownerId: item.ownerId,
        ownerName: item.ownerName,
        path: item.path,
        content: item.content,
        updatedAt: item.updatedAt,
      }));
    }

    return scored.slice(0, this.askIndexResults).map((row: AskIndexRow & { score: number }) => ({
      sourceId: row.sourceId,
      sourceType: row.sourceType,
      title: row.title,
      ownerId: row.ownerId,
      ownerName: row.ownerName,
      path: row.path,
      content: row.content,
      updatedAt: row.updatedAt,
    }));
  }

  private scoreDocument(row: AskIndexRow, terms: string[]) {
    if (!terms.length) return 0;
    const lowerContent = row.content.toLowerCase();
    const lowerTitle = row.title.toLowerCase();
    let score = 0;
    for (const term of terms) {
      if (!term) continue;
      if (lowerTitle.includes(term)) score += 10;
      score += this.countMatches(lowerContent, term);
    }
    return score / (1 + row.content.length / 2500);
  }

  private sourceSnippet(content: string, terms: string[]) {
    if (!content) return "";
    const lower = content.toLowerCase();
    const firstTerm = terms.find((term) => lower.includes(term.toLowerCase()));
    const raw = content.trim();
    if (!firstTerm || !raw) return raw.slice(0, 260);
    const start = Math.max(0, lower.indexOf(firstTerm.toLowerCase()) - 120);
    const end = Math.min(raw.length, start + 500);
    return `${start > 0 ? "…" : ""}${raw.slice(start, end)}${end < raw.length ? "…" : ""}`;
  }

  private countMatches(value: string, term: string) {
    if (!term) return 0;
    let total = 0;
    let cursor = 0;
    while (true) {
      const index = value.indexOf(term, cursor);
      if (index < 0) break;
      total += 1;
      cursor = index + term.length;
    }
    return total;
  }

  private tokenize(value: string) {
    const terms = value.toLowerCase().match(/[a-z0-9\u4e00-\u9fff]{2,}/g) ?? [];
    return [...new Set(terms)];
  }

  async createTask(user: AuthUser, payload: Omit<CreateTaskDto, "ownerNodeId">) {
    this.requireOwnNode(user);
    return this.content.createTaskForUser(user.id, payload);
  }

  async updateTask(user: AuthUser, id: string, payload: UpdateTaskDto) {
    this.requireOwnNode(user);
    return this.content.updateTaskForUser(id, payload, user.id);
  }

  async deleteTask(user: AuthUser, id: string) {
    this.requireOwnNode(user);
    return this.content.deleteTaskForUser(id, user.id);
  }

  async createNote(user: AuthUser, payload: Omit<CreateNoteDto, "ownerNodeId">) {
    this.requireOwnNode(user);
    return this.content.createNoteForUser(user.id, payload);
  }

  async updateNote(user: AuthUser, id: string, payload: UpdateNoteDto) {
    this.requireOwnNode(user);
    return this.content.updateNoteForUser(id, payload, user.id);
  }

  async deleteNote(user: AuthUser, id: string) {
    this.requireOwnNode(user);
    return this.content.deleteNoteForUser(id, user.id);
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
        const value = task as { createdAt: Date | string; completedAt: Date | string | null; dueDate?: Date | string | null };
        const createdAt = value.createdAt instanceof Date ? value.createdAt : new Date(value.createdAt);
        const completedAt = value.completedAt ? (value.completedAt instanceof Date ? value.completedAt : new Date(value.completedAt)) : null;
        const dueDate = value.dueDate ? (value.dueDate instanceof Date ? value.dueDate : new Date(value.dueDate)) : null;
        return createdAt >= start || Boolean(completedAt && completedAt >= start) || Boolean(dueDate && dueDate >= start);
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
    owner: WikiOwnerRecord,
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
    return nodes.map((node: { id: string }) => node.id);
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
