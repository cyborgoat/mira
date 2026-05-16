import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { CurrentUser, AuthUser } from "../auth/current-user";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Period } from "../common/period";
import { TaskPriority, TaskStatus } from "../common/workspace-types";
import { CreateNoteDto, UpdateNoteDto } from "../notes/dto/note.dto";
import { CreateTaskDto, UpdateTaskDto } from "../tasks/dto/task.dto";
import { UpdatePasswordDto, UpdateProfileDto } from "./dto/account.dto";
import { IngestLlmWikiSourceDto, LintLlmWikiDto, QueryLlmWikiDto, UploadLlmWikiSourceDto } from "./dto/llm-wiki.dto";
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

  @Get("llm-wiki")
  llmWikiOverview(@CurrentUser() user: AuthUser) {
    return this.me.llmWikiOverview(user);
  }

  @Post("llm-wiki/sources")
  uploadLlmWikiSource(@CurrentUser() user: AuthUser, @Body() payload: UploadLlmWikiSourceDto) {
    return this.me.uploadLlmWikiSource(user, payload);
  }

  @Post("llm-wiki/ingest")
  ingestLlmWikiSource(@CurrentUser() user: AuthUser, @Body() payload: IngestLlmWikiSourceDto) {
    return this.me.ingestLlmWikiSource(user, payload);
  }

  @Post("llm-wiki/query")
  queryLlmWiki(@CurrentUser() user: AuthUser, @Body() payload: QueryLlmWikiDto) {
    return this.me.queryLlmWiki(user, payload);
  }

  @Post("llm-wiki/lint")
  lintLlmWiki(@CurrentUser() user: AuthUser, @Body() payload: LintLlmWikiDto) {
    return this.me.lintLlmWiki(user, payload);
  }

  @Get("llm-wiki/pages")
  readLlmWikiPage(@CurrentUser() user: AuthUser, @Query("path") path: string) {
    return this.me.readLlmWikiPage(user, path);
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
