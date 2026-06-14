import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";
import { seedTestDb, TEST_USER_IDS } from "./seed-test-db";

function alignWorkspaceFixtureDates(workspaceRoot: string) {
  const now = new Date();
  const anchor = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 15, 12, 0, 0));
  const created = new Date(anchor);
  created.setUTCDate(5);
  const completed = new Date(anchor);
  completed.setUTCDate(10);
  const due = new Date(anchor);
  due.setUTCDate(20);
  const iso = (value: Date) => value.toISOString();
  const dateOnly = (value: Date) => value.toISOString().slice(0, 10);

  const patchTaskDates = (filePath: string, taskId: string) => {
    if (!existsSync(filePath)) return;
    let content = readFileSync(filePath, "utf8");
    const blockRe = new RegExp(`(- \\[[ x]\\][\\s\\S]*?Id: ${taskId}[\\s\\S]*?)(?=\\n- \\[|$)`);
    const match = content.match(blockRe);
    if (!match) return;
    let block = match[1];
    block = block.replace(/Created: [^\n]+/, `Created: ${iso(created)}`);
    block = block.replace(/Updated: [^\n]+/, `Updated: ${iso(completed)}`);
    if (/Completed:/.test(block)) {
      block = block.replace(/Completed: [^\n]+/, `Completed: ${iso(completed)}`);
    }
    if (/Due:/.test(block)) {
      block = block.replace(/Due: [^\n]+/, `Due: ${dateOnly(due)}`);
    }
    content = content.replace(match[1], block);
    writeFileSync(filePath, content);
  };

  patchTaskDates(join(workspaceRoot, "people", TEST_USER_IDS.manager, "tasks.md"), "task_product_onboarding_wiki_scope");
  patchTaskDates(join(workspaceRoot, "people", "alex-chen", "tasks.md"), "task_alex_llm_wiki_console_states");
  patchTaskDates(join(workspaceRoot, "people", TEST_USER_IDS.sam, "tasks.md"), "task_sam_vault_path_guards");
}

