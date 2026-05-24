import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync } from "node:fs";
import { join } from "node:path";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";
import { seedTestDb, TEST_USER_IDS } from "./seed-test-db";

describe("Mira Nest API", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let token: string;
  const apiRoot = join(__dirname, "..");
  const repoRoot = join(apiRoot, "..", "..");
  const dbPath = join(apiRoot, "tmp", "test.sqlite");
  const wikiRoot = join(apiRoot, "tmp", "wiki");
  const workspaceRoot = join(apiRoot, "tmp", "workspace");

  beforeAll(async () => {
    mkdirSync(join(apiRoot, "tmp"), { recursive: true });
    rmSync(dbPath, { force: true });
    rmSync(wikiRoot, { force: true, recursive: true });
    rmSync(workspaceRoot, { force: true, recursive: true });
    cpSync(join(repoRoot, "mira-workspace", "workspace"), workspaceRoot, { recursive: true });
    renameSync(join(workspaceRoot, "people", TEST_USER_IDS.alex), join(workspaceRoot, "people", "alex-chen"));
    process.env.MIRA_DATABASE_URL = `file:${dbPath}`;
    process.env.DATABASE_URL = `file:${dbPath}`;
    process.env.MIRA_WIKI_ROOT = wikiRoot;
    process.env.MIRA_WORKSPACE_ROOT = workspaceRoot;
    process.env.MIRA_JWT_SECRET = "test-secret";

    await seedTestDb(dbPath, "password123");

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
    rmSync(wikiRoot, { force: true, recursive: true });
    rmSync(workspaceRoot, { force: true, recursive: true });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete process.env.MIRA_AI_PROVIDER;
    delete process.env.MIRA_AI_API_KEY;
    delete process.env.MIRA_AI_BASE_URL;
    delete process.env.MIRA_AI_MODEL;
    delete process.env.MIRA_AI_TIMEOUT_MS;
    delete process.env.MIRA_AI_PROXY;
    process.env.MIRA_WIKI_ROOT = wikiRoot;
    process.env.MIRA_WORKSPACE_ROOT = workspaceRoot;
  });

  it("logs in with the initial superuser", async () => {
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
    await prisma.user.create({
      data: {
        id: TEST_USER_IDS.frontend,
        email: "frontend@example.com",
        passwordHash: "unused",
        role: "Engineer",
        teamNodeId: child.id,
      },
    });

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
    expect(readFileSync(join(workspaceRoot, "people", TEST_USER_IDS.frontend, "tasks.md"), "utf8")).toContain("Ship API");
    const frontendNotesDir = join(workspaceRoot, "people", TEST_USER_IDS.frontend, "notes");
    expect(existsSync(frontendNotesDir)).toBe(true);
    const noteFiles = readdirSync(frontendNotesDir).filter((file) => file.endsWith(".md"));
    expect(noteFiles).toHaveLength(1);
    expect(readFileSync(join(frontendNotesDir, noteFiles[0]), "utf8")).toContain("Team mode");

    const self = await request(app.getHttpServer()).get(`/tasks?nodeId=${root.id}&scope=self`).set("Authorization", `Bearer ${token}`).expect(200);
    expect(self.body).toHaveLength(0);

    const tree = await request(app.getHttpServer()).get(`/tasks?nodeId=${root.id}&scope=tree`).set("Authorization", `Bearer ${token}`).expect(200);
    expect(tree.body).toHaveLength(1);
    expect(tree.body[0].ownerUserId).toBe(TEST_USER_IDS.frontend);
    expect(tree.body[0].ownerNodeId).toBe(child.id);
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
    expect(existsSync(join(workspaceRoot, "people", TEST_USER_IDS.manager))).toBe(true);
    expect(readFileSync(join(workspaceRoot, "people", TEST_USER_IDS.manager, "person.md"), "utf8")).toContain("# Product Lead");
    expect(readFileSync(join(workspaceRoot, "people", TEST_USER_IDS.manager, "tasks.md"), "utf8")).toContain("Review onboarding wiki scope");

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
    expect(existsSync(join(workspaceRoot, "people", TEST_USER_IDS.alex))).toBe(true);
    expect(existsSync(join(workspaceRoot, "people", "alex-chen"))).toBe(false);

    const managerWork = await request(app.getHttpServer()).get("/me/work?period=monthly").set("Authorization", `Bearer ${managerToken}`).expect(200);
    expect(managerWork.body.tasks[0].ownerUserId).toBe(TEST_USER_IDS.manager);
    expect(managerWork.body.tasks.map((task: { title: string }) => task.title)).toContain("Review onboarding wiki scope");
    expect(managerWork.body.tasks.map((task: { title: string }) => task.title)).not.toContain("Polish LLM Wiki console states");

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
    expect(teamTitles).toContain("Polish LLM Wiki console states");
    expect(teamTitles).toContain("Validate vault path traversal guards");
    expect(teamTitles).not.toContain("Review onboarding wiki scope");

    const emptyWiki = await request(app.getHttpServer())
      .get("/me/llm-wiki")
      .set("Authorization", `Bearer ${managerToken}`)
      .expect(200);
    expect(emptyWiki.body.index).toContain("# Index");
    expect(emptyWiki.body.sources).toEqual([]);

    await request(app.getHttpServer())
      .post("/me/llm-wiki/sources")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ filename: "roadmap.pdf", content: "wrong extension" })
      .expect(400);

    const source = await request(app.getHttpServer())
      .post("/me/llm-wiki/sources")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ filename: "roadmap.md", content: "# Roadmap source\n\nPersistent wiki source only." })
      .expect(201);
    expect(source.body.path).toBe("raw/roadmap.md");

    await request(app.getHttpServer())
      .post("/me/llm-wiki/ingest")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ sourcePath: source.body.path, language: "en" })
      .expect(503);

    process.env.MIRA_AI_PROVIDER = "openai";
    process.env.MIRA_AI_API_KEY = "test-key";
    process.env.MIRA_AI_BASE_URL = "https://ai.example/v1";
    process.env.MIRA_AI_MODEL = "test-model";
    process.env.MIRA_AI_PROXY = "off";
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({
        choices: [{
          message: {
            content: JSON.stringify({
              summary: "Roadmap source ingested.",
              files: [
                { path: "index.md", content: "# Index\n\n- [[Roadmap]]: Persistent wiki source." },
                { path: "pages/roadmap.md", content: "# Roadmap\n\nPersistent wiki source." },
              ],
              logEntry: "ingest | roadmap.md",
            }),
          },
        }],
      }),
    } as Response);

    const generated = await request(app.getHttpServer())
      .post("/me/llm-wiki/generate")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ period: "monthly", scope: "personal", language: "en" })
      .expect(201);
    expect(generated.body.summary).toBe("Roadmap source ingested.");
    let aiBody = JSON.parse((fetchMock.mock.calls.at(-1)?.[1] as RequestInit).body as string);
    expect(aiBody.messages[1].content).toContain("Source name: workspace-personal-monthly");
    expect(aiBody.messages[1].content).toContain("Scope: personal");
    expect(aiBody.messages[1].content).toContain("Review onboarding wiki scope");
    expect(aiBody.messages[1].content).not.toContain("Polish LLM Wiki console states");
    expect(generated.body.referenceStats.tasks).toBeGreaterThan(0);

    const teamGenerated = await request(app.getHttpServer())
      .post("/me/llm-wiki/generate")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ period: "monthly", scope: "team", language: "en" })
      .expect(201);
    expect(teamGenerated.body.referenceStats.tasks).toBeGreaterThan(generated.body.referenceStats.tasks);
    aiBody = JSON.parse((fetchMock.mock.calls.at(-1)?.[1] as RequestInit).body as string);
    expect(aiBody.messages[1].content).toContain("Source name: workspace-team-monthly");
    expect(aiBody.messages[1].content).toContain("Scope: team");
    expect(aiBody.messages[1].content).toContain("Review onboarding wiki scope");
    expect(aiBody.messages[1].content).toContain("Polish LLM Wiki console states");

    const teamStats = await request(app.getHttpServer())
      .get("/me/llm-wiki/reference-stats?period=monthly&scope=team")
      .set("Authorization", `Bearer ${managerToken}`)
      .expect(200);
    expect(teamStats.body.wikiPages).toBeGreaterThan(0);
    expect(teamStats.body.tasks).toBe(teamGenerated.body.referenceStats.tasks);
    expect(teamStats.body.meetingNotes).toBe(teamGenerated.body.referenceStats.meetingNotes);

    await request(app.getHttpServer())
      .post("/me/llm-wiki/generate")
      .set("Authorization", `Bearer ${alexToken}`)
      .send({ period: "monthly", scope: "personal", language: "en" })
      .expect(201);
    aiBody = JSON.parse((fetchMock.mock.calls.at(-1)?.[1] as RequestInit).body as string);
    expect(aiBody.messages[1].content).toContain("Polish LLM Wiki console states");
    expect(aiBody.messages[1].content).not.toContain("Review onboarding wiki scope");

    const owners = await request(app.getHttpServer())
      .get("/me/llm-wiki/owners")
      .set("Authorization", `Bearer ${managerToken}`)
      .expect(200);
    const alexOwner = owners.body.find((owner: { email: string }) => owner.email === "alex@mira.local");
    expect(alexOwner.name).toBe("Alex Chen");

    const alexWiki = await request(app.getHttpServer())
      .get(`/me/llm-wiki?ownerId=${alexOwner.id}`)
      .set("Authorization", `Bearer ${managerToken}`)
      .expect(200);
    expect(alexWiki.body.owner.name).toBe("Alex Chen");
    expect(alexWiki.body.owner.canEdit).toBe(false);
    expect(alexWiki.body.referenceStats.wikiPages).toBeGreaterThan(0);
    expect(alexWiki.body.referenceStats.tasks).toBeGreaterThan(0);

    await request(app.getHttpServer())
      .get(`/me/llm-wiki/pages?ownerId=${alexOwner.id}&path=pages%2Froadmap.md`)
      .set("Authorization", `Bearer ${managerToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .get(`/me/llm-wiki?ownerId=${TEST_USER_IDS.manager}`)
      .set("Authorization", `Bearer ${alexToken}`)
      .expect(403);

    const ingest = await request(app.getHttpServer())
      .post("/me/llm-wiki/ingest")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ sourcePath: source.body.path, language: "en" })
      .expect(201);
    expect(ingest.body.summary).toBe("Roadmap source ingested.");
    expect(ingest.body.writtenPages).toContain("pages/roadmap.md");
    aiBody = JSON.parse((fetchMock.mock.calls.at(-1)?.[1] as RequestInit).body as string);
    expect(fetchMock.mock.calls.at(-1)?.[0]).toBe("https://ai.example/v1/chat/completions");
    expect(aiBody.model).toBe("test-model");
    expect(aiBody.messages[1].content).toContain("Persistent wiki source only.");
    expect(aiBody.messages[1].content).not.toContain("Polish LLM Wiki console states");

    const page = await request(app.getHttpServer())
      .get("/me/llm-wiki/pages?path=pages%2Froadmap.md")
      .set("Authorization", `Bearer ${managerToken}`)
      .expect(200);
    expect(page.body.content).toContain("# Roadmap");

    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({
        choices: [{
          message: {
            content: JSON.stringify({
              answer: "The wiki says the roadmap source is persistent.",
              usedSourceIds: [],
            }),
          },
        }],
      }),
    } as Response);

    const askAnswer = await request(app.getHttpServer())
      .post("/me/ask-mira")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ question: "What does the roadmap source say?", language: "en", scope: "personal" })
      .expect(201);
    expect(askAnswer.body.answer).toContain("persistent");
    expect(Array.isArray(askAnswer.body.sources)).toBe(true);
    expect(askAnswer.body.sources.length).toBeGreaterThan(0);
    aiBody = JSON.parse((fetchMock.mock.calls.at(-1)?.[1] as RequestInit).body as string);
    expect(aiBody.messages[1].content).toContain("Sources:");
    expect(aiBody.messages[1].content).toContain("Roadmap");

    const editedPage = await request(app.getHttpServer())
      .patch("/me/llm-wiki/pages")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ path: "pages/roadmap.md", content: "# Roadmap Answer\n\nEdited owner page." })
      .expect(200);
    expect(editedPage.body.content).toContain("Edited owner page.");

    await request(app.getHttpServer())
      .delete("/me/llm-wiki/pages?path=pages%2Froadmap.md")
      .set("Authorization", `Bearer ${managerToken}`)
      .expect(200);
    await request(app.getHttpServer())
      .get("/me/llm-wiki/pages?path=pages%2Froadmap.md")
      .set("Authorization", `Bearer ${managerToken}`)
      .expect(404);

    await request(app.getHttpServer())
      .get("/me/llm-wiki/pages?path=..%2Fsecret.md")
      .set("Authorization", `Bearer ${managerToken}`)
      .expect(400);

    await request(app.getHttpServer()).get("/me/team-view?period=monthly").set("Authorization", `Bearer ${alexToken}`).expect(403);
    await request(app.getHttpServer()).get("/tasks").set("Authorization", `Bearer ${managerToken}`).expect(403);
  });
});
