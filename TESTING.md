# Mira Testing

The current app is frontend-only. The primary verification path is the web build.

## Frontend

Install dependencies:

```bash
npm --prefix apps/web install
```

Run the production build:

```bash
npm run build:web
```

This runs TypeScript project build and Vite production bundling through `apps/web/package.json`.

## Manual Smoke Test

Start the app:

```bash
npm run dev:web
```

Check these flows:

- `#tasks`: add a task, edit it, complete it, search it, delete it.
- `#notes`: create a note, edit Markdown, save it, upload a `.md` or `.txt` file, delete a note.
- `#summary`: switch daily, weekly, and monthly filters and confirm records change as expected.
- `#achievements`: switch daily, weekly, and monthly filters and confirm statistics update.
- Refresh the page and confirm records persist from `localStorage`.

## Planned Tests

- Component tests for task CRUD.
- Component tests for meeting-note editing and upload.
- Summary period-filter tests.
- Achievement statistics tests.
- Playwright smoke tests for all four routes.
- Accessibility checks for keyboard navigation and labels.

## Legacy Backend Tests

The FastAPI backend still exists under `apps/api`, but it is not used by the current frontend app. If you are working on backend code directly, install `uv` and run:

```bash
uv sync --project apps/api --extra dev
uv run --project apps/api pytest
```

Backend test status does not block the current local-first frontend unless the API is brought back into the runtime path.
