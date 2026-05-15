# Mira TODO

The active product direction is a local-first frontend app. Backend/auth work is paused for now.

## Current Scope

- Tasks: local create, edit, complete, delete, and search.
- Meeting notes: Markdown editor, preview, upload, save, edit, and delete.
- Weekly summary: daily, weekly, and monthly rollups for completed/open tasks and meeting notes.
- Achievements: historical task and meeting-note statistics with daily, weekly, and monthly filters.

## P0 - Stabilize Local App

- Add confirmation before deleting tasks or notes.
- Add import error states for unsupported or unreadable files.
- Add empty-state actions that create the first task or note.
- Add keyboard shortcuts for save and new record.
- Add local data export/import as JSON.
- Add reset workspace control with confirmation.

## P1 - Product Depth

- Add task due dates and priority filters.
- Add meeting-note tags.
- Add richer Markdown support without unsafe HTML rendering.
- Add summary export to Markdown.
- Add achievement detail views with the source records that contributed to each metric.
- Add responsive QA for desktop, tablet, and mobile.

## P2 - Quality

- Add frontend component tests for tasks, notes, summary filters, and achievements.
- Add accessibility checks for keyboard navigation and form labels.
- Add Playwright smoke tests for the four active tabs.
- Add CI checks for `npm run build:web`.

## Paused Legacy Work

These areas remain in the repository but are not part of the current app runtime:

- Authentication and session handling.
- Backend API state management.
- Workspace isolation.
- AI report generation.
- Knowledge base, tag schema, and team portrait features.
- Backend-driven i18n.
