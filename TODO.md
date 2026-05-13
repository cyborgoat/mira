# Mira Production TODO

## P0 - Production Foundations (85% Complete)

### Phase 1-4 Migration ✅ COMPLETE (2026-05-13)

- ✅ **Authentication and session handling** - JWT with httpOnly cookies, login/logout/register endpoints
- ✅ **Team/workspace isolation** - All API queries filter by workspace_id, context propagation via contextvars
- ✅ **Alembic migrations** - Migrated from raw SQL to SQLAlchemy ORM with full migration support
- ✅ **Postgres deployment profile** - Configurable database URL, supports SQLite (local) and PostgreSQL (production)
- ✅ **Dockerfiles and Docker Compose** - Multi-stage builds for API/web, production docker-compose.yml with health checks
- ✅ **Audit log infrastructure** - Models and helpers in place (audit.py)
- ✅ **Test coverage** - 78 tests passing (100%), 65.8% code coverage

### Remaining P0 Work

- 🔶 **Role-based authorization enforcement** - Models defined, need to enforce on endpoints (member, manager, workspace_admin)
- ❌ **Audit log usage** - Apply audit logging to all state-changing operations (todo/report/member CRUD)
- ❌ **Backup and restore commands** - Test and document backup/restore procedures for `mira-workspace` + database

**Estimated time to P0 completion**: 3-5 days

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

- ✅ **Backend API tests** - Auth, todos, reports, workspaces (78 tests, 100% pass rate)
- ✅ **Test infrastructure** - pytest fixtures, test database, coverage reporting
- ✅ **Linting** - Ruff configured and integrated
- ❌ **Frontend component tests** - workspace, weekly assistant, wiki, import, and language toggle
- ❌ **Integration tests** - import -> archive -> KB -> tags -> achievements -> team summary
- ❌ **Accessibility checks** - keyboard navigation and form labels
- ❌ **CI pipeline** - GitHub Actions for backend checks and frontend build (draft exists in plan)

## P2 - Security And Operations

- ✅ **CORS configuration** - Environment-specific via MIRA_CORS_ORIGINS
- ✅ **Health endpoint** - /health with database status check
- ✅ **Upload size limits** - MIRA_MAX_UPLOAD_BYTES configuration
- ❌ **Rate limiting** - per workspace policies
- ❌ **Path traversal tests** - for file import and Markdown writing
- ❌ **Request logging** - structured logging and error responses
- ❌ **AI/import job queue** - for background work
- ❌ **Monitoring hooks** - API latency, import failures, AI cost tracking
