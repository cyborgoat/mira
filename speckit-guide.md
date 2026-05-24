# Spec Kit Guide

This repo is initialized for GitHub Spec Kit with both Codex and Claude Code integrations.

## Installed Layout

- Shared Spec Kit project files: `.specify/`
- Codex skills: `.agents/skills/speckit-*`
- Claude Code skills: `.claude/skills/speckit-*`
- Codex context file: `AGENTS.md`
- Claude context file: `CLAUDE.md`
- Current default integration: `codex`

Check the current integration state:

```bash
specify integration list
```

## Daily Workflow

Use Spec Kit for features that need a stable spec before implementation. For small fixes, direct implementation is still fine.

Codex skill flow:

```text
$speckit-constitution
$speckit-specify <feature description>
$speckit-clarify
$speckit-plan
$speckit-tasks
$speckit-analyze
$speckit-implement
```

Claude Code uses the same `speckit-*` skills from `.claude/skills/`.

Recommended order:

1. Run `$speckit-constitution` once to replace the placeholder constitution with Mira-specific principles.
2. Run `$speckit-specify` for a new feature. This creates a `specs/<number>-<feature>/` directory.
3. Run `$speckit-clarify` when requirements are ambiguous.
4. Run `$speckit-plan` to choose the implementation approach.
5. Run `$speckit-tasks` to generate implementation tasks.
6. Run `$speckit-analyze` before implementation when the spec is large or cross-cutting.
7. Run `$speckit-implement` to execute the generated task list.

## Mira Defaults To Put In The Constitution

When creating or updating `.specify/memory/constitution.md`, include these project rules:

- Keep the current stack: NestJS API, React/Vite web app, Prisma SQLite.
- Runtime data belongs under `mira-workspace/`.
- Preserve local-first markdown/wiki behavior.
- Keep product UI compact, restrained, and scan-friendly.
- Use existing UI components and patterns before adding new dependencies.
- Verify API changes with `npm run build:api` and `npm run test:api`.
- Verify frontend changes with `npm run build:web`.
- Do not commit unrelated runtime churn from `mira-workspace/mira-api.sqlite3` unless the database fixture intentionally changed.

## Managing Integrations

Keep Codex as the default integration:

```bash
specify integration use codex
```

Use Claude Code as the default integration:

```bash
specify integration use claude
```

Install another integration alongside the existing ones:

```bash
specify integration install <key>
```

Do not use `switch` unless you want to remove or replace the active integration:

```bash
specify integration switch <key>
```

Upgrade an integration with diff-aware handling:

```bash
specify integration upgrade <key>
```

Refresh shared templates only when you are ready to review template changes:

```bash
specify integration upgrade <key> --force
```

## Commit Guidance

Commit Spec Kit scaffold and spec artifacts separately from application code when possible.

Before committing, review:

```bash
git status --short
git diff --stat
```

Expected config/docs files include `.specify/`, `.agents/skills/speckit-*`, `.claude/skills/speckit-*`, `AGENTS.md`, `CLAUDE.md`, and this guide.
