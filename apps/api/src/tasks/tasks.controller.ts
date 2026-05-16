import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { TaskPriority, TaskStatus } from "@prisma/client";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { SuperuserGuard } from "../auth/superuser.guard";
import { CreateTaskDto, UpdateTaskDto } from "./dto/task.dto";
import { TasksService } from "./tasks.service";

@Controller("tasks")
@UseGuards(JwtAuthGuard, SuperuserGuard)
export class TasksController {
  constructor(private readonly tasks: TasksService) {}

  @Get()
  list(
    @Query("nodeId") nodeId?: string,
    @Query("scope") scope: "self" | "tree" = "self",
    @Query("query") query?: string,
    @Query("status") status?: TaskStatus,
    @Query("priority") priority?: TaskPriority,
  ) {
    return this.tasks.list({ nodeId, scope, query, status, priority });
  }

  @Post()
  create(@Body() payload: CreateTaskDto) {
    return this.tasks.create(payload);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() payload: UpdateTaskDto) {
    return this.tasks.update(id, payload);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.tasks.remove(id);
  }
}
