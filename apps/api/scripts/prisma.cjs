const { mkdirSync } = require("node:fs");
const { resolve } = require("node:path");
const { spawnSync } = require("node:child_process");

const workspaceDir = resolve(process.cwd(), "../../mira-workspace");
mkdirSync(workspaceDir, { recursive: true });

const env = {
  ...process.env,
  DATABASE_URL:
    process.env.DATABASE_URL ||
    process.env.MIRA_DATABASE_URL ||
    `file:${resolve(workspaceDir, "mira-api.sqlite3")}`,
};

const result = spawnSync("npx", ["prisma", ...process.argv.slice(2), "--schema", "prisma/schema.prisma"], {
  cwd: process.cwd(),
  env,
  stdio: "inherit",
});

process.exit(result.status || 0);
