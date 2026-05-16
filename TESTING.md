# Mira Testing

The frontend is API-backed, and the NestJS backend has its own build and API tests.

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
npm run dev:api
npm run dev:web
```

Check these flows:

- sign in as `alex@mira.local` and confirm Settings only shows account and password tabs.
- sign in as `manager@mira.local`, switch Personal/Team view, and confirm team view is read-only subordinate data.
- sign in as `admin@mira.local` and confirm Settings adds the team tree tab and JSON workspace tools.
- `#dashboard`: confirm stats and recent work change between personal and team view where available.
- `#tasks`: add a task with priority and due date, filter it, edit it, complete it, search it, delete it.
- `#notes`: create a tagged note, edit Markdown, save it, upload a `.md` or `.txt` file, delete a note.
- `#stats`: switch daily, weekly, and monthly filters, export Markdown, and confirm records change as expected.
- Refresh the page and confirm records persist from the API.

## Planned Tests

- Component tests for task CRUD.
- Component tests for meeting-note editing and upload.
- Summary period-filter tests.
- Personal/team-view authorization tests.
- Settings-only tree management tests.
- Playwright smoke tests for the five active routes.
- Accessibility checks for keyboard navigation and labels.

## Backend

Install dependencies:

```bash
npm --prefix apps/api install
```

Run the backend build and tests:

```bash
npm run build:api
npm run test:api
```

Manual API smoke test:

- `POST /auth/login` with `manager@mira.local`, `alex@mira.local`, and `admin@mira.local`.
- confirm `/me/work` returns only the signed-in user's own tasks and notes.
- confirm `/me/profile` updates name, email, and role text, and `/me/password` changes login credentials after current-password verification.
- confirm `/me/team-view` returns subordinate data for `manager@mira.local` and is unavailable to users without children.
- confirm `/team/nodes`, `/tasks`, and `/notes` raw management endpoints require superuser access.
- create a root node and child node through `POST /team/nodes` as the superuser.
