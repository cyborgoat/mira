# Mira Quickstart

This guide runs the current Mira app and the NestJS backend API. The frontend uses the API for login, team tree management, tasks, notes, summaries, and achievements.

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

The default seeded API login is:

```text
admin@mira.local
local-password
```

Override it with `MIRA_SUPERUSER_EMAIL` and `MIRA_SUPERUSER_PASSWORD`.

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
http://localhost:5173/#team
http://localhost:5173/#tasks
http://localhost:5173/#notes
http://localhost:5173/#summary
http://localhost:5173/#achievements
```

## Runtime Data

The API stores data in the local SQLite database:

```text
mira-workspace/mira-api.sqlite3
```

The browser stores the access token under `mira-api-token-v1`. Signing out clears the token, not the API records.

Set `VITE_MIRA_API_URL` for the web app if the API is not running on `http://127.0.0.1:8000`.

## Useful Commands

```bash
npm run dev:web      # Start Vite dev server
npm run build:web    # Type-check and build the frontend
npm run dev:api      # Start NestJS API in watch mode
npm run build:api    # Build the NestJS API
npm run test:api     # Run API tests
npm run db:api       # Push Prisma schema to the local database
```
