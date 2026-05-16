import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { TaskPriority, TaskStatus } from "@prisma/client";
import { CurrentUser, AuthUser } from "../auth/current-user";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Period } from "../common/period";
import { CreateNoteDto, UpdateNoteDto } from "../notes/dto/note.dto";
import { CreateTaskDto, UpdateTaskDto } from "../tasks/dto/task.dto";
import { UpdatePasswordDto, UpdateProfileDto } from "./dto/account.dto";
import { AiSummaryDto } from "./dto/ai-summary.dto";
import { MeService } from "./me.service";

@UseGuards(JwtAuthGuard)
@Controller("me")
export class MeController {
  constructor(private readonly me: MeService) {}

  @Get("work")
  work(
    @CurrentUser() user: AuthUser,
    @Query("period") period: Period = "weekly",
    @Query("query") query?: string,
    @Query("status") status?: TaskStatus,
    @Query("priority") priority?: TaskPriority,
  ) {
    return this.me.personalWork(user, { period, query, status, priority });
  }

  @Get("team-view")
  teamView(@CurrentUser() user: AuthUser, @Query("period") period: Period = "weekly", @Query("nodeId") nodeId?: string) {
    return this.me.teamView(user, period, nodeId);
  }

  @Patch("profile")
  updateProfile(@CurrentUser() user: AuthUser, @Body() payload: UpdateProfileDto) {
    return this.me.updateProfile(user, payload);
  }

  @Patch("password")
  updatePassword(@CurrentUser() user: AuthUser, @Body() payload: UpdatePasswordDto) {
    return this.me.updatePassword(user, payload);
  }

  @Post("ai-summary")
  aiSummary(@CurrentUser() user: AuthUser, @Body() payload: AiSummaryDto) {
    return this.me.aiSummary(user, payload);
  }

  @Post("tasks")
  createTask(@CurrentUser() user: AuthUser, @Body() payload: Omit<CreateTaskDto, "ownerNodeId">) {
    return this.me.createTask(user, payload);
  }

  @Patch("tasks/:id")
  updateTask(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() payload: UpdateTaskDto) {
    return this.me.updateTask(user, id, payload);
  }

  @Delete("tasks/:id")
  deleteTask(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.me.deleteTask(user, id);
  }

  @Post("notes")
  createNote(@CurrentUser() user: AuthUser, @Body() payload: Omit<CreateNoteDto, "ownerNodeId">) {
    return this.me.createNote(user, payload);
  }

  @Patch("notes/:id")
  updateNote(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() payload: UpdateNoteDto) {
    return this.me.updateNote(user, id, payload);
  }

  @Delete("notes/:id")
  deleteNote(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.me.deleteNote(user, id);
  }
}
