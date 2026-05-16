import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { TeamModule } from "../team/team.module";
import { NotesController } from "./notes.controller";
import { NotesService } from "./notes.service";

@Module({
  imports: [AuthModule, TeamModule],
  controllers: [NotesController],
  providers: [NotesService],
})
export class NotesModule {}
