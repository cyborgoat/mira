import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as bcrypt from "bcryptjs";
import { AiService } from "../ai/ai.service";
import { AuthUser } from "../auth/current-user";
import { filterByPeriod } from "../common/period-filters";
import { Period } from "../common/period";
import { TaskPriority, TaskStatus } from "../common/workspace-types";
import { PrismaService } from "../prisma/prisma.service";
import { CreateTaskDto, UpdateTaskDto } from "../tasks/dto/task.dto";
import { activeNodeIds, descendantIds } from "../team/tree-utils";
import { UsersService } from "../users/users.service";
import { WorkspaceContentService } from "../workspace-content/workspace-content.service";
import { UpdatePasswordDto, UpdateProfileDto } from "./dto/account.dto";
import { TaskAiRefineDto } from "./dto/task-refine.dto";

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
    return this.viewPayload(selectedNode, [ownerNodeId], filterByPeriod(tasks, notes, filters.period));
  }

  async teamView(user: AuthUser, period: Period, nodeId?: string) {
    const ownerNodeId = this.requireOwnNode(user);
    const rootId = nodeId || ownerNodeId;
    const allowedIds = user.isSuperuser ? await this.listActiveNodeIds() : [ownerNodeId, ...(await this.listDescendantIds(ownerNodeId))];
    if (!allowedIds.includes(rootId)) throw new ForbiddenException("Team view is limited to your subtree");

    const visibleRootIds = rootId === ownerNodeId && !user.isSuperuser ? await this.listDescendantIds(rootId) : [rootId, ...(await this.listDescendantIds(rootId))];
    const visibleIds = visibleRootIds.filter((id) => allowedIds.includes(id));
    if (visibleIds.length <= 1 && !user.isSuperuser) throw new ForbiddenException("No subordinate team view is available");

    const [selectedNode, tasks, notes] = await Promise.all([
      this.prisma.teamNode.findUnique({ where: { id: rootId } }),
      this.content.listTasks({ nodeIds: visibleIds }),
      this.content.listNotes({ nodeIds: visibleIds }),
    ]);
    return this.viewPayload(selectedNode, visibleIds, filterByPeriod(tasks, notes, period));
  }

  async workArchive(user: AuthUser) {
    const ownerNodeId = this.requireOwnNode(user);
    const [tasks, notes] = await Promise.all([
      this.content.listTasks({ nodeIds: [ownerNodeId] }),
      this.content.listNotes({ nodeIds: [ownerNodeId] }),
    ]);

    const completed = tasks.filter((task) => task.status === "complete" && task.completedAt);
    const weekMap = new Map<string, typeof completed>();
    for (const task of completed) {
      const weekStart = this.weekStartIso(new Date(task.completedAt!));
      const list = weekMap.get(weekStart) ?? [];
      list.push(task);
      weekMap.set(weekStart, list);
    }

    const weeks = [...weekMap.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .slice(0, 12)
      .map(([weekStart, weekTasks], index) => ({
        weekStart,
        label: `W${index + 1}`,
        taskCount: weekTasks.length,
        preview: weekTasks.slice(0, 3).map((t) => t.title).join(" · "),
      }));

    const tagCounts = new Map<string, { taskCount: number; noteCount: number }>();
    for (const note of notes) {
      for (const tag of note.tags.split(",").map((t) => t.trim()).filter(Boolean)) {
        const row = tagCounts.get(tag) ?? { taskCount: 0, noteCount: 0 };
        row.noteCount += 1;
        tagCounts.set(tag, row);
      }
    }
    for (const task of tasks) {
      const tagMatch = task.title.match(/\[([^\]]+)\]/);
      if (!tagMatch) continue;
      const tag = tagMatch[1].trim();
      if (!tag) continue;
      const row = tagCounts.get(tag) ?? { taskCount: 0, noteCount: 0 };
      row.taskCount += 1;
      tagCounts.set(tag, row);
    }

    const projects = [...tagCounts.entries()]
      .sort((a, b) => (b[1].taskCount + b[1].noteCount) - (a[1].taskCount + a[1].noteCount))
      .slice(0, 12)
      .map(([tag, counts]) => ({ tag, ...counts }));

    return { weeks, projects };
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

  async refineTasks(user: AuthUser, payload: TaskAiRefineDto) {
    const requestedScope = payload.scope === "team" ? "team" : "personal";
    const fullUser = await this.users.findById(user.id);
    if (!fullUser) throw new NotFoundException("User not found");
    const publicUser = this.users.toPublicUser(fullUser);
    if (requestedScope === "team" && !publicUser.canViewTeam) {
      throw new ForbiddenException("Team scope is not available for your role");
    }

    const ownerNodeId = this.requireOwnNode(user);
    const nodeIds =
      requestedScope === "personal"
        ? [ownerNodeId]
        : user.isSuperuser
          ? await this.listActiveNodeIds()
          : [ownerNodeId, ...(await this.listDescendantIds(ownerNodeId))];
    if (requestedScope === "team" && nodeIds.length <= 1 && !user.isSuperuser) {
      throw new ForbiddenException("No subordinate team view is available");
    }

    const [tasks, notes] = await Promise.all([
      this.content.listTasks({ nodeIds }),
      this.content.listNotes({ nodeIds }),
    ]);
    const filtered = filterByPeriod(tasks, notes, "daily");
    const openTasks = filtered.tasks.filter((task) => task.status !== "complete");
    const completedToday = filtered.tasks.filter((task) => task.status === "complete");

    const contextSummary = [
      `Open tasks (${openTasks.length}):`,
      ...openTasks.slice(0, 20).map((task) => `- ${task.title}${task.details ? `: ${task.details.slice(0, 120)}` : ""}`),
      "",
      `Completed today (${completedToday.length}):`,
      ...completedToday.slice(0, 15).map((task) => `- ${task.title}`),
      "",
      `Recent notes (${filtered.notes.length}):`,
      ...filtered.notes.slice(0, 8).map((note) => `- ${note.title}: ${note.content.slice(0, 100)}`),
    ].join("\n");

    return this.ai.suggestDailyTasks(user.id, payload.language, {
      scope: requestedScope,
      contextSummary,
      messages: payload.messages,
    });
  }

  async createTask(user: AuthUser, payload: Omit<CreateTaskDto, "ownerNodeId">) {
    this.requireOwnNode(user);
    return this.content.createTaskForUser(user.id, payload);
  }

  async updateTask(user: AuthUser, id: string, payload: UpdateTaskDto) {
    this.requireOwnNode(user);
    return this.content.updateTaskForUser(id, payload, user.id);
  }

  private viewPayload(selectedNode: unknown, descendantIdsList: string[], data: { tasks: Array<{ status: TaskStatus }>; notes: unknown[] }) {
    const completedTasks = data.tasks.filter((task) => task.status === "complete").length;
    return {
      selectedNode,
      descendantIds: descendantIdsList,
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

  private weekStartIso(date: Date) {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const day = start.getDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    start.setDate(start.getDate() + mondayOffset);
    return start.toISOString().slice(0, 10);
  }

  private requireOwnNode(user: AuthUser) {
    if (!user.teamNodeId) throw new ForbiddenException("Your account is not linked to a team node");
    return user.teamNodeId;
  }

  private async listActiveNodeIds() {
    const nodes = await this.prisma.teamNode.findMany({ where: { active: true }, select: { id: true, active: true } });
    return activeNodeIds(nodes);
  }

  private async listDescendantIds(rootId: string) {
    const nodes = await this.prisma.teamNode.findMany({ where: { active: true }, select: { id: true, parentId: true } });
    return descendantIds(rootId, nodes);
  }
}
