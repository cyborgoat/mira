import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

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
}
