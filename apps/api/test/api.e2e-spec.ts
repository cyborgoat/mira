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

  afterEach(() => {
    jest.restoreAllMocks();
    delete process.env.MIRA_AI_PROVIDER;
    delete process.env.MIRA_AI_API_KEY;
    delete process.env.MIRA_AI_BASE_URL;
    delete process.env.MIRA_AI_MODEL;
    delete process.env.MIRA_AI_TIMEOUT_MS;
  });

  it("logs in with the seeded superuser", async () => {
    const response = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email: "admin@example.com", password: "password123" })
      .expect(201);

    expect(response.body.user.isSuperuser).toBe(true);
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
      .send({ ownerNodeId: child.id, title: "Ship API", details: "NestJS service", priority: "high", dueDate: new Date().toISOString() })
      .expect(201);

    await request(app.getHttpServer())
      .post("/notes")
      .set("Authorization", `Bearer ${token}`)
      .send({ ownerNodeId: child.id, title: "Planning", date: new Date().toISOString(), content: "Team mode", tags: "planning,api" })
      .expect(201);

    const self = await request(app.getHttpServer()).get(`/tasks?nodeId=${root.id}&scope=self`).set("Authorization", `Bearer ${token}`).expect(200);
    expect(self.body).toHaveLength(0);

    const tree = await request(app.getHttpServer()).get(`/tasks?nodeId=${root.id}&scope=tree`).set("Authorization", `Bearer ${token}`).expect(200);
    expect(tree.body).toHaveLength(1);
    expect(tree.body[0].priority).toBe("high");
    expect(tree.body[0].dueDate).toBeTruthy();

    const view = await request(app.getHttpServer()).get(`/team/view?nodeId=${root.id}&period=weekly`).set("Authorization", `Bearer ${token}`).expect(200);
    expect(view.body.stats.totalTasks).toBe(1);
    expect(view.body.stats.notes).toBe(1);
  });

  it("scopes personal and team views from the tree rather than role labels", async () => {
    const managerLogin = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email: "manager@mira.local", password: "password123" })
      .expect(201);
    const managerToken = managerLogin.body.accessToken;

    expect(managerLogin.body.user.role).toBe("Engineering Lead");
    expect(managerLogin.body.user.isSuperuser).toBe(false);
    expect(managerLogin.body.user.canViewTeam).toBe(true);

    const updatedProfile = await request(app.getHttpServer())
      .patch("/me/profile")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ name: "Product Lead", email: "lead@example.com", role: "Delivery Owner" })
      .expect(200);
    expect(updatedProfile.body.email).toBe("lead@example.com");
    expect(updatedProfile.body.role).toBe("Delivery Owner");
    expect(updatedProfile.body.teamNode.name).toBe("Product Lead");

    await request(app.getHttpServer())
      .patch("/me/password")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ currentPassword: "password123", newPassword: "new-password-123" })
      .expect(200);
    await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email: "lead@example.com", password: "new-password-123" })
      .expect(201);

    const alexLogin = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email: "alex@mira.local", password: "password123" })
      .expect(201);
    const alexToken = alexLogin.body.accessToken;

    expect(alexLogin.body.user.role).toBe("Frontend Specialist");
    expect(alexLogin.body.user.canViewTeam).toBe(false);

    const managerWork = await request(app.getHttpServer()).get("/me/work?period=monthly").set("Authorization", `Bearer ${managerToken}`).expect(200);
    expect(managerWork.body.tasks.map((task: { title: string }) => task.title)).toContain("Review team roadmap");
    expect(managerWork.body.tasks.map((task: { title: string }) => task.title)).not.toContain("Polish dashboard layout");

    await request(app.getHttpServer())
      .post("/me/notes")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ title: "First new note", date: new Date().toISOString(), content: "First body", tags: "regression" })
      .expect(201);
    await request(app.getHttpServer())
      .post("/me/notes")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ title: "Second new note", date: new Date().toISOString(), content: "Second body", tags: "regression" })
      .expect(201);
    const managerNotes = await request(app.getHttpServer()).get("/me/work?period=monthly").set("Authorization", `Bearer ${managerToken}`).expect(200);
    const noteTitles = managerNotes.body.notes.map((note: { title: string }) => note.title);
    expect(noteTitles).toContain("First new note");
    expect(noteTitles).toContain("Second new note");

    const managerTeam = await request(app.getHttpServer()).get("/me/team-view?period=monthly").set("Authorization", `Bearer ${managerToken}`).expect(200);
    const teamTitles = managerTeam.body.tasks.map((task: { title: string }) => task.title);
    expect(teamTitles).toContain("Polish dashboard layout");
    expect(teamTitles).toContain("Add scoped API tests");
    expect(teamTitles).not.toContain("Review team roadmap");

    await request(app.getHttpServer())
      .post("/me/ai-summary")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ mode: "personal", language: "en" })
      .expect(503);

    process.env.MIRA_AI_PROVIDER = "openai";
    process.env.MIRA_AI_API_KEY = "test-key";
    process.env.MIRA_AI_BASE_URL = "https://ai.example/v1";
    process.env.MIRA_AI_MODEL = "test-model";
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({
        choices: [{
          message: {
            content: JSON.stringify({
              accomplishments: { title: "Accomplishments", items: ["Finished focused work."] },
              workStyle: { title: "Work style", items: ["Uses written planning evidence."] },
              recommendations: { title: "Recommendations", items: ["Keep clarifying owners."] },
              risks: { title: "Risks", items: ["Watch overdue work."] },
              evidence: { title: "Evidence", items: ["Weekly task and note records."] },
            }),
          },
        }],
      }),
    } as Response);

    const personalSummary = await request(app.getHttpServer())
      .post("/me/ai-summary")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ mode: "personal", language: "en" })
      .expect(201);
    expect(personalSummary.body.sections.accomplishments.items[0]).toBe("Finished focused work.");
    let aiBody = JSON.parse((fetchMock.mock.calls.at(-1)?.[1] as RequestInit).body as string);
    expect(fetchMock.mock.calls.at(-1)?.[0]).toBe("https://ai.example/v1/chat/completions");
    expect(aiBody.model).toBe("test-model");
    expect(aiBody.messages[1].content).toContain("Review team roadmap");
    expect(aiBody.messages[1].content).not.toContain("Polish dashboard layout");

    const alexSummary = await request(app.getHttpServer())
      .post("/me/ai-summary")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ mode: "team", targetNodeId: "node_alex", targetScope: "person", language: "en" })
      .expect(201);
    expect(alexSummary.body.target.name).toBe("Alex Chen");
    expect(alexSummary.body.target.scope).toBe("person");
    aiBody = JSON.parse((fetchMock.mock.calls.at(-1)?.[1] as RequestInit).body as string);
    expect(aiBody.messages[1].content).toContain("Polish dashboard layout");
    expect(aiBody.messages[1].content).not.toContain("Add scoped API tests");

    await request(app.getHttpServer()).get("/me/team-view?period=monthly").set("Authorization", `Bearer ${alexToken}`).expect(403);
    await request(app.getHttpServer())
      .post("/me/ai-summary")
      .set("Authorization", `Bearer ${alexToken}`)
      .send({ mode: "team", targetNodeId: "node_sam", targetScope: "person", language: "en" })
      .expect(403);
    await request(app.getHttpServer()).get("/tasks").set("Authorization", `Bearer ${managerToken}`).expect(403);
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
      role TEXT,
      isSuperuser BOOLEAN NOT NULL DEFAULT false,
      teamNodeId TEXT,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME NOT NULL,
      CONSTRAINT User_teamNodeId_fkey FOREIGN KEY (teamNodeId) REFERENCES TeamNode (id) ON DELETE SET NULL ON UPDATE CASCADE
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
      priority TEXT NOT NULL DEFAULT 'normal',
      dueDate DATETIME,
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
      tags TEXT NOT NULL DEFAULT '',
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME NOT NULL,
      CONSTRAINT MeetingNote_ownerNodeId_fkey FOREIGN KEY (ownerNodeId) REFERENCES TeamNode (id) ON DELETE RESTRICT ON UPDATE CASCADE
    )
  `);
  await client.$disconnect();
}
