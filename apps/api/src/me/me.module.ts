import { Module } from "@nestjs/common";
import { AiModule } from "../ai/ai.module";
import { AuthModule } from "../auth/auth.module";
import { UsersModule } from "../users/users.module";
import { WorkspaceContentModule } from "../workspace-content/workspace-content.module";
import { MeController } from "./me.controller";
import { MeService } from "./me.service";

@Module({
  imports: [AuthModule, UsersModule, AiModule, WorkspaceContentModule],
  controllers: [MeController],
  providers: [MeService],
})
export class MeModule {}
