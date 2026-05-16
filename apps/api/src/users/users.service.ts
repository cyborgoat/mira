import { Injectable, OnModuleInit } from "@nestjs/common";
import { Prisma, User } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { createId } from "../common/ids";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class UsersService implements OnModuleInit {
  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.ensureSeedSuperuser();
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

  private async ensureSeedSuperuser() {
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

    await this.seedWorkRecords([
      {
        nodeId: manager.id,
        title: "Review team roadmap",
        details: "Prepare staffing risks and delivery priorities for the weekly review.",
        priority: "high",
      },
      {
        nodeId: alex.id,
        title: "Polish dashboard layout",
        details: "Tighten personal work stats and mobile spacing.",
        priority: "normal",
      },
      {
        nodeId: alex.id,
        title: "Close keyboard shortcut bug",
        details: "Ensure save and new actions do not fire while typing in selectors.",
        priority: "urgent",
        complete: true,
      },
      {
        nodeId: sam.id,
        title: "Add scoped API tests",
        details: "Cover manager read-only team view and member personal mode.",
        priority: "high",
      },
      {
        nodeId: sam.id,
        title: "Document seeded users",
        details: "Update quickstart with manager and member test accounts.",
        priority: "low",
        complete: true,
      },
    ]);
    await this.seedNotes([
      {
        nodeId: manager.id,
        title: "Manager weekly sync",
        content: "## Notes\n- Team view should be read-only\n- Main workspace should default to personal work",
        tags: "planning,management",
      },
      {
        nodeId: alex.id,
        title: "Frontend focus",
        content: "## Decisions\n- Move superuser tools into settings\n- Keep work pages quiet and task-focused",
        tags: "frontend,ux",
      },
      {
        nodeId: sam.id,
        title: "API scope notes",
        content: "## Follow-ups\n- Seed mock users\n- Enforce subordinate read scope",
        tags: "backend,api",
      },
    ]);
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

  private async seedWorkRecords(records: Array<{ nodeId: string; title: string; details: string; priority: "low" | "normal" | "high" | "urgent"; complete?: boolean }>) {
    for (const record of records) {
      const existing = await this.prisma.task.findFirst({
        where: { ownerNodeId: record.nodeId, title: record.title },
      });
      if (existing) continue;
      await this.prisma.task.create({
        data: {
          id: createId("task"),
          ownerNodeId: record.nodeId,
          title: record.title,
          details: record.details,
          priority: record.priority,
          dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
          status: record.complete ? "complete" : "open",
          completedAt: record.complete ? new Date() : null,
        },
      });
    }
  }

  private async seedNotes(records: Array<{ nodeId: string; title: string; content: string; tags: string }>) {
    for (const record of records) {
      const existing = await this.prisma.meetingNote.findFirst({
        where: { ownerNodeId: record.nodeId, title: record.title },
      });
      if (existing) continue;
      await this.prisma.meetingNote.create({
        data: {
          id: createId("note"),
          ownerNodeId: record.nodeId,
          title: record.title,
          date: new Date(),
          content: record.content,
          tags: record.tags,
        },
      });
    }
  }
}
