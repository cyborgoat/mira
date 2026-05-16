import { Injectable, OnModuleInit } from "@nestjs/common";
import { Prisma, User } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class UsersService implements OnModuleInit {
  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.ensureWorkspaceBootstrapData();
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

  toPublicUser(user: User & { teamNode?: { id: string; name: string; title: string | null; parentId: string | null; children?: Array<{ id: string }> } | null }) {
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

  private async ensureWorkspaceBootstrapData() {
    const password = process.env.MIRA_SUPERUSER_PASSWORD || "local-password";
    const passwordHash = await bcrypt.hash(password, 12);

    const root = await this.upsertNode({
      id: "node_root",
      name: "Mira Team",
      title: "Organization",
      parentId: null,
      sortOrder: 0,
    });
    const manager = await this.upsertNode({
      id: "node_manager",
      name: "Product Engineering",
      title: "Engineering Manager",
      parentId: root.id,
      sortOrder: 1,
    });
    const alex = await this.upsertNode({
      id: "node_alex",
      name: "Alex Chen",
      title: "Frontend Engineer",
      parentId: manager.id,
      sortOrder: 1,
    });
    const sam = await this.upsertNode({
      id: "node_sam",
      name: "Sam Rivera",
      title: "Backend Engineer",
      parentId: manager.id,
      sortOrder: 2,
    });

    await this.upsertUser({
      id: "usr_superuser",
      email: (process.env.MIRA_SUPERUSER_EMAIL || "admin@mira.local").toLowerCase(),
      passwordHash,
      role: "System Owner",
      isSuperuser: true,
      teamNodeId: root.id,
    });
    await this.upsertUser({
      id: "usr_manager",
      email: "manager@mira.local",
      passwordHash,
      role: "Engineering Lead",
      isSuperuser: false,
      teamNodeId: manager.id,
    });
    await this.upsertUser({
      id: "usr_alex",
      email: "alex@mira.local",
      passwordHash,
      role: "Frontend Specialist",
      isSuperuser: false,
      teamNodeId: alex.id,
    });
    await this.upsertUser({
      id: "usr_sam",
      email: "sam@mira.local",
      passwordHash,
      role: "Platform Specialist",
      isSuperuser: false,
      teamNodeId: sam.id,
    });
  }

  private upsertNode(data: { id: string; name: string; title: string; parentId: string | null; sortOrder: number }) {
    return this.prisma.teamNode.upsert({
      where: { id: data.id },
      update: {
        name: data.name,
        title: data.title,
        parentId: data.parentId,
        sortOrder: data.sortOrder,
        active: true,
      },
      create: {
        id: data.id,
        name: data.name,
        title: data.title,
        parentId: data.parentId,
        sortOrder: data.sortOrder,
      },
    });
  }

  private upsertUser(data: Prisma.UserUncheckedCreateInput) {
    return this.prisma.user.upsert({
      where: { email: data.email },
      update: {
        passwordHash: data.passwordHash,
        role: data.role,
        isSuperuser: data.isSuperuser,
        teamNodeId: data.teamNodeId,
      },
      create: data,
    });
  }
}
