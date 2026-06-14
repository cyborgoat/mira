import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards, UseInterceptors } from "@nestjs/common";
import { AiManualInterceptor } from "../ai/ai-manual.interceptor";
import { LlmConfigService } from "../ai/llm-config.service";
import { CurrentUser, AuthUser } from "../auth/current-user";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Period } from "../common/period";
import { TaskPriority, TaskStatus } from "../common/workspace-types";
import { CreateTaskDto, UpdateTaskDto } from "../tasks/dto/task.dto";
import { UpdatePasswordDto, UpdateProfileDto } from "./dto/account.dto";
import { UpdateLlmConfigDto } from "./dto/llm-config.dto";
import { GenerateReportDto, ProcessReportColdStartDto, RefineReportDto, UploadReportHistoryDto } from "./dto/report.dto";
import { TaskAiRefineDto } from "./dto/task-refine.dto";
import { MeService } from "./me.service";
import { ReportService } from "./report.service";

@UseGuards(JwtAuthGuard)
@Controller("me")
export class MeController {
  constructor(
    private readonly me: MeService,
    private readonly reports: ReportService,
    private readonly llmConfig: LlmConfigService,
  ) {}

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

  @Get("work/archive")
  workArchive(@CurrentUser() user: AuthUser) {
    return this.me.workArchive(user);
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

  @Get("settings/llm-config")
  llmConfigView(@CurrentUser() user: AuthUser) {
    return this.llmConfig.view(user.id);
  }

  @Patch("settings/llm-config")
  updateLlmConfig(@CurrentUser() user: AuthUser, @Body() payload: UpdateLlmConfigDto) {
    return this.llmConfig.update(user.id, payload);
  }

  @Post("tasks/ai-refine")
  @UseInterceptors(AiManualInterceptor)
  refineTasks(@CurrentUser() user: AuthUser, @Body() payload: TaskAiRefineDto) {
    return this.me.refineTasks(user, payload);
  }

  @Get("tasks/local-suggestion")
  localSuggestion(@CurrentUser() user: AuthUser, @Query("scope") scope?: "personal" | "team") {
    return this.me.localSuggestion(user, scope);
  }

  @Get("reports/profile")
  reportProfile(@CurrentUser() user: AuthUser) {
    return this.reports.profile(user);
  }

  @Get("reports/sources")
  reportSources(
    @CurrentUser() user: AuthUser,
    @Query("period") period: Period = "weekly",
    @Query("scope") scope?: "personal" | "team",
  ) {
    return this.reports.listSources(user, period, scope);
  }

  @Post("reports/generate")
  @UseInterceptors(AiManualInterceptor)
  generateReport(@CurrentUser() user: AuthUser, @Body() payload: GenerateReportDto) {
    return this.reports.generateReport(user, payload);
  }

  @Post("reports/assemble")
  assembleReport(@CurrentUser() user: AuthUser, @Body() payload: GenerateReportDto) {
    return this.reports.assembleReport(user, payload);
  }

  @Post("reports/refine")
  @UseInterceptors(AiManualInterceptor)
  refineReport(@CurrentUser() user: AuthUser, @Body() payload: RefineReportDto) {
    return this.reports.refineReport(user, payload);
  }

  @Post("reports/cold-start/upload")
  uploadReportHistory(@CurrentUser() user: AuthUser, @Body() payload: UploadReportHistoryDto) {
    return this.reports.uploadHistory(user, payload);
  }

  @Post("reports/cold-start/process")
  @UseInterceptors(AiManualInterceptor)
  processReportColdStart(@CurrentUser() user: AuthUser, @Body() payload: ProcessReportColdStartDto) {
    return this.reports.processColdStart(user, payload.language);
  }

  @Post("tasks")
  createTask(@CurrentUser() user: AuthUser, @Body() payload: Omit<CreateTaskDto, "ownerNodeId">) {
    return this.me.createTask(user, payload);
  }

  @Patch("tasks/:id")
  updateTask(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() payload: UpdateTaskDto) {
    return this.me.updateTask(user, id, payload);
  }
}
