# Mira

Mira is a local-first work workspace for **consulting teams**. It combines task management, AI-assisted Q&A over team knowledge, task conflict detection, and a task relationship graph—all backed by a NestJS API, SQLite, and a React/Vite frontend.

The desktop app (Tauri) bundles the API as a sidecar. In the browser dev setup, the frontend talks to a separately running API. The browser only stores the API access token.

## App modules

The shell exposes three sidebar modules plus Settings in the top bar. Default landing page is **Tasks**.

| Module | Route | Description |
| --- | --- | --- |
| **Tasks** | `/#tasks` | Reminders-style task list with quick add, inline **LLM suggestion row** (Tab to accept), and optional AI Refine chat panel. |
| **Report** | `/#report` | Two-pane editor: **select tasks/notes on the left**, auto-generated Markdown preview on the right, style presets (concise / value / effort), and sparkle AI refine chat. |
| **My Work** | `/#my-work` | Week archive cards (W1–W3), project tag cards, and **+** button to upload historical reports (cold-start knowledge base). |
| **Settings** | `/#settings` | Top-bar gear icon only — account profile, password, per-user LLM config, and (for admins) team-tree management plus workspace JSON import/export. |

Legacy hash routes redirect automatically (`/#ask-mira` → Report, `/#report-import` / `/#cold-start` → My Work, etc.).

## Roles and access

Access is **role-based**, not toggled manually. There is no personal/team view switch in the navbar.

Demo org structure (seeded on every API startup):

```text
Mira 咨询团队
└── 咨询项目组 (manager@mira.local — 团队负责人)
    ├── Alex (alex@mira.local — 顾问)
    └── Sam (sam@mira.local — 顾问)
```

| Account | Role | Capabilities |
| --- | --- | --- |
| `manager@mira.local` | 团队负责人 (team leader) | Own tasks, team daily view in My Work, team-scoped report generation/refinement |
| `alex@mira.local` | 顾问 (consultant) | Personal tasks, personal-scoped AI features |
| `sam@mira.local` | 顾问 (consultant) | Same as Alex |
| `admin@mira.local` | 系统管理员 (superuser) | All of the above plus team-tree CRUD in Settings |

All demo accounts use password **`local-password`**. The API upserts these accounts and team nodes on startup so local databases stay in sync with the documented demo data.

## Instant quickstart

Prerequisites:

- Node.js 24 LTS
- npm
- Rust and Cargo (for Tauri desktop builds)

From a fresh clone:

```bash
npm install
cp apps/api/.env.example apps/api/.env
npm run db:api
```

Run the API in one terminal:

```bash
npm run dev:api
```

Run the web app in another terminal:

```bash
npm run dev:web
```

Open the URL printed by Vite, usually:

```text
http://localhost:5173/
```

Sign in with any demo account above. The login screen pre-fills `manager@mira.local` / `local-password`.

### Desktop development

```bash
npm run dev:desktop
```

The Tauri shell spawns the API sidecar on **`http://127.0.0.1:8173`**. The web dev server uses **`http://127.0.0.1:8000`** when run without Tauri.

## AI setup

The app starts without an AI key. Tasks, settings, and non-AI features work immediately.

To enable Ask Mira answers, period reports, cold-start analysis, task clarification prompts, and Mira Inbox lint checks, sign in and open:

```text
Settings → LLM config
```

Saved LLM settings are written per user under:

```text
mira-workspace/config/llm/
```

These files can contain API keys and are ignored by git.

`apps/api/.env` values remain available as a fallback for headless/server deployments:

```text
MIRA_AI_PROVIDER=openai
MIRA_AI_API_KEY=...
MIRA_AI_BASE_URL=https://api.openai.com/v1
MIRA_AI_MODEL=gpt-5.2
MIRA_AI_MAX_TOKENS=4000
MIRA_AI_TIMEOUT_MS=45000
MIRA_AI_PROXY=
```

Supported providers:

```text
openai
openrouter
anthropic
custom-openai-compatible
```

Proxy behavior:

- Empty `MIRA_AI_PROXY`: use system `HTTPS_PROXY` or `https_proxy` when present.
- `MIRA_AI_PROXY=off`: bypass proxy.
- `MIRA_AI_PROXY=http://host:port`: use that proxy.

Optional wiki/workspace limits:

```text
MIRA_WIKI_MAX_SOURCE_BYTES=1000000
MIRA_WIKI_SOURCE_PROMPT_CHARS=60000
MIRA_WIKI_CONTEXT_CHARS=90000
```

Example source files for LLM Wiki ingestion live in:

