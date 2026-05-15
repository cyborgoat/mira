# Mira

Mira is now a local-first workspace for tracking tasks, writing meeting notes, and reviewing work history without auth or backend setup.

The current app starts from a clean frontend surface and focuses on four tabs:

- **Tasks**: create, edit, complete, delete, and search task records.
- **Meeting Notes**: write Markdown notes, preview them, upload `.md`, `.markdown`, or `.txt` files, save edits, and delete notes.
- **Weekly Summary**: summarize tasks and meeting notes by daily, weekly, or monthly periods.
- **Achievements**: keep historical task and meeting-note activity with period filters and simple statistics.

Data is persisted in browser `localStorage` under `mira-local-workspace-v1`.

## Quickstart

Install dependencies:

```bash
npm --prefix apps/web install
```

Start the app:

```bash
npm run dev:web
```

Vite prints the local URL, usually:

```text
http://localhost:5173/
```

Hash routes are available for each tab:

```text
http://localhost:5173/#tasks
http://localhost:5173/#notes
http://localhost:5173/#summary
http://localhost:5173/#achievements
```

## Build

```bash
npm run build:web
```

This runs the frontend TypeScript build and Vite production build.

## Current Architecture

The active app is implemented in:

```text
apps/web/src/main.tsx
apps/web/src/styles.css
apps/web/src/components/ui/
```

The app intentionally does not use:

- Authentication
- Backend API calls
- React Query data fetching
- i18n runtime resources

Installed packages and reusable UI components are kept in place so future backend, auth, or sync work can be reintroduced without rebuilding the frontend stack.

## Product Notes

Mira is designed as a compact work journal:

1. Capture tasks as they happen.
2. Save meeting notes in Markdown.
3. Review summaries by day, week, or month.
4. Track historical activity through achievement-style statistics.

The current scope is deliberately local-first. Backend services under `apps/api` remain in the repository, but they are not required for the current frontend app.
