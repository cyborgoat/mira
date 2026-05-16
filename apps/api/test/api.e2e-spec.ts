import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { PrismaClient } from "@prisma/client";
import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";

describe("Mira Nest API", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let token: string;
  const apiRoot = join(__dirname, "..");
  const dbPath = join(apiRoot, "tmp", "test.sqlite");

  beforeAll(async () => {
    mkdirSync(join(apiRoot, "tmp"), { recursive: true });
    rmSync(dbPath, { force: true });
    process.env.MIRA_DATABASE_URL = `file:${dbPath}`;
    process.env.DATABASE_URL = `file:${dbPath}`;
    process.env.MIRA_SUPERUSER_EMAIL = "admin@example.com";
    process.env.MIRA_SUPERUSER_PASSWORD = "password123";
    process.env.MIRA_JWT_SECRET = "test-secret";

    await createTestSchema(dbPath);

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();

    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app?.close();
    rmSync(dbPath, { force: true });
  });

  it("logs in with the seeded superuser", async () => {
    const response = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email: "admin@example.com", password: "password123" })
      .expect(201);

    expect(response.body.user.role).toBe("superuser");
    expect(response.body.accessToken).toBeTruthy();
    token = response.body.accessToken;
  });

  it("creates a team tree and rejects deleting a node with active children", async () => {
    const manager = await request(app.getHttpServer())
      .post("/team/nodes")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Engineering", title: "Manager" })
      .expect(201);

    await request(app.getHttpServer())
      .post("/team/nodes")
      .set("Authorization", `Bearer ${token}`)
      .send({ parentId: manager.body.id, name: "Frontend", title: "Engineer" })
      .expect(201);

    await request(app.getHttpServer()).delete(`/team/nodes/${manager.body.id}`).set("Authorization", `Bearer ${token}`).expect(409);
  });

  it("creates work records and aggregates team view", async () => {
    const root = await prisma.teamNode.findFirstOrThrow({ where: { name: "Engineering" } });
    const child = await prisma.teamNode.findFirstOrThrow({ where: { name: "Frontend" } });

    await request(app.getHttpServer())
      .post("/tasks")
      .set("Authorization", `Bearer ${token}`)
      .send({ ownerNodeId: child.id, title: "Ship API", details: "NestJS service" })
      .expect(201);

    await request(app.getHttpServer())
      .post("/notes")
      .set("Authorization", `Bearer ${token}`)
      .send({ ownerNodeId: child.id, title: "Planning", date: new Date().toISOString(), content: "Team mode" })
      .expect(201);

    const self = await request(app.getHttpServer()).get(`/tasks?nodeId=${root.id}&scope=self`).expect(200);
    expect(self.body).toHaveLength(0);

    const tree = await request(app.getHttpServer()).get(`/tasks?nodeId=${root.id}&scope=tree`).expect(200);
    expect(tree.body).toHaveLength(1);

    const view = await request(app.getHttpServer()).get(`/team/view?nodeId=${root.id}&period=weekly`).expect(200);
    expect(view.body.stats.totalTasks).toBe(1);
    expect(view.body.stats.notes).toBe(1);
  });
});

async function createTestSchema(dbPath: string) {
  const client = new PrismaClient({
    datasources: {
      db: {
        url: `file:${dbPath}`,
      },
    },
  });
  await client.$connect();
  await client.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS User (
      id TEXT NOT NULL PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      passwordHash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'superuser',
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME NOT NULL
    )
  `);
  await client.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS TeamNode (
      id TEXT NOT NULL PRIMARY KEY,
      parentId TEXT,
      name TEXT NOT NULL,
      title TEXT,
      sortOrder INTEGER NOT NULL DEFAULT 0,
      active BOOLEAN NOT NULL DEFAULT true,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME NOT NULL,
      CONSTRAINT TeamNode_parentId_fkey FOREIGN KEY (parentId) REFERENCES TeamNode (id) ON DELETE SET NULL ON UPDATE CASCADE
    )
  `);
  await client.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS Task (
      id TEXT NOT NULL PRIMARY KEY,
      ownerNodeId TEXT NOT NULL,
      title TEXT NOT NULL,
      details TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'open',
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      completedAt DATETIME,
      updatedAt DATETIME NOT NULL,
      CONSTRAINT Task_ownerNodeId_fkey FOREIGN KEY (ownerNodeId) REFERENCES TeamNode (id) ON DELETE RESTRICT ON UPDATE CASCADE
    )
  `);
  await client.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS MeetingNote (
      id TEXT NOT NULL PRIMARY KEY,
      ownerNodeId TEXT NOT NULL,
      title TEXT NOT NULL,
      date DATETIME NOT NULL,
      content TEXT NOT NULL DEFAULT '',
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME NOT NULL,
      CONSTRAINT MeetingNote_ownerNodeId_fkey FOREIGN KEY (ownerNodeId) REFERENCES TeamNode (id) ON DELETE RESTRICT ON UPDATE CASCADE
    )
  `);
  await client.$disconnect();
}
