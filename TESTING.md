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

- sign in with the seeded superuser.
- `#team`: create a root node, create a child node, select each node, and confirm subtree metrics update.
- `#tasks`: add a task with priority and due date, filter it, edit it, complete it, search it, delete it.
- `#notes`: create a tagged note, edit Markdown, save it, upload a `.md` or `.txt` file, delete a note.
- `#summary`: switch daily, weekly, and monthly filters, export Markdown, and confirm records change as expected.
- `#achievements`: switch daily, weekly, and monthly filters and confirm statistics and source details update.
- Refresh the page and confirm records persist from the API.

## Planned Tests

- Component tests for task CRUD.
- Component tests for meeting-note editing and upload.
- Summary period-filter tests.
- Achievement statistics tests.
- Playwright smoke tests for all five routes.
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

- `POST /auth/login` with the seeded superuser.
- create a root node and child node through `POST /team/nodes`.
- create a task and note for the child node.
- confirm `GET /tasks?nodeId=<root>&scope=self` excludes child records.
- confirm `GET /tasks?nodeId=<root>&scope=tree` and `GET /team/view?nodeId=<root>&period=weekly` include child records.
