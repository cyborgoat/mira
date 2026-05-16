import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

function databaseUrl() {
  const configured = process.env.MIRA_DATABASE_URL || process.env.DATABASE_URL;
  if (configured) return configured;

  const workspaceDir = resolve(process.cwd(), "../../mira-workspace");
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
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
