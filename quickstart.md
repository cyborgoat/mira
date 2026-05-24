# Mira Quickstart

This guide starts Mira from a fresh clone with local SQLite, seeded demo users, the NestJS API, and the Vite web app.

## Prerequisites

- Node.js 20 or newer
- npm
- Rust and Cargo for Tauri dependencies

Check versions:

```bash
node --version
npm --version
```

## 1. Install Dependencies

From the repository root:

```bash
npm run install
```

## 2. Create Local API Environment

```bash
cp apps/api/.env.example apps/api/.env
```

The copied file works for local non-AI workflows. It uses:

```text
admin@mira.local
local-password
```

For a stronger local JWT secret:

```bash
openssl rand -hex 32
```

Paste the result into `MIRA_JWT_SECRET` in `apps/api/.env`.

## 3. Prepare The Database

```bash
npm run db:api
```

This creates or updates the local SQLite database and seeds demo accounts.

Default database path:

```text
mira-workspace/mira-api.sqlite3
```

Demo accounts:

```text
manager@mira.local  # has read-only team view
alex@mira.local     # personal mode
sam@mira.local      # personal mode
admin@mira.local    # superuser settings access
```

All demo accounts use:

```text
local-password
```

## 4. Start The API

Open terminal 1:

```bash
npm run dev:api
```

API URL:

```text
http://localhost:8000/
```

## 5. Start The Web App

Open terminal 2:

```bash
npm run dev:web
```

Open the URL printed by Vite, usually:

```text
http://localhost:5173/
```

If port `5173` is busy, Vite prints the next available port.

## 6. Sign In And Smoke Test

Use `manager@mira.local` and `local-password`.

Check:

- Stats loads first.
- Top navbar lets you switch Personal/Team view.
- Team view is read-only.
- Tasks and Notes work in personal mode.
- LLM Wiki opens generated pages.
- Ask Mira opens a chat screen.
- Settings lets each user update account details, password, and personal LLM configuration.

Direct routes:

```text
http://localhost:5173/#stats
http://localhost:5173/#tasks
http://localhost:5173/#notes
http://localhost:5173/#llm-wiki
http://localhost:5173/#ask-mira
http://localhost:5173/#settings
```

## Optional: Enable AI Features

Without an AI key, the app still runs. LLM Wiki generation, source ingestion, linting, and Ask Mira answers need a provider configured for the signed-in user.

Open Settings, then use the LLM config tab to save a personal provider, API key, base URL, model, and request limits. Saved personal LLM config files live under `mira-workspace/config/llm/` and are ignored by git because they can contain API keys.

For headless/server fallback config, edit `apps/api/.env`:

```text
MIRA_AI_PROVIDER=openai
MIRA_AI_API_KEY=...
MIRA_AI_BASE_URL=https://api.openai.com/v1
MIRA_AI_MODEL=gpt-5.2
MIRA_AI_MAX_TOKENS=4000
MIRA_AI_TIMEOUT_MS=45000
```

Supported providers:

```text
openai
openrouter
anthropic
custom-openai-compatible
```

AI proxy config:

```text
MIRA_AI_PROXY=       # use system HTTPS_PROXY/https_proxy when present
MIRA_AI_PROXY=off    # bypass proxy
MIRA_AI_PROXY=http://127.0.0.1:7897
```

Restart the API after changing `.env`. Settings UI changes apply to that user's future AI requests without editing `.env`.

Example upload files:

```text
mira-workspace/examples/llm-wiki/sources/
```

## Useful Commands

```bash
npm run dev:api      # Start NestJS API in watch mode
npm run dev:web      # Start Vite dev server
npm run db:api       # Push Prisma schema and seed local data
npm run build:api    # Build the NestJS API
npm run test:api     # Run API tests
npm run build:web    # Type-check and build the frontend
```

## Common Issues

### Web app cannot reach API

Confirm the API is running on `http://localhost:8000/`.

If the API is elsewhere, create `apps/web/.env.local`:

```text
VITE_MIRA_API_URL=http://127.0.0.1:8000
```

Restart Vite after changing it.

### Login fails after changing passwords

Re-run the local seed/database setup:

```bash
npm run db:api
```

Or delete the local SQLite file and run the command again:

```text
mira-workspace/mira-api.sqlite3
```

### AI calls fail with proxy errors

If your shell has `HTTPS_PROXY` set and you do not want to use it:

```text
MIRA_AI_PROXY=off
```

Restart the API.
