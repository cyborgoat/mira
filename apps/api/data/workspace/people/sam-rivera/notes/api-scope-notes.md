# API Scope Notes

Date: 2026-05-17
Tags: backend, api, wiki

## Decisions

- LLM Wiki storage is filesystem-first, not Prisma-backed.
- Each authenticated user gets a private vault.
- Uploaded raw sources are immutable and generated wiki pages are AI-owned.

## Follow-ups

- Keep path traversal tests near the controller-level e2e tests.
- Avoid adding upload middleware until binary sources are required.
- Keep markdown source upload as JSON for the v1 testing path.
