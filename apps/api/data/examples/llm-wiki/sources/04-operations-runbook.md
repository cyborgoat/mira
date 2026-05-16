# Operations Runbook: LLM Wiki Testing

Source type: runbook
Date: 2026-05-17

## Local Setup

1. Start the API server.
2. Start the web app.
3. Sign in with a demo account.
4. Open the LLM Wiki route.
5. Upload one markdown source from `apps/api/data/examples/llm-wiki/sources/`.
6. Ingest the source.
7. Ask a question and optionally save the answer as a page.

## Useful Test Questions

- What are the main goals of the LLM Wiki?
- Which customer pain points does it address?
- Why is the filesystem vault preferred for v1?
- What risks should be watched before scaling to many pages?

## Expected Behavior

- The source appears in the source list after upload.
- Ingest updates `index.md`, creates or updates pages, and appends to `log.md`.
- Query answers cite relevant wiki pages or source names.
- Lint finds gaps such as missing cross-links, stale pages, or unanswered questions.

## Troubleshooting

- If ingest fails with provider configuration errors, check `MIRA_AI_API_KEY`.
- If upload fails, confirm the file extension is `.md`, `.markdown`, or `.txt`.
- If a page cannot be opened, check that the path starts with `pages/` or is `index.md` or `log.md`.
