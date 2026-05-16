# Mira TODO

The active product direction is an API-backed user-centered workspace with NestJS for personal work records, subordinate team view, and superuser-only settings.

## Current Scope

- Dashboard: focused work content and stats without tree administration.
- Personal mode: signed-in users only see and mutate their own tasks and notes.
- Team view mode: users with children in the tree can inspect subordinate task stats and details in read-only mode.
- Settings: every user can edit account details and password; superusers can create, edit, select, delete, export, import, and reset team/workspace data.
- Roles: arbitrary role/title text; authority comes from the tree and the separate superuser permission.

## P0 - New Features to be implemented

- Personal Work Mode: Implemented through `/me/work` and `/me/tasks`/`/me/notes`.
- Account Settings: Implemented through `/me/profile` and `/me/password`.
- Team View Mode: Implemented through `/me/team-view`, aggregating subordinate tasks, meeting notes, and summary statistics.
- Team Management Tree: Implemented as superuser-only Settings through `/team/nodes` and `/team/tree`.
- Frontend API Integration: Implemented for login, dashboard, tasks, notes, stats, team view, and settings.

## P1 - Stabilize Local App

- Confirmation before deleting tasks, notes, team nodes, and before resetting the workspace.
- Import error states for unsupported or unreadable note uploads and workspace JSON imports.
- Empty-state actions for starting the first task or note.
- Keyboard shortcuts for save and new record in task and note editors.
- Workspace data export/import as JSON.
- Reset workspace control with confirmation.

## P2 - Product Depth

- Task due dates and priority filters.
- Meeting-note tags.
- Richer Markdown support without unsafe HTML rendering.
- Summary export to Markdown.
- Achievement detail views with the source records that contributed to each metric.
- Add responsive QA for desktop, tablet, and mobile.

## P3 - Quality

- Add frontend component tests for tasks, notes, summary filters, and achievements.
- Add accessibility checks for keyboard navigation and form labels.
- Add Playwright smoke tests for dashboard, tasks, notes, stats, and settings.

## Replaced Legacy Work

The old FastAPI backend has been replaced by the NestJS service in `apps/api`. These areas still need product decisions before they are rebuilt on the new backend:

- Backend API state management.
- Workspace isolation.
- AI report generation.
- Knowledge base, tag schema, and team portrait features.
- Backend-driven i18n.
