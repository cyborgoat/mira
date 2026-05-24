# Markdown Workspace Data

Mira reads initial workspace records from markdown files at API startup.

## Structure

```text
workspace/
  people/
    093c046d-0133-40ef-8eda-ab3b52479161/
      person.md
      tasks.md
      notes/
        manager-weekly-sync.md
    bb9cfe4c-5c47-4f21-8287-ee21b1aa5bec/
      person.md
      tasks.md
      notes/
        frontend-focus.md
    a85bcbaf-a380-4e25-8ea8-9ce1b00f11b7/
      person.md
      tasks.md
      notes/
        api-scope-notes.md
```

Each person folder is named by stable UUID v4 `User.id`, not the person's display name. `person.md` links the folder back to the DB user and team node. Tasks and notes loaded from that folder are owned by that user; API responses also include the user's current `ownerNodeId` so team views can aggregate through the DB hierarchy.
