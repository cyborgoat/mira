import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { TeamModule } from "../team/team.module";
import { WorkspaceContentModule } from "../workspace-content/workspace-content.module";
import { TasksController } from "./tasks.controller";
import { TasksService } from "./tasks.service";

@Module({
  imports: [AuthModule, TeamModule, WorkspaceContentModule],
  controllers: [TasksController],
  providers: [TasksService],
})
export class TasksModule {}
