# Mira

Mira is an API-backed work workspace for tasks, Markdown notes, team visibility, an LLM-maintained wiki, and a single Ask Mira chat portal over workspace knowledge.

The current app uses a NestJS API, SQLite via Prisma, and a React/Vite frontend. Browser storage only keeps the API access token.

## App Tabs

- **Stats**: the main work overview. Shows task/note metrics, period summaries, Markdown export, and achievement cards.
- **Tasks**: create, edit, complete, delete, search, prioritize, and track due dates for the signed-in user's own node.
- **Notes**: create Markdown notes, tag them, preview them, upload `.md`, `.markdown`, or `.txt` files, save edits, and delete notes.
- **LLM Wiki**: generate and modify personal or team wiki pages from workspace records and uploaded source files. It is for wiki maintenance, not chat.
- **Ask Mira**: the only LLM question-answering portal. It can answer from wiki pages, tasks, notes, source files, and team information, with source cards.
- **Settings**: account profile, language, password, personal LLM configuration, plus superuser team-tree and workspace JSON tools.

Personal/team scope is controlled from the top navbar. Personal view only shows the signed-in user's content. Team view is read-only and available when the user's team node has descendants.

## Instant Quickstart

Prerequisites:

- Node.js 20 or newer
- npm
- Rust and Cargo for Tauri dependencies

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

Demo accounts all use `local-password`:

```text
manager@mira.local  # has read-only team view
alex@mira.local     # personal mode
sam@mira.local      # personal mode
admin@mira.local    # superuser settings access
```

## Routes

Mira uses hash routes:

```text
/#stats
/#tasks
/#notes
/#llm-wiki
/#ask-mira
/#settings
```

`/#stats` is the default route.

## AI Setup

The app starts without an AI key. Tasks, notes, stats, settings, and existing wiki browsing still work.

To use LLM Wiki generation, source ingestion, linting, and Ask Mira answers, sign in as any user and open:

```text
Settings -> LLM config
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

Default wiki/workspace content lives in:

```text
mira-workspace/workspace/
mira-workspace/llm-wiki/
```

Optional wiki/workspace limits:

```text
MIRA_WIKI_MAX_SOURCE_BYTES=1000000
MIRA_WIKI_SOURCE_PROMPT_CHARS=60000
MIRA_WIKI_CONTEXT_CHARS=90000
```

Example source files for LLM Wiki uploads live in:

```text
mira-workspace/examples/llm-wiki/sources/
```

## Desktop App

Mira includes a Tauri desktop shell that launches the NestJS API as a local sidecar and loads the Vite frontend.

Additional prerequisites:

- Rust and Cargo
- Tauri platform prerequisites for your OS

Development:

```bash
npm run dev:desktop
```

Production builds:

```bash
npm run build:desktop
npm run build:desktop:mac
npm run build:desktop:windows
npm run build:desktop:linux
```

The Tauri sidecar build generates platform-suffixed API binaries under `apps/web/src-tauri/binaries/`. Those generated binaries are ignored by git.

## Build And Test

```bash
npm run build:api
npm run test:api
npm run build:web
npm run build:desktop
```

## Architecture

Frontend:

```text
apps/web/src/main.tsx          # bootstrap only
apps/web/src/app/App.tsx       # shell, nav, routing
apps/web/src/app/useMiraApi.ts # API client hook
apps/web/src/app/pages/        # tab pages
apps/web/src/app/shared.tsx    # shared UI helpers
apps/web/src/app/helpers.ts    # formatting, stats, markdown helpers
apps/web/src/i18n.ts
apps/web/src/styles.css
```

Backend:

```text
apps/api/src/main.ts
apps/api/src/bootstrap/
apps/api/src/auth/
apps/api/src/me/
apps/api/src/ai/
apps/api/src/workspace-content/
apps/api/prisma/schema.prisma
```

The backend exposes auth, personal work, team view, profile/password settings, LLM Wiki generation/modification, Ask Mira, superuser team-tree CRUD, and workspace import/export tools.

## Data

Default local SQLite database:

```text
mira-workspace/mira-api.sqlite3
```

Default markdown workspace and wiki content:

```text
mira-workspace/workspace/
mira-workspace/llm-wiki/
```

Set `MIRA_DATABASE_URL`, `MIRA_WORKSPACE_ROOT`, or `MIRA_WIKI_ROOT` to move runtime data outside the repository. Use absolute paths for root overrides in `apps/api/.env`.

Personal LLM provider settings are stored under `mira-workspace/config/llm/` by default. They can include API keys, so that directory is intentionally ignored.
