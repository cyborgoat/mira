import { Injectable, OnModuleInit } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { WorkspaceContentService } from "../workspace-content/workspace-content.service";

type UserRecord = {
  id: string;
  email: string;
  role: string | null;
  isSuperuser: boolean;
  teamNodeId: string | null;
  createdAt: Date;
  updatedAt: Date;
  teamNode?: { id: string; name: string; title: string | null; parentId: string | null; children?: Array<{ id: string }> } | null;
};

@Injectable()
export class UsersService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly content: WorkspaceContentService,
  ) {}

  async onModuleInit() {
    await this.content.syncWorkspaceUsers();
  }

  findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: { teamNode: { include: { children: { where: { active: true }, select: { id: true } } } } },
    });
  }

  findById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      include: { teamNode: { include: { children: { where: { active: true }, select: { id: true } } } } },
    });
  }

  toPublicUser(user: UserRecord) {
    const teamNode = user.teamNode
      ? { id: user.teamNode.id, name: user.teamNode.name, title: user.teamNode.title, parentId: user.teamNode.parentId }
      : null;
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      isSuperuser: user.isSuperuser,
      teamNodeId: user.teamNodeId,
      teamNode,
      canViewTeam: user.isSuperuser || Boolean(user.teamNode?.children?.length),
      canManageSettings: user.isSuperuser,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
