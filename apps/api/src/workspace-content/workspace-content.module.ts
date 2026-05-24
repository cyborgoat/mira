import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { WorkspaceContentService } from "./workspace-content.service";

@Module({
  imports: [PrismaModule],
  providers: [WorkspaceContentService],
  exports: [WorkspaceContentService],
})
export class WorkspaceContentModule {}
