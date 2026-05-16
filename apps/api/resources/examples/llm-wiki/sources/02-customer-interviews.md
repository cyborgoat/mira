# Customer Interview Notes

Source type: research notes
Date: 2026-05-16

## Interview 1: Engineering Manager

The manager keeps meeting notes in markdown but rarely goes back to older files because the useful points are scattered. They want a durable page for each project, plus a chronological log of decisions.

Pain points:

- Summaries disappear into chat history.
- Search finds documents but not synthesized conclusions.
- Weekly reviews require rebuilding context from several notes.

## Interview 2: Senior Frontend Engineer

The engineer likes the idea of raw sources staying untouched. They want the generated pages to be concise and link related topics. They do not want a large chat interface to dominate the screen.

Pain points:

- Existing note tools capture information but do not maintain structure.
- AI outputs are often too verbose for daily browsing.
- It is hard to know which documents influenced an answer.

## Interview 3: Platform Engineer

The platform engineer cares about local control, path safety, and predictable files. They prefer a simple filesystem vault over a database schema for v1 because markdown pages can be inspected directly.

Pain points:

- Hidden storage makes debugging difficult.
- Upload systems can accidentally mix personal and team context.
- Generated files should be easy to back up.

## Synthesis

Customers value a maintained wiki more than a one-time summary. The main design risk is making the feature feel like another chat tool instead of a compact knowledge maintenance console.
