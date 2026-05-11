# Mira Production TODO

## P0 - Production Foundations

- Add authentication and session handling.
- Add role-based authorization for member, manager, and workspace admin actions.
- Add team/workspace isolation to every API query and mutation.
- Add audit logs for todo edits, report generation, archive, import, and team summary generation.
- Replace ad hoc SQLite schema management with Alembic migrations.
- Add a clean Postgres deployment profile while keeping SQLite for local-first mode.
- Add Dockerfiles and a Docker Compose production-local profile for API, web, and optional Postgres.
- Add backup and restore commands for `mira-workspace` plus the database.

## P1 - Import And Knowledge Pipeline

- Add `.docx` parsing for weekly notes and historical reports.
- Add zip batch import with preview before commit.
- Add member/week inference from filenames and Markdown frontmatter.
- Add duplicate handling UX for already-imported files.
- Add source file records for original uploads, content hashes, and parse status.
- Add full-text search over knowledge entries.
- Add embedding generation and vector retrieval for Mira Wiki Q&A.
- Add source trace ranking for answers, badges, summaries, and diagnostics.

## P1 - AI Provider Layer

- Define a provider interface for summarization, item extraction, tag extraction, and Q&A.
- Add OpenAI, Azure OpenAI, and local-model adapter implementations.
- Add structured output validation for AI responses.
- Add retry, timeout, and fallback behavior.
- Add token usage and cost tracking.
- Keep deterministic rules as fallback for tags, achievements, and basic reports.

## P1 - Frontend Product Depth

- Replace local shadcn-style wrappers with generated shadcn/ui components if the project adopts Tailwind and Radix fully.
- Add form validation and inline API error states.
- Add report history timeline and archived/draft filters.
- Add badge trace modal showing source snippets.
- Add team heatmap and tag evolution charts.
- Add import preview and conflict-resolution screens.
- Add responsive QA for desktop, tablet, and mobile.
- Add loading skeletons and empty states across all modules.

## P1 - i18n Completion

- Move translation resources into separate JSON files.
- Localize backend error messages.
- Localize backend-generated report and summary Markdown consistently.
- Add date, week, number, and status formatting per locale.
- Add language preference persistence on the user profile once auth exists.

## P2 - Testing And Quality

- Add backend API tests for todo, report, archive, import, KB search, and team summary flows.
- Add frontend component tests for workspace, weekly assistant, wiki, import, and language toggle.
- Add integration test: import -> archive -> KB -> tags -> achievements -> team summary.
- Add accessibility checks for keyboard navigation and form labels.
- Add linting and formatting scripts for API and web.
- Add CI to run backend checks and frontend build.

## P2 - Security And Operations

- Harden CORS through environment-specific configuration.
- Add upload size, rate, and content-type policies per workspace.
- Add path traversal tests for file import and Markdown writing.
- Add request logging and structured error responses.
- Add health, readiness, and version endpoints.
- Add AI/import job queue once background work becomes long-running.
- Add monitoring hooks for API latency, import failures, and AI cost.
