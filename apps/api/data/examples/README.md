# Mira Example Data

This folder contains markdown source documents for manually testing Mira's LLM Wiki flow.

Workspace startup data lives in `../workspace/people/`, grouped by owner.

## Structure

```text
examples/
  llm-wiki/
    sources/
      01-product-brief.md
      02-customer-interviews.md
      03-architecture-review.md
      04-operations-runbook.md
      05-competitive-notes.md
```

## How to Use

- Upload files from `llm-wiki/sources/` in the LLM Wiki screen, then ingest them one at a time.

The LLM Wiki source files are intentionally related. Ingesting all of them should produce pages around onboarding, customer signals, architecture, reliability, and competitive positioning.
