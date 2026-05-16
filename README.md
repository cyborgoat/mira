# Mira

Mira is an API-backed team workspace for tracking tasks, writing meeting notes, and reviewing work history by individual or managed subtree.

The current app starts with a seeded superuser login and focuses on five tabs:

- **Team**: create and manage the team tree.
- **Tasks**: create, edit, complete, delete, and search task records.
- **Meeting Notes**: write Markdown notes, preview them, upload `.md`, `.markdown`, or `.txt` files, save edits, and delete notes.
- **Weekly Summary**: summarize tasks and meeting notes by daily, weekly, or monthly periods.
- **Achievements**: keep historical task and meeting-note activity with period filters and simple statistics.

Work records are persisted by the NestJS API. Browser `localStorage` stores only the API access token.

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
http://localhost:5173/#team
http://localhost:5173/#tasks
http://localhost:5173/#notes
http://localhost:5173/#summary
http://localhost:5173/#achievements
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
apps/web/src/styles.css
apps/web/src/components/ui/
```

The backend API is implemented in:

```text
apps/api/src/
apps/api/prisma/schema.prisma
```

The current backend slice exposes seeded superuser auth, team tree CRUD, task and note persistence, and `/team/view` aggregation. The frontend calls these endpoints directly.

## Product Notes

Mira is designed as a compact work journal:

1. Capture tasks as they happen.
2. Save meeting notes in Markdown.
3. Review summaries by day, week, or month.
4. Track historical activity through achievement-style statistics.

The current scope is the first API-backed team mode. Local-only storage has been replaced for active task and note workflows.
