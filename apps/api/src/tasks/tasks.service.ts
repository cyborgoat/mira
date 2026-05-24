import { BadRequestException, Injectable } from "@nestjs/common";
import { TaskPriority, TaskStatus } from "../common/workspace-types";
import { TeamService } from "../team/team.service";
import { WorkspaceContentService } from "../workspace-content/workspace-content.service";
import { CreateTaskDto, UpdateTaskDto } from "./dto/task.dto";

@Injectable()
export class TasksService {
  constructor(
    private readonly team: TeamService,
    private readonly content: WorkspaceContentService,
  ) {}

  async list(query: { nodeId?: string; scope?: "self" | "tree"; query?: string; status?: TaskStatus; priority?: TaskPriority }) {
    const nodeIds = query.nodeId ? await this.team.idsForScope(query.nodeId, query.scope || "self") : undefined;
    return this.content.listTasks({ nodeIds, query: query.query, status: query.status, priority: query.priority });
  }

  async create(payload: CreateTaskDto) {
    if (payload.ownerUserId) return this.content.createTaskForUser(payload.ownerUserId, payload);
    if (!payload.ownerNodeId) throw new BadRequestException("ownerNodeId or ownerUserId is required");
    await this.team.idsForScope(payload.ownerNodeId, "self");
    return this.content.createTask(payload.ownerNodeId, payload);
  }

  async update(id: string, payload: UpdateTaskDto) {
    return this.content.updateTask(id, payload);
  }

  async remove(id: string) {
    return this.content.deleteTask(id);
  }
}
