# API Scope Notes

**Date:** 2026-05-17  
**Tags:** #backend #api #wiki

## Decisions

- **Storage Architecture:** LLM Wiki storage is filesystem-first, not Prisma-backed.
- **User Isolation:** Each authenticated user gets a private vault.
- **Ownership & Immutability:** Uploaded raw sources are immutable; generated wiki pages are AI-owned.

## Follow-ups

- Keep path traversal tests near the controller-level e2e tests.
- Avoid adding upload middleware until binary sources are required.
- Keep markdown source upload as JSON for the v1 testing path.

## Related Tasks

- [[validate-vault-path-traversal-guards]]
- [[document-environment-settings]]
