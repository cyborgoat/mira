# Architecture Review: Filesystem Wiki

Source type: architecture review
Date: 2026-05-15

## Decision

Use a per-user filesystem vault for LLM Wiki v1.

```text
<MIRA_WIKI_ROOT>/<userId>/
  raw/
  wiki/
    index.md
    log.md
    pages/
```

## Rationale

The wiki pattern treats markdown files as the primary artifact. A filesystem vault keeps those artifacts directly inspectable and avoids adding Prisma models before the product behavior is stable.

## Constraints

- All paths must be normalized and resolved under the user's vault.
- Raw source files are saved under `raw/` and are not modified by the LLM.
- Generated pages are written under `wiki/pages/`.
- `index.md` and `log.md` are special files in `wiki/`.
- Uploads are limited to markdown and text in v1.

## Risks

- Large source documents may exceed prompt limits.
- Concurrent ingests could overwrite the same generated page.
- The simple context builder may become insufficient after hundreds of pages.

## Future Options

- Add a markdown search index.
- Add file-level locking for concurrent operations.
- Add export and import tools for full vault backup.
- Add optional database metadata only after filesystem behavior is proven.
