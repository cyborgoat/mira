# Mira Production Scaffold

This repository now contains a production-phase scaffold beside the original demo docs.

## Layout

- `apps/api` - FastAPI service for the core Mira loop.
- `apps/web` - Vite + React + TypeScript frontend.
- `mira-workspace` - local-first runtime directory created by the API. It contains SQLite state and Markdown artifacts, and is intentionally ignored by git.

## Run Locally

Install backend dependencies in your preferred Python environment:

```bash
pip install -e "apps/api[dev]"
```

Start the API:

```bash
npm run dev:api
```

Install and start the frontend:

```bash
npm --prefix apps/web install
npm run dev:web
```

The web app expects the API at `http://localhost:8000`. Override with `VITE_MIRA_API_URL` if needed.

## Implemented Core Loop

- Member capture todo CRUD.
- Weekly report generation from completed/open todos plus pasted notes.
- Editable weekly report drafts before archive.
- Archive report to member knowledge base.
- Write archived weekly reports as Markdown with frontmatter.
- Extract deterministic tags from archived knowledge.
- Evaluate achievement rules with source traces.
- Generate manager team summaries and save them as Markdown.
- Cold-start pasted Markdown/text import that creates archived reports, KB entries, tags, achievements, and Markdown files.
- English and Chinese UI localization through i18next, with an EN/ZH toggle in the top navigation.
- Multipart `.md` / `.txt` file import with size/type checks and duplicate detection.
- Backend configuration through `MIRA_WORKSPACE_DIR`, `MIRA_CORS_ORIGINS`, `MIRA_MAX_UPLOAD_BYTES`, and `MIRA_DEFAULT_LANGUAGE`.
- SQLite indexes for member/week report, todo, KB, tag, achievement, and import lookup paths.

## Markdown Storage

Runtime files are created under:

```text
mira-workspace/
  mira.sqlite3
  members/<member>/reports/<week>.md
  team/summaries/<summary-id>.md
```

The database remains the query/index/permission layer. Markdown is used for durable human-readable reports, notes, wiki pages, and summaries.

If you created `mira-workspace` before the import hardening change, remove that ignored runtime folder before continuing local testing. The early scaffold used a weekly-report uniqueness constraint that has since been removed so multiple archived imports for the same member/week can coexist safely.

## Next Implementation Slices

- Add `.docx` parsing and zip batch imports.
- Add import preview/confirm mode for batch imports before archive.
- Add a real AI provider adapter behind the current deterministic generation path.
- Add authentication and role-scoped access checks.
- Replace local shadcn-style wrappers with generated shadcn/ui CLI components if the project adopts Tailwind and Radix dependencies fully.