describe("Mira Nest API", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let token: string;
  const apiRoot = join(__dirname, "..");
  const repoRoot = join(apiRoot, "..", "..");
  const dbPath = join(apiRoot, "tmp", "test.sqlite");
  const wikiRoot = join(apiRoot, "tmp", "wiki");
  const workspaceRoot = join(apiRoot, "tmp", "workspace");
  const llmConfigRoot = join(apiRoot, "tmp", "llm-config");
  const reportHistoryRoot = join(apiRoot, "tmp", "report-history");
  const reportStyleRoot = join(apiRoot, "tmp", "report-style");

  beforeAll(async () => {
    mkdirSync(join(apiRoot, "tmp"), { recursive: true });
    rmSync(dbPath, { force: true });
    rmSync(wikiRoot, { force: true, recursive: true });
    rmSync(workspaceRoot, { force: true, recursive: true });
    rmSync(llmConfigRoot, { force: true, recursive: true });
    rmSync(reportHistoryRoot, { force: true, recursive: true });
    rmSync(reportStyleRoot, { force: true, recursive: true });
    cpSync(join(repoRoot, "mira-workspace", "workspace"), workspaceRoot, { recursive: true });
    renameSync(join(workspaceRoot, "people", TEST_USER_IDS.alex), join(workspaceRoot, "people", "alex-chen"));
    alignWorkspaceFixtureDates(workspaceRoot);
    process.env.MIRA_DATABASE_URL = `file:${dbPath}`;
    process.env.DATABASE_URL = `file:${dbPath}`;
    process.env.MIRA_WIKI_ROOT = wikiRoot;
    process.env.MIRA_WORKSPACE_ROOT = workspaceRoot;
    process.env.MIRA_LLM_CONFIG_ROOT = llmConfigRoot;
    process.env.MIRA_REPORT_HISTORY_ROOT = reportHistoryRoot;
    process.env.MIRA_REPORT_STYLE_ROOT = reportStyleRoot;
    process.env.MIRA_JWT_SECRET = "test-secret";
    process.env.MIRA_SKIP_DEMO_SEED = "1";

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
    rmSync(llmConfigRoot, { force: true, recursive: true });
    rmSync(reportHistoryRoot, { force: true, recursive: true });
    rmSync(reportStyleRoot, { force: true, recursive: true });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete process.env.MIRA_AI_PROVIDER;
    delete process.env.MIRA_AI_API_KEY;
    delete process.env.MIRA_AI_BASE_URL;
    delete process.env.MIRA_AI_MODEL;
    delete process.env.MIRA_AI_TIMEOUT_MS;
    delete process.env.MIRA_AI_PROXY;
    rmSync(llmConfigRoot, { force: true, recursive: true });
    process.env.MIRA_WIKI_ROOT = wikiRoot;
    process.env.MIRA_WORKSPACE_ROOT = workspaceRoot;
    process.env.MIRA_LLM_CONFIG_ROOT = llmConfigRoot;
    process.env.MIRA_REPORT_HISTORY_ROOT = reportHistoryRoot;
    process.env.MIRA_REPORT_STYLE_ROOT = reportStyleRoot;
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

  it("lets each user manage redacted personal LLM configuration", async () => {
    const managerLogin = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email: "manager@mira.local", password: "password123" })
      .expect(201);
    const managerToken = managerLogin.body.accessToken;

    const managerDefaults = await request(app.getHttpServer())
      .get("/me/settings/llm-config")
      .set("Authorization", `Bearer ${managerToken}`)
      .expect(200);
    expect(managerDefaults.body.hasApiKey).toBe(false);

    const saved = await request(app.getHttpServer())
      .patch("/me/settings/llm-config")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({
        provider: "openrouter",
        apiKey: "saved-key",
        baseUrl: "https://openrouter.ai/api/v1",
        model: "openrouter/test-model",
        maxTokens: 1234,
        timeoutMs: 5000,
        proxy: "off",
      })
      .expect(200);

    expect(saved.body).toMatchObject({
      provider: "openrouter",
      baseUrl: "https://openrouter.ai/api/v1",
      model: "openrouter/test-model",
      maxTokens: 1234,
      timeoutMs: 5000,
      proxy: "off",
      hasApiKey: true,
      source: "file",
    });
    expect(saved.body.apiKey).toBeUndefined();
    expect(readFileSync(join(llmConfigRoot, `${TEST_USER_IDS.manager}.json`), "utf8")).toContain("saved-key");

    const adminConfig = await request(app.getHttpServer())
      .get("/me/settings/llm-config")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(adminConfig.body.hasApiKey).toBe(false);

    const cleared = await request(app.getHttpServer())
      .patch("/me/settings/llm-config")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ clearApiKey: true })
      .expect(200);
    expect(cleared.body.hasApiKey).toBe(false);
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
  });

  it("scopes personal and team views from the tree rather than role labels", async () => {
    const managerLogin = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email: "manager@mira.local", password: "password123" })
      .expect(201);
    const managerToken = managerLogin.body.accessToken;

    expect(managerLogin.body.user.role).toBe("Team Leader");
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

    expect(alexLogin.body.user.role).toBe("Consultant");
    expect(alexLogin.body.user.canViewTeam).toBe(false);
    expect(existsSync(join(workspaceRoot, "people", TEST_USER_IDS.alex))).toBe(true);
    expect(existsSync(join(workspaceRoot, "people", "alex-chen"))).toBe(false);

    alignWorkspaceFixtureDates(workspaceRoot);

    const managerWork = await request(app.getHttpServer()).get("/me/work?period=monthly").set("Authorization", `Bearer ${managerToken}`).expect(200);
    expect(managerWork.body.tasks[0].ownerUserId).toBe(TEST_USER_IDS.manager);
    expect(managerWork.body.tasks.map((task: { title: string }) => task.title)).toContain("Review onboarding wiki scope");
    expect(managerWork.body.tasks.map((task: { title: string }) => task.title)).not.toContain("Polish LLM Wiki console states");

    const managerTeam = await request(app.getHttpServer()).get("/me/team-view?period=monthly").set("Authorization", `Bearer ${managerToken}`).expect(200);
    const teamTitles = managerTeam.body.tasks.map((task: { title: string }) => task.title);
    expect(teamTitles).toContain("Polish LLM Wiki console states");
    expect(teamTitles).toContain("Validate vault path traversal guards");
    expect(teamTitles).not.toContain("Review onboarding wiki scope");

    await request(app.getHttpServer()).get("/me/team-view?period=monthly").set("Authorization", `Bearer ${alexToken}`).expect(403);
    await request(app.getHttpServer()).get("/tasks").set("Authorization", `Bearer ${managerToken}`).expect(403);
  });

  it("generates period reports and imports cold-start missions", async () => {
    const managerLogin = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email: "lead@example.com", password: "new-password-123" })
      .expect(201);
    const managerToken = managerLogin.body.accessToken;
    const alexLogin = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email: "alex@mira.local", password: "password123" })
      .expect(201);
    const alexToken = alexLogin.body.accessToken;

    process.env.MIRA_AI_PROVIDER = "openai";
    process.env.MIRA_AI_API_KEY = "test-key";
    process.env.MIRA_AI_BASE_URL = "https://ai.example/v1";
    process.env.MIRA_AI_MODEL = "test-model";
    process.env.MIRA_AI_PROXY = "off";

    const profileBefore = await request(app.getHttpServer())
      .get("/me/reports/profile")
      .set("Authorization", `Bearer ${managerToken}`)
      .expect(200);
    expect(profileBefore.body.ready).toBe(false);

    await request(app.getHttpServer())
      .post("/me/reports/generate")
      .set("Authorization", `Bearer ${alexToken}`)
      .send({ period: "weekly", scope: "team", language: "en" })
      .expect(403);

    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({
        choices: [{ message: { content: "# Weekly Report\n\n## Completed\n\nImported work." } }],
      }),
    } as Response);

    const generated = await request(app.getHttpServer())
      .post("/me/reports/generate")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ period: "weekly", scope: "personal", language: "en" })
      .expect(201);
    expect(generated.body.answer).toContain("Weekly Report");
    expect(generated.body.period).toBe("weekly");
    expect(generated.body.scope).toBe("personal");

    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
          choices: [{
            message: {
              content: JSON.stringify({
                missions: [{
                  title: "Delivered client workshop",
                  details: "Facilitated discovery session",
                  completedAt: "2026-05-10",
                  weekOf: "2026-05-05",
                  confidence: 0.9,
                }],
              }),
            },
          }],
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
          choices: [{
            message: {
              content: JSON.stringify({
                toneSummary: "Concise consulting weekly tone",
                structurePatterns: ["本周主要工作"],
                vocabularyHints: ["交付"],
                exampleExcerpt: "本周完成了客户工作坊。",
              }),
            },
          }],
        }),
      } as Response);

    await request(app.getHttpServer())
      .post("/me/reports/cold-start/upload")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({
        files: [{
          filename: "week-2026-05-10.md",
          content: "# Weekly Report\n\n- Delivered client workshop\n",
        }],
      })
      .expect(201);

    const processed = await request(app.getHttpServer())
      .post("/me/reports/cold-start/process")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ language: "zh" })
      .expect(201);
    expect(processed.body.imported).toBeGreaterThan(0);
    expect(processed.body.profileReady).toBe(true);

    const profileAfter = await request(app.getHttpServer())
      .get("/me/reports/profile")
      .set("Authorization", `Bearer ${managerToken}`)
      .expect(200);
    expect(profileAfter.body.ready).toBe(true);
    expect(profileAfter.body.sampleCount).toBeGreaterThan(0);

    const managerTasks = readFileSync(join(workspaceRoot, "people", TEST_USER_IDS.manager, "tasks.md"), "utf8");
    expect(managerTasks).toContain("Delivered client workshop");
    expect(existsSync(join(reportStyleRoot, TEST_USER_IDS.manager, "profile.json"))).toBe(true);
  });

  it("refines daily todos and report drafts via AI endpoints", async () => {
    const alexLogin = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email: "alex@mira.local", password: "password123" })
      .expect(201);
    const alexToken = alexLogin.body.accessToken;

    process.env.MIRA_AI_PROVIDER = "openai";
    process.env.MIRA_AI_API_KEY = "test-key";
    process.env.MIRA_AI_BASE_URL = "https://ai.example/v1";
    process.env.MIRA_AI_MODEL = "test-model";
    process.env.MIRA_AI_PROXY = "off";

    const fetchMock = jest.spyOn(global, "fetch")
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
          choices: [{
            message: {
              content: JSON.stringify({
                assistantMessage: "Here are focused todos for today.",
                suggestions: [{ title: "Review client deck", details: "Finalize slides" }],
              }),
            },
          }],
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
          choices: [{ message: { content: "# Daily Report\n\nUpdated draft." } }],
        }),
      } as Response);

    const taskRefine = await request(app.getHttpServer())
      .post("/me/tasks/ai-refine")
      .set("Authorization", `Bearer ${alexToken}`)
      .send({
        language: "en",
        messages: [{ role: "user", content: "Generate today's todos" }],
      })
      .expect(201);
    expect(taskRefine.body.assistantMessage).toContain("today");
    expect(taskRefine.body.suggestions[0].title).toBe("Review client deck");

    await request(app.getHttpServer())
      .post("/me/tasks/ai-refine")
      .set("Authorization", `Bearer ${alexToken}`)
      .send({ language: "en", scope: "team", messages: [{ role: "user", content: "Team todos" }] })
      .expect(403);

    const reportRefine = await request(app.getHttpServer())
      .post("/me/reports/refine")
      .set("Authorization", `Bearer ${alexToken}`)
      .send({
        language: "en",
        period: "daily",
        draft: "# Draft\n\nOriginal.",
        message: "Add a highlights section",
      })
      .expect(201);
    expect(reportRefine.body.revisedDraft).toContain("Daily Report");
    expect(reportRefine.body.assistantMessage).toBeTruthy();

    fetchMock.mockRestore();
  });

  it("lists report sources, generates with selection, and returns work archive", async () => {
    const alexLogin = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email: "alex@mira.local", password: "password123" })
      .expect(201);
    const alexToken = alexLogin.body.accessToken;

    const archive = await request(app.getHttpServer())
      .get("/me/work/archive")
      .set("Authorization", `Bearer ${alexToken}`)
      .expect(200);
    expect(Array.isArray(archive.body.weeks)).toBe(true);
    expect(Array.isArray(archive.body.projects)).toBe(true);

    const sources = await request(app.getHttpServer())
      .get("/me/reports/sources?period=weekly")
      .set("Authorization", `Bearer ${alexToken}`)
      .expect(200);
    expect(Array.isArray(sources.body.tasks)).toBe(true);
    expect(sources.body.period).toBe("weekly");

    process.env.MIRA_AI_PROVIDER = "openai";
    process.env.MIRA_AI_API_KEY = "test-key";
    process.env.MIRA_AI_BASE_URL = "https://ai.example/v1";
    process.env.MIRA_AI_MODEL = "test-model";
    process.env.MIRA_AI_PROXY = "off";

    const taskIds = sources.body.tasks.slice(0, 1).map((t: { id: string }) => t.id);
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({
        choices: [{ message: { content: "# Selected Report\n\nOnly chosen items." } }],
      }),
    } as Response);

    const generated = await request(app.getHttpServer())
      .post("/me/reports/generate")
      .set("Authorization", `Bearer ${alexToken}`)
      .send({
        period: "weekly",
        language: "en",
        includedTaskIds: taskIds,
        includedNoteIds: [],
        stylePreset: "concise",
      })
      .expect(201);
    expect(generated.body.answer).toContain("Selected Report");

    fetchMock.mockRestore();
  });
});
