# Product Brief: Mira LLM Wiki

Source type: product brief
Date: 2026-05-17

## Summary

Mira's LLM Wiki is a private markdown knowledge base maintained by an LLM from user-curated source documents. The goal is to help daily users build persistent knowledge instead of repeatedly asking an LLM to rediscover context from raw notes.

## Target Users

- Individual contributors who collect work notes, research, and planning documents.
- Managers who need a concise archive for team decisions and recurring project context.
- Technical users who prefer markdown artifacts they can inspect and version.

## Product Principles

- Raw sources are immutable.
- Generated wiki pages are durable and should improve over time.
- `index.md` is the content catalog.
- `log.md` records ingests, queries, and maintenance passes.
- The user should be able to upload a source, ingest it, ask a question, and inspect the page output without leaving the screen.

## Open Questions

- Should generated wiki pages support manual edits later?
- Should source uploads include PDFs or images after markdown and text are stable?
- Should team managers be able to share vault pages with direct reports?
