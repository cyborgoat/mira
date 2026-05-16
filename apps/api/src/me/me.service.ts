import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Prisma, TaskPriority, TaskStatus } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { AuthUser } from "../auth/current-user";
import { createId } from "../common/ids";
import { periodStart, Period } from "../common/period";
import { CreateNoteDto, UpdateNoteDto } from "../notes/dto/note.dto";
import { PrismaService } from "../prisma/prisma.service";
import { CreateTaskDto, UpdateTaskDto } from "../tasks/dto/task.dto";
import { UsersService } from "../users/users.service";
import { UpdatePasswordDto, UpdateProfileDto } from "./dto/account.dto";

@Injectable()
export class MeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly config: ConfigService,
  ) {}

  async personalWork(user: AuthUser, filters: { period: Period; query?: string; status?: TaskStatus; priority?: TaskPriority }) {
    const ownerNodeId = this.requireOwnNode(user);
    const where: Prisma.TaskWhereInput = { ownerNodeId };
    if (filters.status) where.status = filters.status;
    if (filters.priority) where.priority = filters.priority;
    if (filters.query) where.OR = [{ title: { contains: filters.query } }, { details: { contains: filters.query } }];

    const [selectedNode, tasks, notes] = await Promise.all([
      this.prisma.teamNode.findUnique({ where: { id: ownerNodeId } }),
      this.prisma.task.findMany({ where, orderBy: { updatedAt: "desc" } }),
      this.prisma.meetingNote.findMany({ where: { ownerNodeId }, orderBy: { updatedAt: "desc" } }),
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
      this.prisma.task.findMany({ where: { ownerNodeId: { in: descendantIds } }, orderBy: { updatedAt: "desc" } }),
      this.prisma.meetingNote.findMany({ where: { ownerNodeId: { in: descendantIds } }, orderBy: { updatedAt: "desc" } }),
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
    const rounds = this.config.get<number>("MIRA_BCRYPT_ROUNDS", 12);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await bcrypt.hash(payload.newPassword, rounds) },
    });
    return { ok: true };
  }

  async createTask(user: AuthUser, payload: Omit<CreateTaskDto, "ownerNodeId">) {
    const ownerNodeId = this.requireOwnNode(user);
    return this.prisma.task.create({
      data: {
        id: createId("task"),
        ownerNodeId,
        title: payload.title.trim(),
        details: payload.details?.trim() || "",
        priority: payload.priority || "normal",
        dueDate: payload.dueDate ? new Date(payload.dueDate) : null,
      },
    });
  }

  async updateTask(user: AuthUser, id: string, payload: UpdateTaskDto) {
    const task = await this.ensureOwnTask(user, id);
    const data: Prisma.TaskUpdateInput = {};
    if (payload.title !== undefined) data.title = payload.title.trim();
    if (payload.details !== undefined) data.details = payload.details.trim();
    if (payload.priority !== undefined) data.priority = payload.priority;
    if (payload.dueDate !== undefined) data.dueDate = payload.dueDate ? new Date(payload.dueDate) : null;
    if (payload.status !== undefined) {
      data.status = payload.status;
      data.completedAt = payload.status === "complete" ? (task.completedAt || new Date()) : null;
    }
    return this.prisma.task.update({ where: { id }, data });
  }

  async deleteTask(user: AuthUser, id: string) {
    await this.ensureOwnTask(user, id);
    await this.prisma.task.delete({ where: { id } });
    return { ok: true };
  }

  async createNote(user: AuthUser, payload: Omit<CreateNoteDto, "ownerNodeId">) {
    const ownerNodeId = this.requireOwnNode(user);
    return this.prisma.meetingNote.create({
      data: {
        id: createId("note"),
        ownerNodeId,
        title: payload.title.trim(),
        date: new Date(payload.date),
        content: payload.content,
        tags: payload.tags?.trim() || "",
      },
    });
  }

  async updateNote(user: AuthUser, id: string, payload: UpdateNoteDto) {
    await this.ensureOwnNote(user, id);
    const data: Prisma.MeetingNoteUpdateInput = {};
    if (payload.title !== undefined) data.title = payload.title.trim();
    if (payload.date !== undefined) data.date = new Date(payload.date);
    if (payload.content !== undefined) data.content = payload.content;
    if (payload.tags !== undefined) data.tags = payload.tags.trim();
    return this.prisma.meetingNote.update({ where: { id }, data });
  }

  async deleteNote(user: AuthUser, id: string) {
    await this.ensureOwnNote(user, id);
    await this.prisma.meetingNote.delete({ where: { id } });
    return { ok: true };
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
        const value = task as { createdAt: Date; completedAt: Date | null };
        return value.createdAt >= start || Boolean(value.completedAt && value.completedAt >= start);
      }),
      notes: notes.filter((note) => (note as { date: Date }).date >= start),
    };
  }

  private requireOwnNode(user: AuthUser) {
    if (!user.teamNodeId) throw new ForbiddenException("Your account is not linked to a team node");
    return user.teamNodeId;
  }

  private async ensureOwnTask(user: AuthUser, id: string) {
    const task = await this.prisma.task.findFirst({ where: { id, ownerNodeId: this.requireOwnNode(user) } });
    if (!task) throw new NotFoundException("Task not found");
    return task;
  }

  private async ensureOwnNote(user: AuthUser, id: string) {
    const note = await this.prisma.meetingNote.findFirst({ where: { id, ownerNodeId: this.requireOwnNode(user) } });
    if (!note) throw new NotFoundException("Note not found");
    return note;
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
