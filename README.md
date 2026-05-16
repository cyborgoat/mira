# Mira

Mira is an API-backed work workspace for tracking personal tasks, writing meeting notes, and reviewing subordinate work through a tree-shaped team structure.

The current app starts with seeded mock users and focuses on six tabs:

- **Dashboard**: personal or subordinate task/note stats and recent work.
- **Tasks**: create, edit, complete, delete, search, prioritize, and track due dates for the signed-in user's own node.
- **Notes**: write Markdown notes, tag them, preview them, upload `.md`, `.markdown`, or `.txt` files, save edits, and delete notes for the signed-in user's own node.
- **Stats**: summarize tasks and meeting notes by daily, weekly, or monthly periods and export Markdown.
- **AI Summary**: generate evidence-based weekly summaries from tasks, notes, monthly stats, and historical stats for personal work or managed team scopes.
- **Settings**: account details, language, and password for every user, plus a superuser-only team tree tab and JSON workspace tools.

Work records are persisted by the NestJS API. Browser `localStorage` stores only the API access token.
The web UI supports English and Chinese through `react-i18next`; language preference is stored locally in the browser.

Roles and titles are free-form text. Permissions are not derived from labels like member, manager, or superuser. A user can view subordinate data when their linked team node has children, and superuser access is a separate `isSuperuser` permission used for team tree administration.

## Quickstart

Install dependencies:

```bash
npm --prefix apps/web install
npm --prefix apps/api install
```

Prepare the API database:

```bash
npm run db:api
```

Start the API and web app:

```bash
npm run dev:api
npm run dev:web
```

Vite prints the local URL, usually:

```text
http://localhost:5173/
```

Hash routes are available for each tab:

```text
http://localhost:5173/#dashboard
http://localhost:5173/#tasks
http://localhost:5173/#notes
http://localhost:5173/#stats
http://localhost:5173/#ai-summary
http://localhost:5173/#settings
```

Seeded mock users all use `local-password`:

```text
manager@mira.local  # has subordinate team view
alex@mira.local     # personal mode only
sam@mira.local      # personal mode only
admin@mira.local    # superuser settings access
```

## Build

```bash
npm run build:web
npm run build:api
```

This runs the frontend TypeScript/Vite build and the NestJS API build.

## Current Architecture

The active frontend is implemented in:

```text
apps/web/src/main.tsx
apps/web/src/i18n.ts
apps/web/src/styles.css
apps/web/src/components/ui/
```

The backend API is implemented in:

```text
apps/api/src/
apps/api/prisma/schema.prisma
```

The current backend slice exposes seeded auth, `/me/work` for personal data, `/me/team-view` for subordinate read-only data, `/me/ai-summary` for backend-configured AI summarization, `/me/profile` and `/me/password` for account settings, superuser team tree CRUD, and superuser workspace import/export support.

## AI Summarizer

AI provider settings live only in `apps/api/.env`; there is no frontend model configuration UI. Copy `apps/api/.env.example` to `apps/api/.env` and set:

```text
MIRA_AI_PROVIDER=openai
MIRA_AI_API_KEY=...
MIRA_AI_BASE_URL=https://api.openai.com/v1
MIRA_AI_MODEL=gpt-5.2
```

Supported provider values are `openai`, `openrouter`, `anthropic`, and `custom-openai-compatible`.
AI provider requests use the system `HTTPS_PROXY` or `https_proxy` by default. Set `MIRA_AI_PROXY=off` in `apps/api/.env` to bypass proxy, or set `MIRA_AI_PROXY=http://host:port` to override it.

## Product Notes

Mira is designed as a compact user-centered work journal:

1. Capture tasks as they happen.
2. Save meeting notes in Markdown.
3. Review personal stats without team administration noise.
4. Inspect subordinate work in team view when the user has children in the tree.
5. Generate AI work summaries from scoped evidence.
6. Keep team tree administration isolated in a superuser Settings tab.

The current scope is the first API-backed personal/team-view mode. Local-only storage has been replaced for active task and note workflows.
