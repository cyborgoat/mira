# Competitive Notes: Persistent Wiki vs RAG

Source type: competitive analysis
Date: 2026-05-14

## Baseline RAG Workflow

Traditional retrieval-augmented generation systems retrieve chunks from raw documents at query time. This works well for answering isolated questions, but the system often re-synthesizes the same context repeatedly.

Strengths:

- Works with large document collections.
- Keeps raw source retrieval explicit.
- Can answer questions without maintaining generated pages.

Weaknesses:

- Little accumulation of synthesized knowledge.
- Contradictions may be rediscovered but not recorded.
- Good answers can vanish into chat history.

## Persistent Wiki Workflow

The LLM Wiki compiles source material into durable markdown pages. New sources update existing pages, add cross-links, and append chronological log entries.

Strengths:

- Knowledge compounds over time.
- The user can inspect and browse generated artifacts.
- Queries can create new pages when the answer is valuable.

Weaknesses:

- The wiki needs maintenance conventions.
- Bad ingests can create stale or overconfident pages.
- Search may be needed as the page count grows.

## Positioning

Mira should position the LLM Wiki as a daily knowledge maintenance tool, not a generic document chatbot. The durable artifacts are the product value.
