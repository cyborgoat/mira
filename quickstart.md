# Mira Quickstart

This guide runs the current Mira app and the NestJS backend API. The frontend uses the API for login, personal work, subordinate team view, AI summaries, superuser settings, tasks, notes, and stats.

## Prerequisites

- Node.js 20 or newer
- npm

## 1. Install Dependencies

From the repository root:

```bash
npm --prefix apps/web install
npm --prefix apps/api install
```

## 2. Prepare the API Database

From the repository root:

```bash
npm run db:api
```

Seeded mock users all use `local-password`:

```text
manager@mira.local  # has subordinate team view
alex@mira.local     # personal mode only
sam@mira.local      # personal mode only
admin@mira.local    # superuser settings access
```

Override the superuser account with `MIRA_SUPERUSER_EMAIL` and `MIRA_SUPERUSER_PASSWORD`.

## 3. Start the API

```bash
npm run dev:api
```

The API listens on:

```text
http://localhost:8000/
```

## 4. Start the Web App

```bash
npm run dev:web
```

Vite prints the local web URL, usually:

```text
http://localhost:5173/
```

If that port is already in use, Vite will print the next available port.

## 5. Open Tabs Directly

```text
http://localhost:5173/#dashboard
http://localhost:5173/#tasks
http://localhost:5173/#notes
http://localhost:5173/#stats
http://localhost:5173/#ai-summary
http://localhost:5173/#settings
```

Roles and titles are arbitrary text on users/team nodes. Team visibility comes from the tree: a user with children can switch to read-only team view, and team tree administration comes from the separate `isSuperuser` permission. Every signed-in user can use Settings for account details, language, and password updates.

The UI supports English and Chinese. Change language from the login screen or from Settings.

## Runtime Data

The API stores data in the local SQLite database:

```text
mira-workspace/mira-api.sqlite3
```

The browser stores the access token under `mira-api-token-v1`. Signing out clears the token, not the API records.

Set `VITE_MIRA_API_URL` for the web app if the API is not running on `http://127.0.0.1:8000`.

## AI Summary Setup

The AI Summarizer is configured only on the backend through `apps/api/.env`. There is no frontend UI for provider or model settings.

```text
MIRA_AI_PROVIDER=openai
MIRA_AI_API_KEY=...
MIRA_AI_BASE_URL=https://api.openai.com/v1
MIRA_AI_MODEL=gpt-5.2
```

Provider values supported by the API are `openai`, `openrouter`, `anthropic`, and `custom-openai-compatible`. Without `MIRA_AI_API_KEY`, the AI Summary tab will show a backend configuration error when generation is requested.

## Useful Commands

```bash
npm run dev:web      # Start Vite dev server
npm run build:web    # Type-check and build the frontend
npm run dev:api      # Start NestJS API in watch mode
npm run build:api    # Build the NestJS API
npm run test:api     # Run API tests
npm run db:api       # Push Prisma schema to the local database
```