```text
mira-workspace/examples/llm-wiki/sources/
```

## Report and knowledge base

**Report** (`/#report`) provides a **two-pane** workflow: pick completed tasks and notes on the left, and Mira auto-generates a Markdown preview on the right. Use style chips (concise / value / effort) or the sparkle icon for multi-turn AI refinement.

**My Work** (`/#my-work`) shows **week archive cards** and **project tag cards**, plus a **+** button for the cold-start upload flow.

Team leaders (`canViewTeam`) can choose **personal** or **team** scope on report generation/refinement; consultants always get personal scope only.

Report-related API routes:

```text
GET  /me/reports/sources
POST /me/reports/generate
POST /me/reports/refine
POST /me/reports/cold-start/upload
POST /me/reports/cold-start/process
POST /me/tasks/ai-refine
GET  /me/work/archive
```

On-disk data (gitignored under the workspace root):

```text
mira-workspace/report-history/<user-id>/raw/   # uploaded historical reports
mira-workspace/report-style/<user-id>/profile.json
```

Override with:

```text
MIRA_REPORT_HISTORY_ROOT
MIRA_REPORT_STYLE_ROOT
```

Without an LLM key, report generation and cold-start processing return the same clear error as other AI features—configure **Settings → LLM config** first.

## Desktop app

Mira ships as a Tauri desktop shell that launches the NestJS API as a local sidecar and loads the Vite frontend.

Additional prerequisites:

- Rust and Cargo
- Tauri platform prerequisites for your OS

Production builds:

```bash
npm run build:desktop
npm run build:desktop:mac
npm run build:desktop:windows
npm run build:desktop:linux
```

The sidecar build bundles the API with Node.js 24 LTS and generates platform-suffixed binaries under `apps/web/src-tauri/binaries/`. Those generated binaries are ignored by git.

### Desktop runtime data

When running the packaged app, data lives outside the repository—for example on macOS:

```text
~/Library/Application Support/local.mira.desktop/mira-workspace/
├── mira-api.sqlite3
├── workspace/          # per-person tasks and notes (Markdown)
├── llm-wiki/           # LLM-maintained knowledge base
├── report-history/     # uploaded past reports (cold start)
├── report-style/       # learned report voice profiles
└── config/llm/         # per-user AI provider settings
```

Restart the app after pulling API changes so the sidecar re-seeds demo accounts and syncs workspace profile files.

## Build and test

```bash
npm run build:api
npm run test:api
npm run build:web
npm run build:desktop
```

## Architecture

Frontend:

```text
apps/web/src/main.tsx          # bootstrap
apps/web/src/app/App.tsx       # shell, nav, routing, role-aware layout
apps/web/src/app/useMiraApi.ts # API client hook (port 8173 in Tauri, 8000 in browser)
apps/web/src/app/pages/        # active tab pages
apps/web/src/app/shared.tsx    # login screen, shared UI helpers
apps/web/src/app/helpers.ts    # formatting, stats, markdown helpers
apps/web/src/i18n.ts           # English and Chinese UI strings
apps/web/src/styles.css
apps/web/src-tauri/            # Tauri shell and API sidecar spawn
```

Active page modules: `TasksPage`, `ReportPage`, `MyWorkPage`, `SettingsPage`.

Backend:

```text
apps/api/src/main.ts
apps/api/src/auth/             # JWT login
apps/api/src/me/                 # personal work, team view, reports, tasks
apps/api/src/team/              # team tree CRUD (superuser)
apps/api/src/ai/                 # LLM provider integration
apps/api/src/workspace-content/ # Markdown tasks/notes on disk
apps/api/src/prisma/            # SQLite schema + demo account seeding
apps/api/prisma/schema.prisma
```

## Data

Default local SQLite database (web dev):

```text
mira-workspace/mira-api.sqlite3
```

Default markdown workspace and wiki content:

```text
mira-workspace/workspace/people/<user-id>/   # tasks.md, notes/, person.md
mira-workspace/llm-wiki/
```

Override locations with environment variables:

```text
MIRA_DATABASE_URL
MIRA_WORKSPACE_ROOT
MIRA_WIKI_ROOT
MIRA_LLM_CONFIG_ROOT
MIRA_REPORT_HISTORY_ROOT
MIRA_REPORT_STYLE_ROOT
```

Use absolute paths for root overrides in `apps/api/.env`. The Tauri shell sets these automatically for the desktop data directory.

Personal LLM provider settings are stored under `mira-workspace/config/llm/` by default. They can include API keys, so that directory is intentionally ignored by git.
