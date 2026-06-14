# Implementation Plan: Mira v2 全量重构

**Branch**: `redesign/v2` | **Date**: 2026-05-25 | **Specs**: 001–006

**Input**: 6 feature specs covering: Todo refactor, Notes page, Ask Mira refactor,
Mira Ask page, LLM Wiki backend, Stats wiki sections.

## Summary

Replace the NestJS-HTTP frontend data layer with native Tauri invoke commands for all
new v2 capabilities (notes, wiki, lint, ask_mira). The NestJS sidecar is retained for
existing Stats/Tasks data. New pages (MiraAsk, refactored Notes/Todo/AskMira) use Ant
Design 5.20 components. All user-visible text is Simplified Chinese.

## Technical Context

**Language/Version**: Rust (stable, ~1.78), TypeScript 5.x, React 18

**Primary Dependencies**:
- Frontend: React 18 + Vite + Ant Design 5.20 (new) + existing shadcn-style ui components
- Rust: Tauri 2.x, tauri-plugin-store 2 (new), reqwest 0.12 (new), tokio 1 (new), serde 1 (new), uuid 1 (new), chrono 0.4 (new)

**Storage**: tauri-plugin-store (JSON file, `mira_v2` key) for all v2 local data;
NestJS SQLite remains for legacy Stats data

**Testing**: `cargo test` for Rust units; no automated frontend tests in scope

**Target Platform**: macOS desktop (Tauri 2.x, dmg distribution)

**Performance Goals**: Notes auto-save debounce ≤1 s; AI commands respond ≤ 30 s
(user-facing loading state shown); lint auto-check interval ≥ 5 min (background)

**Constraints**: API key never leaves Rust (Principle VI); all frontend AI calls via
Tauri invoke (Principle VII); no new npm/crate not listed in data-model.md

**Scale/Scope**: Personal use, single user, hundreds of notes/tasks max

## Constitution Check

| Principle | Check | Status |
|-----------|-------|--------|
| I. macOS desktop (Tauri 2.x, .dmg) | All new code targets Tauri 2.x; NestJS sidecar retained | PASS |
| II. AI-First Background Intelligence | Wiki + Lint run in background; frontend is lightweight input only | PASS |
| III. Invisible LLM Wiki | MiraAsk page shows questions, not wiki internals; no "LLM Wiki" label in UI | PASS |
| IV. Five-Page Nav (fixed order) | Nav → Todo → Notes → Ask Mira → Mira Ask → Stats; Settings moved to header icon | PASS |
| V. Chinese-Only Frontend | All new copy is Chinese; i18n.ts updated; LLM Wiki removed from nav | PASS |
| VI. API Key Isolation | api_key in AppState::Mutex, never serialized to frontend | PASS |
| VII. Tauri Command Architecture | All AI calls via invoke(); no frontend AI SDK | PASS |
| VIII. Non-Intrusive Copilot | CopilotCard is dismissible; does not block workflow | PASS |
| IX. System-Initiated Mira Ask | LintSession questions appear in Mira Ask; system message first | PASS |
| X. Minimal Dependencies | Each new dep justified in research.md ADR-1 through ADR-7 | PASS |

**Gate result: PASS — proceed to Phase 1**

## Project Structure

### Documentation (this feature)

```text
specs/006-stats-wiki-sections/
├── plan.md          # This file
├── research.md      # ADR-1 through ADR-7 (resolved)
├── data-model.md    # Rust structs + TypeScript types + Cargo deps
└── tasks.md         # Phase 2 output (/speckit-tasks — NOT yet created)
```

### Source Code — File Change List

Legend: `[NEW]` `[MOD]` `[DEL]` `[REN]`

#### Frontend: `apps/web/src/`

