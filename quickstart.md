# Mira Quickstart

This guide runs the current Mira app: a frontend-only, local-first workspace for tasks, meeting notes, weekly summaries, and achievements.

## Prerequisites

- Node.js 20 or newer
- npm

Python and the FastAPI backend are not required for the current app.

## 1. Install Frontend Dependencies

From the repository root:

```bash
npm --prefix apps/web install
```

## 2. Start the Web App

```bash
npm run dev:web
```

Vite prints the local web URL, usually:

```text
http://localhost:5173/
```

If that port is already in use, Vite will print the next available port.

## 3. Open Tabs Directly

```text
http://localhost:5173/#tasks
http://localhost:5173/#notes
http://localhost:5173/#summary
http://localhost:5173/#achievements
```

## Runtime Data

The app stores data in browser `localStorage` using this key:

```text
mira-local-workspace-v1
```

Clearing site data in the browser resets the local workspace.

## Useful Commands

```bash
npm run dev:web      # Start Vite dev server
npm run build:web    # Type-check and build the frontend
```

## Legacy Backend

The repository still contains the FastAPI backend under `apps/api`, but the current frontend does not call it. Backend setup and tests are only needed if you are working on the API directly.
