# Research: Mira v2 Redesign

**Date**: 2026-05-25  
**Feature**: All specs 001–006 (v2 full redesign)  
**Status**: Complete

---

## ADR-1: Persistence Layer — tauri-plugin-store vs. SQLite

**Decision**: Use `tauri-plugin-store` (JSON file-backed key-value store) for v2 local data.

**Rationale**: The existing NestJS sidecar already owns `mira-api.sqlite3` for legacy team data. Adding a second SQLite dependency in Rust would require `sqlx` or `rusqlite` (heavy, needs migration tooling). `tauri-plugin-store` is already approved in Tauri 2.x's plugin ecosystem, is file-backed, and serializes via `serde_json` — exactly what Principle X prescribes (minimal approved dependencies). For v2's personal-data-only scope (notes, wiki, lint sessions, chat history), the load is trivially small; a JSON store is sufficient.

**Alternatives rejected**:
- `sqlx` + SQLite: Overkill for personal-scale data; adds migration burden.
- `sled` embedded DB: Not Tauri ecosystem; Principle X violation.
- Shared NestJS SQLite: Violates Principle VII (frontend must use Tauri invoke, not HTTP).

---

## ADR-2: AI HTTP Client — reqwest

**Decision**: Use `reqwest` (async, JSON feature) to call the Anthropic Claude API from Rust.

**Rationale**: `reqwest` is the de-facto standard async HTTP client in the Rust ecosystem. The Tauri runtime already uses `tokio`, so adding `reqwest` with `tokio` runtime is natural. Alternatives like `ureq` (synchronous) would block the Tauri thread. `curl` bindings are platform-specific and not idiomatic. `reqwest` + `tokio` is the approved minimal path.

**Alternatives rejected**:
- `ureq`: Synchronous; blocks Tauri main thread on AI calls.
- Raw `TcpStream`: Reimplementing HTTPS is a security anti-pattern.

---

## ADR-3: Ant Design Integration Strategy — Additive (New Components Only)

**Decision**: Add `antd@5.20` as a new dependency. Use Ant Design only for NEW components introduced in v2 (CopilotCard, WikiSection, LintSummarySection, MiraAskPage, revised TasksPage, NotesPage). Keep existing shadcn-style `@/components/ui/*` components in StatsPage existing sections to avoid regression risk.

**Rationale**: Replacing all shadcn components with Ant Design in a single PR would be a massive regression surface. The user explicitly specified Ant Design 5.20; Principle X requires a spec item for each new dependency — this is that item. The hybrid approach lets each refactored page migrate to Ant Design incrementally without touching the existing Stats, Settings, or login screens.

**CSS isolation**: Ant Design's global styles may conflict with existing CSS. Use `antd/reset.css` import scoped to a wrapping `<ConfigProvider>` at the app root to limit bleed.

---

## ADR-4: NestJS Sidecar Retention

**Decision**: Keep the NestJS sidecar running in v2. It continues to serve existing Stats data (tasks, notes from NestJS, team features). v2 Rust commands handle ONLY new data domains (notes-v2, wiki, lint, ask_mira-v2, chat_history).

**Rationale**: The user's Rust list does not include migrating existing Tasks or Stats data from NestJS. A full NestJS removal is a separate, large migration not scoped to these 6 specs. Keeping NestJS means the frontend will have a hybrid data pattern: `useMiraApi` (HTTP) for legacy data, `useTauriApi` (invoke) for new data. This is explicitly scoped.

**Risk**: The existing NotesPage and TasksPage in v2 are UI refactors only — they still talk to NestJS for task/note CRUD. The NEW Notes persistence (Rust) applies to a new `Note` entity that is LOCAL-ONLY (not synced to NestJS). The UI will show local notes, not NestJS meeting notes.

**Clarification needed at implementation**: Does the v2 NotesPage replace the NestJS meeting-notes concept entirely, or does it run alongside? This plan assumes REPLACEMENT for the frontend UI, with the NestJS notes data becoming legacy. The Stats page continues showing NestJS data for existing sections.

---

## ADR-5: Lint Auto-Trigger — Rust Timer

**Decision**: Implement the background lint timer as a `tokio::spawn` task in `setup()`, checking two conditions every 5 minutes: (a) item count ≥ 10 since last lint, (b) 24 hours elapsed since last lint.

**Rationale**: Tauri 2.x's `setup` closure has access to the `AppHandle`, which can be cloned into a `tokio::spawn` future. The timer checks state in `AppState.Mutex<LintState>` and emits a Tauri event to the frontend when lint triggers, or runs silently if the user is not on Mira Ask page.

---

## ADR-6: Chat History Persistence — Capped Ring Buffer

**Decision**: Store Ask Mira conversation history as a `Vec<ChatMessage>` in the store, capped at 100 entries. On each append, if length > 100, remove oldest entries from the front.

**Rationale**: Spec 003 FR-013 requires persistent history (survives app restart), max 100 messages, as confirmed by user during clarification. A ring buffer in the JSON store is the simplest implementation; no message queue library needed.

---

## ADR-7: unread_lint_count Badge — Stored in PersistedData

**Decision**: The Mira Ask nav Badge count is stored in `PersistedData.unread_lint_count`. It increments when a new LintSession is created, decrements (resets to 0) when the user navigates to Mira Ask.

**Rationale**: Badge count must survive app restarts (user may restart before answering). Storing in the persistent JSON store is the minimal correct approach.
