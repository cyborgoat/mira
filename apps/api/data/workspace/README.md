# Markdown Workspace Data

Mira reads initial workspace records from markdown files at API startup.

## Structure

```text
workspace/
  people/
    product-engineering/
      person.md
      tasks.md
      notes/
        manager-weekly-sync.md
    alex-chen/
      person.md
      tasks.md
      notes/
        frontend-focus.md
    sam-rivera/
      person.md
      tasks.md
      notes/
        api-scope-notes.md
```

Each person folder maps to one team node. Tasks and notes loaded from that folder are owned by that person. Owners can edit their own records through personal workspace routes. Managers and directors can view descendant records through team-view routes.