```text
apps/web/
├── package.json                              [MOD] Add antd@^5.20.0
└── src/
    ├── main.tsx                              [MOD] Wrap with Ant Design ConfigProvider
    ├── app/
    │   ├── App.tsx                           [MOD] Nav reorder + Mira Ask badge + remove llm-wiki + Settings → header icon
    │   ├── types.ts                          [MOD] Add Note, WikiSchema, LintSession, ChatMessage, CopilotQuestion types
    │   ├── useMiraApi.ts                     [MOD] Keep for legacy HTTP calls; no changes to existing methods
    │   ├── useTauriApi.ts                    [NEW] Tauri invoke wrappers for all new commands
    │   ├── i18n.ts                           [MOD] Add/fix Chinese strings for all new pages and components
    │   └── pages/
    │       ├── TasksPage.tsx                 [MOD] Refactor: inline edit + Copilot card (spec 001)
    │       ├── NotesPage.tsx                 [MOD] Refactor: Markdown editor + auto-save + Copilot bar (spec 002)
    │       ├── AskMiraPage.tsx               [MOD] Refactor: 日报/周报/月报 buttons + free Q&A + chat history (spec 003)
    │       ├── MiraAskPage.tsx               [NEW] AI-initiated inbox: lint session list + question detail (spec 004)
    │       ├── StatsPage.tsx                 [MOD] Add WikiSection + LintSummarySection at bottom (spec 006)
    │       ├── LlmWikiPage.tsx               [DEL] Replaced by MiraAskPage.tsx
    │       └── SettingsPage.tsx              [MOD] Access via header icon (not nav item); minor wiring change
    └── components/
        ├── CopilotCard.tsx                   [NEW] Dismissible Copilot question card (used by Notes + Tasks pages)
        ├── WikiSection.tsx                   [NEW] 「Mira 的知识图谱」section for Stats page
        ├── LintSummarySection.tsx            [NEW] 「Mira 最近在想什么」section for Stats page
        └── ui/                               [KEEP] Existing shadcn components unchanged
```

#### Rust: `apps/web/src-tauri/`

```text
apps/web/src-tauri/
├── Cargo.toml                                [MOD] Add 6 new crates (see data-model.md)
├── capabilities/
│   └── default.json                          [MOD] Add "plugin:store:allow-get", "plugin:store:allow-set", "plugin:store:allow-save"
└── src/
    ├── main.rs                               [MOD] Add AppState + register_commands() + background lint timer
    ├── store.rs                              [NEW] PersistedData load/save helpers wrapping tauri-plugin-store
    ├── ai_client.rs                          [NEW] Claude API HTTP client (reqwest); takes api_key, returns String
    ├── commands/
    │   ├── mod.rs                            [NEW] pub mod declarations + register_commands() macro
    │   ├── notes.rs                          [NEW] get_notes, create_note, update_note, delete_note, process_note
    │   ├── ask_mira.rs                       [NEW] ask_mira (with time_range), get_chat_history, clear_chat_history
    │   ├── wiki.rs                           [NEW] get_wiki_schema, get_lint_sessions, answer_lint_question,
    │   │                                           dismiss_lint_question, trigger_lint, get_pending_copilot,
    │   │                                           dismiss_copilot, mark_lint_read, get_unread_lint_count
    │   └── settings.rs                       [NEW] get_api_key (existence check only), set_api_key
    └── models/
        ├── mod.rs                            [NEW] pub mod declarations
        ├── note.rs                           [NEW] Note struct
        ├── wiki.rs                           [NEW] WikiProject, WikiEntity, WikiDecision, WikiSchema
        ├── lint.rs                           [NEW] LintQuestion, LintSession, LintSessionStatus
        ├── chat.rs                           [NEW] ChatMessage, MessageRole
        └── copilot.rs                        [NEW] CopilotQuestion
```

### File Count Summary

| Category | New | Modified | Deleted |
|----------|-----|----------|---------|
| Frontend (.tsx/.ts) | 5 | 9 | 1 |
| Rust (.rs) | 12 | 2 | 0 |
| Config (Cargo.toml, package.json, capabilities) | 0 | 3 | 0 |
| **Total** | **17** | **14** | **1** |

## Complexity Tracking

No constitution violations. All new dependencies are justified in research.md.

The hybrid data pattern (NestJS HTTP for legacy Stats + Tauri invoke for v2 data) is
a deliberate transitional decision. A full NestJS migration is out of scope for these 6 specs.
