import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { TeamModule } from "../team/team.module";
import { WorkspaceContentModule } from "../workspace-content/workspace-content.module";
import { NotesController } from "./notes.controller";
import { NotesService } from "./notes.service";

@Module({
  imports: [AuthModule, TeamModule, WorkspaceContentModule],
  controllers: [NotesController],
  providers: [NotesService],
})
export class NotesModule {}
