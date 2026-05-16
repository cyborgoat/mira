# Mira TODO

The active product direction is an API-backed team workspace with NestJS for team mode and work records.

## Current Scope

- Team tree: seeded superuser can create, edit, select, and delete team nodes.
- Tasks: API-backed create, edit, complete, delete, ownership, team scope, and search.
- Meeting notes: API-backed Markdown editor, preview, upload, save, edit, ownership, and delete.
- Weekly summary: daily, weekly, and monthly API rollups for completed/open tasks and meeting notes.
- Achievements: historical task and meeting-note statistics with daily, weekly, and monthly filters.

## P0 - New Features to be implemented

- Team Management Tree: Implemented in the NestJS API for seeded superusers through `/team/nodes` and `/team/tree`.
- Team View Mode: Implemented in the NestJS API through `/team/view`, aggregating tasks, meeting notes, and summary statistics for an individual node or managed subtree.
- Frontend API Integration: Implemented for login, team tree, tasks, notes, summaries, and achievements.

## P1 - Stabilize Local App

- Add confirmation before deleting tasks or notes.
- Add import error states for unsupported or unreadable files.
- Add empty-state actions that create the first task or note.
- Add keyboard shortcuts for save and new record.
- Add local data export/import as JSON.
- Add reset workspace control with confirmation.

## P2 - Product Depth

- Add task due dates and priority filters.
- Add meeting-note tags.
- Add richer Markdown support without unsafe HTML rendering.
- Add summary export to Markdown.
- Add achievement detail views with the source records that contributed to each metric.
- Add responsive QA for desktop, tablet, and mobile.

## P3 - Quality

- Add frontend component tests for tasks, notes, summary filters, and achievements.
- Add accessibility checks for keyboard navigation and form labels.
- Add Playwright smoke tests for the five active tabs.
- Add CI checks for `npm run build:web`.

## Replaced Legacy Work

The old FastAPI backend has been replaced by the NestJS service in `apps/api`. These areas still need product decisions before they are rebuilt on the new backend:

- Authentication and session handling.
- Backend API state management.
- Workspace isolation.
- AI report generation.
- Knowledge base, tag schema, and team portrait features.
- Backend-driven i18n.
