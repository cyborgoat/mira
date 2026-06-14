import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { basename, extname, join, resolve } from "node:path";
import {
  AiService,
  ExtractedMission,
  ReportStyleProfile,
  WorkReportNoteInput,
  WorkReportTaskInput,
} from "../ai/ai.service";
import { AuthUser } from "../auth/current-user";
import { filterByPeriod } from "../common/period-filters";
import { periodStart, Period } from "../common/period";
import { activeNodeIds, descendantIds } from "../team/tree-utils";
import { PrismaService } from "../prisma/prisma.service";
import { UsersService } from "../users/users.service";
import { WorkspaceContentService, WorkspaceNote, WorkspaceTask } from "../workspace-content/workspace-content.service";
import { GenerateReportDto, RefineReportDto, ReportSourcePayload, ReportSourceType, UploadReportHistoryDto } from "./dto/report.dto";

type ReportScope = "personal" | "team";

@Injectable()
export class ReportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly content: WorkspaceContentService,
    private readonly ai: AiService,
    private readonly users: UsersService,
    private readonly config: ConfigService,
  ) {}

  async profile(user: AuthUser) {
    const style = await this.readStyleProfile(user.id);
    const rawCount = await this.countRawReports(user.id);
    return {
      ready: Boolean(style && style.sampleCount > 0),
      sampleCount: style?.sampleCount ?? 0,
      importedTaskCount: style?.importedTaskCount ?? 0,
      lastProcessedAt: style?.lastProcessedAt ?? null,
      rawReportCount: rawCount,
      toneSummary: style?.toneSummary ?? null,
    };
  }

  async uploadHistory(user: AuthUser, payload: UploadReportHistoryDto) {
    const maxBytes = Number(this.config.get<string>("MIRA_REPORT_MAX_BYTES", "2000000")) || 2_000_000;
    let totalBytes = 0;
    const saved: string[] = [];
    const rawDir = await this.ensureRawDir(user.id);

    for (const file of payload.files) {
      const filename = this.safeReportFilename(file.filename);
      const bytes = Buffer.byteLength(file.content, "utf8");
      totalBytes += bytes;
      if (totalBytes > maxBytes) throw new BadRequestException("Uploaded reports exceed the size limit");
      const stamp = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
      const target = join(rawDir, `${stamp}-${filename}`);
      await writeFile(target, file.content, "utf8");
      saved.push(basename(target));
    }

    return { saved, count: saved.length };
  }

  async processColdStart(user: AuthUser, language: "en" | "zh") {
    const rawDir = await this.ensureRawDir(user.id);
    const entries = (await readdir(rawDir)).filter((name) => /\.(md|markdown|txt)$/i.test(name));
    if (!entries.length) throw new BadRequestException("Upload at least one weekly report before processing");

    const reports: string[] = [];
    for (const name of entries) {
      reports.push(await readFile(join(rawDir, name), "utf8"));
    }

    const allMissions: ExtractedMission[] = [];
    for (let index = 0; index < reports.length; index += 1) {
      const fallbackWeek = this.inferWeekFromFilename(entries[index]);
      const missions = await this.ai.extractMissionsFromReport(user.id, language, reports[index], fallbackWeek);
      allMissions.push(...missions);
    }

    const importResult = await this.content.importCompletedTasksForUser(
      user.id,
      allMissions.map((mission) => ({
        title: mission.title,
        details: mission.details,
        completedAt: mission.completedAt,
        weekOf: mission.weekOf,
      })),
    );

    const styleProfile = await this.ai.buildReportStyleProfile(user.id, language, reports);
    styleProfile.importedTaskCount = importResult.imported;
    styleProfile.lastProcessedAt = new Date().toISOString();
    await this.writeStyleProfile(user.id, styleProfile);

    return {
      imported: importResult.imported,
      skipped: importResult.skipped,
      profileReady: true,
      styleSummary: styleProfile.toneSummary,
      sampleCount: styleProfile.sampleCount,
    };
  }

  async listSources(user: AuthUser, period: Period, scope?: ReportScope) {
    const resolvedScope = await this.resolveScope(user, scope);
    const nodeIds = await this.resolveNodeIds(user, resolvedScope);
    const [tasks, notes] = await Promise.all([
      this.content.listTasks({ nodeIds }),
      this.content.listNotes({ nodeIds }),
    ]);
    const filtered = filterByPeriod(tasks, notes, period);
    return {
      period,
      scope: resolvedScope,
      tasks: filtered.tasks.map((task) => ({
        id: task.id,
        title: task.title,
        status: task.status,
        completedAt: task.completedAt,
        confidence: task.status !== "complete" || !task.details.trim() ? ("uncertain" as const) : ("high" as const),
      })),
      notes: filtered.notes.map((note) => ({
        id: note.id,
        title: note.title,
        date: note.date,
      })),
    };
  }

  async generateReport(user: AuthUser, payload: GenerateReportDto) {
    const scope = await this.resolveScope(user, payload.scope);
    const nodeIds = await this.resolveNodeIds(user, scope);
    const ownerNames = await this.ownerNameMap(nodeIds);

    const [tasks, notes] = await Promise.all([
      this.content.listTasks({ nodeIds }),
      this.content.listNotes({ nodeIds }),
    ]);

    const filtered = filterByPeriod(tasks, notes, payload.period);
    const taskIdSet = payload.includedTaskIds?.length ? new Set(payload.includedTaskIds) : null;
    const noteIdSet = payload.includedNoteIds?.length ? new Set(payload.includedNoteIds) : null;

    const selectedTasks = taskIdSet ? filtered.tasks.filter((task) => taskIdSet.has(task.id)) : filtered.tasks;
    const selectedNotes = noteIdSet ? filtered.notes.filter((note) => noteIdSet.has(note.id)) : filtered.notes;

    const start = periodStart(payload.period);
    const end = new Date();
    const completedTasks = selectedTasks.filter((task) => task.status === "complete" && task.completedAt && new Date(task.completedAt) >= start);
    const openTasks = selectedTasks.filter((task) => task.status !== "complete");

    const styleProfile = await this.readStyleProfile(user.id);
    const periodLabel = this.periodLabel(payload.period, payload.language);
    const response = await this.ai.generateWorkReport(user.id, payload.language, {
      period: payload.period,
      periodLabel,
      dateRange: { start: start.toISOString(), end: end.toISOString() },
      scope,
      completedTasks: completedTasks.map((task) => this.toReportTask(task, ownerNames.get(task.ownerNodeId))),
      openTasks: openTasks.map((task) => this.toReportTask(task, ownerNames.get(task.ownerNodeId))),
      notes: selectedNotes.map((note) => this.toReportNote(note)),
      styleProfile,
      stylePreset: payload.stylePreset,
    });

    const sources = this.buildSources(completedTasks, selectedNotes, response.usedSourceIds, ownerNames);
    return {
      answer: response.answer,
      sources,
      period: payload.period,
      scope,
    };
  }

  async refineReport(user: AuthUser, payload: RefineReportDto) {
    const scope = await this.resolveScope(user, payload.scope);
    const nodeIds = await this.resolveNodeIds(user, scope);
    const [tasks, notes] = await Promise.all([
      this.content.listTasks({ nodeIds }),
      this.content.listNotes({ nodeIds }),
    ]);
    const filtered = filterByPeriod(tasks, notes, payload.period);
    const styleProfile = await this.readStyleProfile(user.id);
    const contextSummary = [
      `Tasks in period (${filtered.tasks.length}):`,
      ...filtered.tasks.slice(0, 25).map((task) => `- ${task.title} (${task.status})`),
      "",
      `Notes in period (${filtered.notes.length}):`,
      ...filtered.notes.slice(0, 10).map((note) => `- ${note.title}`),
    ].join("\n");

    return this.ai.refineWorkReport(user.id, payload.language, {
      period: payload.period,
      periodLabel: this.periodLabel(payload.period, payload.language),
      draft: payload.draft,
      message: payload.message,
      messages: payload.messages,
      contextSummary,
      styleProfile,
      stylePreset: payload.stylePreset,
    });
  }

  private async resolveScope(user: AuthUser, requested?: ReportScope): Promise<ReportScope> {
    const fullUser = await this.prisma.user.findUnique({
      where: { id: user.id },
      include: { teamNode: { include: { children: { where: { active: true }, select: { id: true } } } } },
    });
    if (!fullUser) throw new NotFoundException("User not found");
    const publicUser = this.users.toPublicUser(fullUser);
    if (requested === "team") {
      if (!publicUser.canViewTeam) throw new ForbiddenException("Team reports are not available for your role");
      return "team";
    }
    return "personal";
  }

  private async resolveNodeIds(user: AuthUser, scope: ReportScope) {
    const ownerNodeId = user.teamNodeId;
    if (!ownerNodeId) throw new ForbiddenException("Your account is not linked to a team node");
    if (scope === "personal") return [ownerNodeId];
    const nodes = await this.prisma.teamNode.findMany({ where: { active: true }, select: { id: true, parentId: true, active: true } });
    const allowed = user.isSuperuser ? activeNodeIds(nodes) : [ownerNodeId, ...descendantIds(ownerNodeId, nodes)];
    if (allowed.length <= 1 && !user.isSuperuser) throw new ForbiddenException("No subordinate team view is available");
    return allowed;
  }

  private toReportTask(task: WorkspaceTask, ownerName?: string): WorkReportTaskInput {
    return {
      id: task.id,
      title: task.title,
      details: task.details,
      status: task.status,
      completedAt: task.completedAt,
      ownerName,
    };
  }

  private toReportNote(note: WorkspaceNote): WorkReportNoteInput {
    return {
      id: note.id,
      title: note.title,
      date: note.date,
      content: note.content,
    };
  }

  private buildSources(
    tasks: WorkspaceTask[],
    notes: WorkspaceNote[],
    usedIds: string[],
    ownerNames: Map<string, string>,
  ): ReportSourcePayload[] {
    const used = new Set(usedIds);
    const taskSources = tasks
      .filter((task) => !used.size || used.has(task.id))
      .map((task) => ({
        id: task.id,
        type: "task" as ReportSourceType,
        title: task.title,
        ownerId: task.ownerUserId,
        ownerName: ownerNames.get(task.ownerNodeId) || task.ownerUserId,
        snippet: task.details.slice(0, 200),
        content: `${task.title}\n${task.details}`,
      }));
    const noteSources = notes
      .filter((note) => !used.size || used.has(note.id))
      .map((note) => ({
        id: note.id,
        type: "note" as ReportSourceType,
        title: note.title,
        ownerId: note.ownerUserId,
        ownerName: ownerNames.get(note.ownerNodeId) || note.ownerUserId,
        snippet: note.content.slice(0, 200),
        content: note.content,
      }));
    return [...taskSources, ...noteSources].slice(0, 12);
  }

  private async ownerNameMap(nodeIds: string[]) {
    const users = await this.prisma.user.findMany({
      where: { teamNodeId: { in: nodeIds }, teamNode: { active: true } },
      include: { teamNode: true },
    });
    const map = new Map<string, string>();
    for (const user of users) {
      if (user.teamNodeId) map.set(user.teamNodeId, user.teamNode?.name || user.email);
    }
    return map;
  }

  private periodLabel(period: Period, language: "en" | "zh") {
    if (language === "zh") {
      if (period === "daily") return "日报";
      if (period === "weekly") return "周报";
      return "月报";
    }
    if (period === "daily") return "daily report";
    if (period === "weekly") return "weekly report";
    return "monthly report";
  }

  private dataDir() {
    if (process.env.MIRA_WORKSPACE_ROOT) return resolve(process.env.MIRA_WORKSPACE_ROOT, "..");
    const candidates = [
      resolve(process.cwd(), "../../mira-workspace"),
      resolve(process.cwd(), "mira-workspace"),
      resolve(__dirname, "../../../mira-workspace"),
    ];
    return candidates.find((path) => existsSync(path)) || candidates[0];
  }

  private reportHistoryRoot() {
    return resolve(process.env.MIRA_REPORT_HISTORY_ROOT || join(this.dataDir(), "report-history"));
  }

  private reportStyleRoot() {
    return resolve(process.env.MIRA_REPORT_STYLE_ROOT || join(this.dataDir(), "report-style"));
  }

  private async ensureRawDir(userId: string) {
    const dir = join(this.reportHistoryRoot(), userId, "raw");
    await mkdir(dir, { recursive: true });
    return dir;
  }

  private styleProfilePath(userId: string) {
    return join(this.reportStyleRoot(), userId, "profile.json");
  }

  private async readStyleProfile(userId: string): Promise<ReportStyleProfile | null> {
    const path = this.styleProfilePath(userId);
    if (!existsSync(path)) return null;
    try {
      return JSON.parse(await readFile(path, "utf8")) as ReportStyleProfile;
    } catch {
      return null;
    }
  }

  private async writeStyleProfile(userId: string, profile: ReportStyleProfile) {
    const dir = join(this.reportStyleRoot(), userId);
    await mkdir(dir, { recursive: true });
    await writeFile(this.styleProfilePath(userId), JSON.stringify(profile, null, 2), "utf8");
  }

  private async countRawReports(userId: string) {
    const dir = join(this.reportHistoryRoot(), userId, "raw");
    if (!existsSync(dir)) return 0;
    const entries = await readdir(dir);
    return entries.filter((name) => /\.(md|markdown|txt)$/i.test(name)).length;
  }

  private safeReportFilename(filename: string) {
    const original = basename(filename || "");
    const extension = extname(original).toLowerCase();
    if (![".md", ".markdown", ".txt"].includes(extension)) {
      throw new BadRequestException("Only .md, .markdown, and .txt reports are supported");
    }
    const stem = basename(original, extension).replace(/[^a-zA-Z0-9._\u4e00-\u9fff-]+/g, "-").replace(/^-+|-+$/g, "") || "report";
    return `${stem}${extension}`;
  }

  private inferWeekFromFilename(filename: string) {
    const match = filename.match(/(20\d{2})[-_]?(0[1-9]|1[0-2])[-_]?(0[1-9]|[12]\d|3[01])/);
    if (!match) return undefined;
    return `${match[1]}-${match[2]}-${match[3]}`;
  }
}
