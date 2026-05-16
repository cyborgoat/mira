import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, TaskPriority, TaskStatus } from "@prisma/client";
import { createId } from "../common/ids";
import { PrismaService } from "../prisma/prisma.service";
import { TeamService } from "../team/team.service";
import { CreateTaskDto, UpdateTaskDto } from "./dto/task.dto";

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly team: TeamService,
  ) {}

  async list(query: { nodeId?: string; scope?: "self" | "tree"; query?: string; status?: TaskStatus; priority?: TaskPriority }) {
    const where: Prisma.TaskWhereInput = {};
    if (query.nodeId) where.ownerNodeId = { in: await this.team.idsForScope(query.nodeId, query.scope || "self") };
    if (query.status) where.status = query.status;
    if (query.priority) where.priority = query.priority;
    if (query.query) {
      where.OR = [
        { title: { contains: query.query } },
        { details: { contains: query.query } },
      ];
    }

    return this.prisma.task.findMany({
      where,
      orderBy: { updatedAt: "desc" },
    });
  }

  async create(payload: CreateTaskDto) {
    await this.team.idsForScope(payload.ownerNodeId, "self");
    return this.prisma.task.create({
      data: {
        id: createId("task"),
        ownerNodeId: payload.ownerNodeId,
        title: payload.title.trim(),
        details: payload.details?.trim() || "",
        priority: payload.priority || "normal",
        dueDate: payload.dueDate ? new Date(payload.dueDate) : null,
      },
    });
  }

  async update(id: string, payload: UpdateTaskDto) {
    const task = await this.ensureTask(id);
    if (!payload.title && payload.title !== undefined) throw new BadRequestException("Task title is required");

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

  async remove(id: string) {
    await this.ensureTask(id);
    await this.prisma.task.delete({ where: { id } });
    return { ok: true };
  }

  private async ensureTask(id: string) {
    const task = await this.prisma.task.findUnique({ where: { id } });
    if (!task) throw new NotFoundException("Task not found");
    return task;
  }
}
