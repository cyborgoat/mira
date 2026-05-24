import { Module } from "@nestjs/common";
import { WorkspaceContentModule } from "../workspace-content/workspace-content.module";
import { UsersService } from "./users.service";

@Module({
  imports: [WorkspaceContentModule],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
