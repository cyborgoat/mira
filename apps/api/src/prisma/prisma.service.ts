import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

const DEMO_PASSWORD = "local-password";

const DEMO_TEAM_NODES = [
  { id: "node_root", parentId: null as string | null, name: "Mira 咨询团队", title: "组织根节点", sortOrder: 0 },
  { id: "node_manager", parentId: "node_root", name: "咨询项目组", title: "团队负责人", sortOrder: 1 },
  { id: "node_alex", parentId: "node_manager", name: "Alex", title: "顾问", sortOrder: 1 },
  { id: "node_sam", parentId: "node_manager", name: "Sam", title: "顾问", sortOrder: 2 },
] as const;

const DEMO_USERS = [
  {
    id: "0fa48143-b9dd-4b8d-843f-0b08feee4689",
    email: "admin@mira.local",
    role: "系统管理员",
    isSuperuser: true,
    teamNodeId: "node_root",
  },
  {
    id: "093c046d-0133-40ef-8eda-ab3b52479161",
    email: "manager@mira.local",
    role: "团队负责人",
    isSuperuser: false,
    teamNodeId: "node_manager",
  },
  {
    id: "bb9cfe4c-5c47-4f21-8287-ee21b1aa5bec",
    email: "alex@mira.local",
    role: "顾问",
    isSuperuser: false,
    teamNodeId: "node_alex",
  },
  {
    id: "a85bcbaf-a380-4e25-8ea8-9ce1b00f11b7",
    email: "sam@mira.local",
    role: "顾问",
    isSuperuser: false,
    teamNodeId: "node_sam",
  },
] as const;

function databaseUrl() {
  const configured = process.env.MIRA_DATABASE_URL || process.env.DATABASE_URL;
  if (configured) return configured;

  const candidates = [
    resolve(process.cwd(), "../../mira-workspace"),
    resolve(process.cwd(), "mira-workspace"),
    resolve(__dirname, "../../../mira-workspace"),
  ];
  const workspaceDir = candidates.find((path) => existsSync(path)) || candidates[0];
  mkdirSync(workspaceDir, { recursive: true });
  return `file:${resolve(workspaceDir, "mira-api.sqlite3")}`;
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super({
      datasources: {
        db: {
          url: databaseUrl(),
        },
      },
    });
  }

  async onModuleInit() {
    await this.$connect();
    await this.ensureSchema();
    if (process.env.NODE_ENV !== "test" && process.env.MIRA_SKIP_DEMO_SEED !== "1") {
      await this.ensureDemoAccounts();
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  private async ensureSchema() {
    await this.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "TeamNode" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "parentId" TEXT,
        "name" TEXT NOT NULL,
        "title" TEXT,
        "sortOrder" INTEGER NOT NULL DEFAULT 0,
        "active" BOOLEAN NOT NULL DEFAULT true,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL,
        CONSTRAINT "TeamNode_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "TeamNode" ("id") ON DELETE SET NULL ON UPDATE CASCADE
      )
    `);
    await this.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "User" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "email" TEXT NOT NULL,
        "passwordHash" TEXT NOT NULL,
        "role" TEXT,
        "isSuperuser" BOOLEAN NOT NULL DEFAULT false,
        "teamNodeId" TEXT,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL,
        CONSTRAINT "User_teamNodeId_fkey" FOREIGN KEY ("teamNodeId") REFERENCES "TeamNode" ("id") ON DELETE SET NULL ON UPDATE CASCADE
      )
    `);
    await this.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email")`);
    await this.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "User_teamNodeId_idx" ON "User"("teamNodeId")`);
    await this.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "TeamNode_parentId_sortOrder_idx" ON "TeamNode"("parentId", "sortOrder")`);
    await this.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "TeamNode_active_idx" ON "TeamNode"("active")`);
  }

  /** Ensure documented demo accounts always exist and use the shared demo password. */
  private async ensureDemoAccounts() {
    const now = new Date().toISOString();
    const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);

    for (const node of DEMO_TEAM_NODES) {
      const existing = await this.teamNode.findUnique({ where: { id: node.id } });
      if (existing) {
        await this.teamNode.update({
          where: { id: node.id },
          data: {
            parentId: node.parentId,
            name: node.name,
            title: node.title,
            sortOrder: node.sortOrder,
            active: true,
            updatedAt: new Date(now),
          },
        });
      } else {
        await this.$executeRawUnsafe(
          `INSERT INTO "TeamNode" ("id","parentId","name","title","sortOrder","active","updatedAt") VALUES (?,?,?,?,?,?,?)`,
          node.id,
          node.parentId,
          node.name,
          node.title,
          node.sortOrder,
          1,
          now,
        );
      }
    }

    for (const demo of DEMO_USERS) {
      const existing = await this.user.findFirst({
        where: { OR: [{ email: demo.email }, { id: demo.id }] },
      });
      if (existing) {
        await this.user.update({
          where: { id: existing.id },
          data: {
            email: demo.email,
            passwordHash,
            role: demo.role,
            isSuperuser: demo.isSuperuser,
            teamNodeId: demo.teamNodeId,
            updatedAt: new Date(now),
          },
        });
      } else {
        await this.$executeRawUnsafe(
          `INSERT INTO "User" ("id","email","passwordHash","role","isSuperuser","teamNodeId","updatedAt") VALUES (?,?,?,?,?,?,?)`,
          demo.id,
          demo.email,
          passwordHash,
          demo.role,
          demo.isSuperuser ? 1 : 0,
          demo.teamNodeId,
          now,
        );
      }
    }
  }
}
