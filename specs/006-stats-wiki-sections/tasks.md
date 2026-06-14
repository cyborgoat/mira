# Tasks: Mira v2 全量重构

**Input**: Design documents from `specs/006-stats-wiki-sections/` (plan covers all 6 specs)

**Specs covered**: 001 Todo refactor · 002 Notes page · 003 Ask Mira refactor ·
004 Mira Ask page · 005 LLM Wiki backend · 006 Stats wiki sections

**Format**: `[ID] [P?] [Story?] Description — file path`

- **[P]**: Parallelizable (different files, no incomplete dep)
- **[US#]**: User story / feature area label

---

## Phase 1: Setup (Config & Dependency Changes)

**Purpose**: Add new dependencies and scaffolding before any code is written.

- [x] T001 Add `antd@^5.20.0` to dependencies in `apps/web/package.json`
- [x] T002 Add `tauri-plugin-store`, `serde`, `serde_json`, `tokio`, `reqwest`, `uuid`, `chrono` to `apps/web/src-tauri/Cargo.toml` (see data-model.md for exact versions)
- [x] T003 [P] Add `"plugin:store:allow-get"`, `"plugin:store:allow-set"`, `"plugin:store:allow-save"` to `apps/web/src-tauri/capabilities/default.json`
- [x] T004 [P] Add `tauri_plugin_store::Builder::default().build()` plugin init in `apps/web/src-tauri/src/main.rs` setup block
- [x] T005 [P] Wrap `<App />` with Ant Design `<ConfigProvider locale={zhCN}>` in `apps/web/src/main.tsx`

**Checkpoint**: `cargo build` passes; `npm install` installs antd.

---

## Phase 2: Foundational — Rust Models + Store + AI Client

**Purpose**: Rust types and infrastructure that ALL subsequent phases depend on.

**⚠️ CRITICAL**: No Rust command or frontend data-layer work starts until this phase is complete.

- [x] T006 [P] Create `Note` struct (`id`, `content`, `created_at`, `updated_at`) with `Serialize/Deserialize` in `apps/web/src-tauri/src/models/note.rs`
- [x] T007 [P] Create `WikiProject`, `WikiEntity`, `WikiDecision`, `WikiSchema` structs in `apps/web/src-tauri/src/models/wiki.rs`
- [x] T008 [P] Create `LintQuestion`, `LintSession`, `LintSessionStatus` enum (`open/done/expired`) in `apps/web/src-tauri/src/models/lint.rs`
- [x] T009 [P] Create `ChatMessage`, `MessageRole` enum (`user/assistant`) in `apps/web/src-tauri/src/models/chat.rs`
- [x] T010 [P] Create `CopilotQuestion` struct (`id`, `question`, `context`, `source_id`, `source_type`, `dismissed`) in `apps/web/src-tauri/src/models/copilot.rs`
- [x] T011 Declare all models with `pub mod` in `apps/web/src-tauri/src/models/mod.rs`
- [x] T012 Create `PersistedData` struct (Default impl: `notes`, `wiki_schema`, `lint_sessions`, `chat_history`, `pending_copilot`, `unread_lint_count`) and `load_data()` / `save_data()` helpers using `tauri-plugin-store` with key `"mira_v2"` in `apps/web/src-tauri/src/store.rs`
- [x] T013 Create `AiClient::call(api_key, prompt) → Result<String>` using `reqwest` async POST to Anthropic API in `apps/web/src-tauri/src/ai_client.rs`
- [x] T014 Add `AppState` struct (`api_key: Mutex<Option<String>>`, `lint_state: Mutex<LintState>`) and `LintState` struct to `apps/web/src-tauri/src/main.rs`; register `AppState` via `app.manage()`
- [x] T015 Create `commands/mod.rs` with stub `pub mod` declarations for `notes`, `ask_mira`, `wiki`, `settings` in `apps/web/src-tauri/src/commands/mod.rs`
- [x] T016 Wire `commands::mod::register_all()` into `invoke_handler` in `apps/web/src-tauri/src/main.rs`; add `src/commands` and `src/models` module declarations to `main.rs`

**Checkpoint**: `cargo build` succeeds with new modules compiled. No commands yet.

---

## Phase 3: Notes Rust Backend [US1]

**Goal**: Notes CRUD and wiki processing pipeline fully operational in Rust.

**Independent Test**: Invoke `create_note`, `update_note`, `delete_note` via Tauri devtools; verify data persists across app restart; invoke `process_note` with API key set, confirm WikiSchema updates.

- [x] T017 [US1] Implement `get_notes` (returns `Vec<Note>` sorted by `updated_at` desc) and `create_note` (UUID v4 id, current timestamp) in `apps/web/src-tauri/src/commands/notes.rs`
- [x] T018 [US1] Implement `update_note` (update content + `updated_at`, clear copilot dismissed flag for this note) and `delete_note` (remove note + associated pending copilot) in `apps/web/src-tauri/src/commands/notes.rs`
- [x] T019 [US1] Implement `process_note`: call `AiClient` with note content, parse response to extract wiki entities (update `PersistedData.wiki_schema`), generate `CopilotQuestion` if ambiguity found; add 3-second per-note throttle; increment `lint_state.item_count_since_last` in `apps/web/src-tauri/src/commands/notes.rs`
- [x] T020 [US1] Implement `get_pending_copilot` (returns undismissed `CopilotQuestion[]`) and `dismiss_copilot` in `apps/web/src-tauri/src/commands/wiki.rs`
- [x] T021 [US1] Implement `get_api_key_status` (returns `{ is_set: bool }`, never returns the key) and `set_api_key` (stores in `AppState`, validates non-empty) in `apps/web/src-tauri/src/commands/settings.rs`
- [x] T022 [US1] Register `notes`, `settings` command handlers in `apps/web/src-tauri/src/commands/mod.rs`

**Checkpoint**: Notes CRUD + wiki processing fully functional via devtools.

---

## Phase 4: Wiki + Lint Rust Backend [US2]

**Goal**: Full wiki schema read + lint cycle (manual trigger and auto-trigger) operational.

**Independent Test**: Call `trigger_lint` via devtools with notes present; verify `LintSession` created with `status: "open"`; call `answer_lint_question`; verify session moves to `done`; verify `unread_lint_count` increments on lint, resets on `mark_lint_read`.

- [x] T023 [US2] Implement `get_wiki_schema` (returns `WikiSchema` from store; returns empty struct if store empty, never errors) in `apps/web/src-tauri/src/commands/wiki.rs`
- [x] T024 [US2] Implement `get_lint_sessions` (returns all `Vec<LintSession>`, newest first) in `apps/web/src-tauri/src/commands/wiki.rs`
- [x] T025 [US2] Implement `answer_lint_question` (set `answered=true`, `answer=Some(text)`, auto-set session to `done` if all answered) and `dismiss_lint_question` (set `answered=true`, `answer=None`) in `apps/web/src-tauri/src/commands/wiki.rs`
- [x] T026 [US2] Implement `trigger_lint`: call AI with current wiki + recent notes, parse response into new `LintSession` (with `items_analyzed`, `time_span_days`, `issues_found`, `updated_projects`, `questions`); mark previous `open` sessions as `expired`; increment `unread_lint_count`; save to store in `apps/web/src-tauri/src/commands/wiki.rs`
- [x] T027 [US2] Implement `get_unread_lint_count` and `mark_lint_read` (resets `unread_lint_count` to 0 in store) in `apps/web/src-tauri/src/commands/wiki.rs`
- [x] T028 [US2] Add background lint timer in `apps/web/src-tauri/src/main.rs` setup: `tokio::spawn` loop polling every 5 min; triggers `trigger_lint` if `item_count_since_last ≥ 10` or `24h since last_lint_at`; resets counter after trigger
- [x] T029 [US2] Register `wiki` command handlers in `apps/web/src-tauri/src/commands/mod.rs`

**Checkpoint**: Manual lint trigger works end-to-end; Q&A flow updates session status correctly.

---

## Phase 5: Ask Mira Rust Backend [US3]

**Goal**: Ask Mira Tauri command with time-range support and persistent conversation history.

**Independent Test**: Call `ask_mira` twice via devtools; call `get_chat_history`; verify 2 user + 2 assistant messages returned; restart app; call `get_chat_history` again — same messages present.

- [x] T030 [US3] Implement `ask_mira(question: String, time_range: Option<TimeRange>) → ChatMessage`: build prompt with optional date-range context, call AI, append user+assistant `ChatMessage` to `chat_history` (ring-buffer cap 100), return assistant `ChatMessage` in `apps/web/src-tauri/src/commands/ask_mira.rs`
- [x] T031 [US3] Implement `get_chat_history` (returns `Vec<ChatMessage>` oldest-first) and `clear_chat_history` (empties list in store) in `apps/web/src-tauri/src/commands/ask_mira.rs`
- [x] T032 [US3] Register `ask_mira` command handlers in `apps/web/src-tauri/src/commands/mod.rs`

**Checkpoint**: Chat history persists across restarts; ring buffer drops oldest after 100 messages.

---

## Phase 6: Frontend Scaffolding [US4]

**Goal**: Nav updated, all TypeScript types + Tauri hooks ready for page implementation.

**Independent Test**: App launches; nav shows exactly 5 items in order: 待办→笔记→问Mira→Mira的问题→统计; Settings accessible via header icon; Mira的问题 nav shows badge (even if 0 for now).

- [ ] T033 [US4] Add `Note`, `WikiSchema`, `WikiProject`, `WikiEntity`, `WikiDecision`, `LintSession`, `LintQuestion`, `ChatMessage`, `CopilotQuestion` TypeScript types to `apps/web/src/app/types.ts`
- [ ] T034 [US4] Create `apps/web/src/app/useTauriApi.ts` with typed `invoke` wrappers for all 18 commands (per `contracts/tauri-commands.md`): notes CRUD, wiki, lint, ask_mira, copilot, badge, settings
- [ ] T035 [US4] Refactor nav array in `apps/web/src/app/App.tsx`: remove `llm-wiki`; add `mira-ask`; reorder to `tasks→notes→ask-mira→mira-ask→stats`; display badge from `useTauriApi.getUnreadLintCount()` on Mira Ask item; move Settings `<Button>` to topbar area; update route rendering block to include `MiraAskView`
- [ ] T036 [US4] Delete `apps/web/src/app/pages/LlmWikiPage.tsx`
- [ ] T037 [US4] Add all new Chinese strings to `apps/web/src/app/i18n.ts`: nav labels (待办/笔记/问Mira/Mira的问题/统计), page headers, empty-state text, error messages, Copilot card labels, wiki section labels, lint summary labels

**Checkpoint**: App compiles and renders 5-page nav correctly; no broken imports.

---

## Phase 7: Todo Page Refactor [US5]

**Goal**: TasksPage redesigned to minimalist inline-edit UX with Copilot card capability.

**Independent Test** (per spec 001): Create a task by pressing Enter; edit inline by clicking; see Copilot card appear for an AI-flagged task; dismiss it. All text Chinese.

- [x] T038 [P] [US5] Create `CopilotCard` component (props: `question: CopilotQuestion`, `onDismiss: () => void`) — dismissible banner, non-blocking, Chinese labels — in `apps/web/src/components/CopilotCard.tsx`
- [x] T039 [US5] Refactor `apps/web/src/app/pages/TasksPage.tsx`: replace current form with single inline input (placeholder 「记录一件事…」, submit on Enter); show task list with inline-edit on click; add Copilot card rendering when `pendingCopilot` present for a task; all labels Chinese
- [x] T040 [US5] Connect `TasksPage` to `useTauriApi.getPendingCopilot()` and `dismissCopilot()` to load/dismiss Copilot questions in `apps/web/src/app/pages/TasksPage.tsx`
- [x] T041 [US5] Add empty-state display (「今天还没有待办，记录一件事吧」) for zero-task state in `apps/web/src/app/pages/TasksPage.tsx`

**Checkpoint**: Todo page renders with new UX; Copilot card appears and dismisses correctly.

---

## Phase 8: Notes Page [US6]

**Goal**: NotesPage rewritten with Markdown editor, auto-save, and Copilot bar.

**Independent Test** (per spec 002): Create a note; wait 1s; refresh app — note persists; edit note; Copilot bar appears with question; dismiss it; delete note with confirmation dialog. All text Chinese.

- [x] T042 [US6] Refactor `apps/web/src/app/pages/NotesPage.tsx` to use `useTauriApi` for note CRUD (`getNotes`, `createNote`, `updateNote`, `deleteNote`) replacing all `useMiraApi` HTTP calls
- [x] T043 [US6] Add auto-save: debounce `updateNote` call ≤1 second after last keystroke in `apps/web/src/app/pages/NotesPage.tsx`
- [x] T044 [US6] Add Copilot bar: after note save, call `processNote(id)`; if `CopilotQuestion` returned, show Copilot bar (「Mira：[question]」) below note; wire dismiss to `dismissCopilot` in `apps/web/src/app/pages/NotesPage.tsx`
- [x] T045 [US6] Add delete confirmation dialog (「确认删除这条笔记？」) with 二次确认 before `deleteNote` call in `apps/web/src/app/pages/NotesPage.tsx`
- [x] T046 [US6] Add empty-state (「还没有笔记，开始记录吧」) for zero-notes state in `apps/web/src/app/pages/NotesPage.tsx`

**Checkpoint**: Notes persist across app restart; auto-save fires; Copilot bar appears; delete requires confirmation.

---

## Phase 9: Ask Mira Page Refactor [US7]

**Goal**: AskMiraPage redesigned with 日报/周报/月报 buttons, free Q&A, and persistent history.

**Independent Test** (per spec 003): Click 写日报; see AI response; type a free question; press send; reload app; verify both messages in history. All text Chinese.

- [x] T047 [US7] Refactor `apps/web/src/app/pages/AskMiraPage.tsx`: remove current implementation; add three summary buttons (写日报/写周报/写月报) that call `askMira` with `timeRange: { days: 1/7/30 }`
- [x] T048 [US7] Add free Q&A input + send button; on submit call `askMira({ question })`; append returned `ChatMessage` pair to displayed history in `apps/web/src/app/pages/AskMiraPage.tsx`
- [x] T049 [US7] Load `getChatHistory()` on page mount; render conversation history (oldest first); user messages right-aligned, assistant left-aligned in `apps/web/src/app/pages/AskMiraPage.tsx`
- [x] T050 [US7] Add clear-history button (「清空对话」, 二次确认) wired to `clearChatHistory()` in `apps/web/src/app/pages/AskMiraPage.tsx`
- [x] T051 [US7] Add loading state (骨架屏 or spinner) during `askMira` call; disable input while loading in `apps/web/src/app/pages/AskMiraPage.tsx`

**Checkpoint**: Full conversation flow works; history reloads after app restart; 日报/周报/月报 buttons produce AI response.

---

## Phase 10: Mira Ask Page (New) [US8]

**Goal**: New MiraAskPage showing AI-initiated lint questions; marks badge as read on visit.

**Independent Test** (per spec 004): Trigger a lint session via devtools; open Mira Ask page; see question in list; click it; answer; verify session status changes to `done`; re-open page — badge resets to 0.

- [x] T052 [US8] Create `apps/web/src/app/pages/MiraAskPage.tsx`: load `getLintSessions()` on mount; call `markLintRead()` on mount (resets badge); render session list sorted newest-first with status badge (未读/已回答/已过期)
- [x] T053 [US8] Add session detail view: when session selected from list, render its questions with context snippet; show 回答 text input and 跳过 button per question in `apps/web/src/app/pages/MiraAskPage.tsx`
- [x] T054 [US8] Wire question actions: 回答 calls `answerLintQuestion`; 跳过 calls `dismissLintQuestion`; after all questions in session handled, refresh session status display in `apps/web/src/app/pages/MiraAskPage.tsx`
- [x] T055 [US8] Add empty state (「Mira 还没有问题要确认，继续记录吧」) when no sessions exist in `apps/web/src/app/pages/MiraAskPage.tsx`
- [x] T056 [US8] Import and render `<MiraAskView />` in `apps/web/src/app/App.tsx` route block for `mira-ask`; update `unreadLintCount` state on page exit via `getUnreadLintCount()` call

**Checkpoint**: Mira Ask page shows lint sessions; answering questions updates status; badge resets on visit.

---

## Phase 11: Stats Wiki Sections [US9]

**Goal**: Stats page extended with 「Mira 的知识图谱」and 「Mira 最近在想什么」sections.

**Independent Test** (per spec 006): Open Stats page with wiki data present; scroll to bottom; confirm 项目列表/实体标签/最近决策 all show data; confirm Lint摘要 shows natural language Chinese text. Empty state: confirm 「Mira 还没有积累足够的知识，继续记录 Tasks 和 Notes 吧」 appears when wiki is empty.

- [x] T057 [P] [US9] Create `WikiSection` component: fetch `getWikiSchema()` on mount; show skeleton during load; on empty wiki show unified empty text; on data show: 「识别的项目」list (name + task count + status, max 10 + 展开全部), 「发现的实体」Tag cloud (Ant Design `<Tag>`), 「最近决策」list (latest 5, single line, overflow ellipsis) in `apps/web/src/components/WikiSection.tsx`
- [x] T058 [P] [US9] Create `LintSummarySection` component: fetch `getLintSessions()` on mount; take newest session; if no sessions show empty text (「Mira 还没有整理过你的知识库，继续记录吧。」); else assemble natural-language Chinese sentence from `itemsAnalyzed`, `timeSpanDays`, `issuesFound`, `updatedProjects` fields; show skeleton during load in `apps/web/src/components/LintSummarySection.tsx`
- [x] T059 [US9] Add error state to both `WikiSection` and `LintSummarySection`: on fetch error display 「暂时无法加载数据，请稍后重试」 without affecting rest of Stats page
- [x] T060 [US9] Append `<WikiSection />` and `<LintSummarySection />` at end of `StatsView` return block in `apps/web/src/app/pages/StatsPage.tsx` — after `<AchievementsView />`; no changes to existing content above
- [x] T061 [US9] Implement 「展开全部」toggle for projects list (>10 projects) in `apps/web/src/components/WikiSection.tsx`

**Checkpoint**: Stats page shows both sections; existing stats sections unaffected; empty states and skeletons work.

---

## Phase 12: Polish & Cross-Cutting

**Purpose**: Final integration, API key settings UI, i18n sweep, edge cases.

- [x] T062 Add API key settings UI to `apps/web/src/app/pages/SettingsPage.tsx`: input for key, save button wired to `setApiKey`, status indicator using `getApiKeyStatus()`; all labels Chinese; key field type=password
- [x] T063 [P] Verify all user-visible strings across new/modified pages are Chinese — grep for English string literals in `apps/web/src/app/pages/*.tsx` and `apps/web/src/components/*.tsx`; fix any found
- [x] T064 [P] Add `tauri::Error` → Chinese string mapping for all error codes (`api_key_not_set` → 「请先在设置中填写 API Key」, `ai_request_failed` → 「AI 请求失败，请稍后重试」, `note_not_found` → 「笔记不存在」) in `apps/web/src/app/useTauriApi.ts`
- [ ] T065 Run app in dev mode (`npm run dev:desktop`); smoke-test the golden path: create note → note processed → Copilot card appears → trigger lint → Mira Ask badge updates → Stats wiki sections show data

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No deps — start immediately
- **Phase 2 (Foundational)**: Requires Phase 1 — BLOCKS Phases 3–5
- **Phases 3–5 (Rust backends)**: Can run in parallel after Phase 2
- **Phase 6 (Frontend scaffolding)**: Can start after Phase 1; T034 (`useTauriApi`) needs Phase 2 types
- **Phases 7–11 (Pages)**: Each requires Phase 6; each is independent of other page phases
- **Phase 12 (Polish)**: Requires all previous phases

### User Story Dependencies

| Story | Depends On | Enables |
|-------|-----------|---------|
| US1 Notes Rust (P3) | Phase 2 | US6 Notes frontend |
| US2 Wiki/Lint Rust (P4) | Phase 2 | US8 Mira Ask, US9 Stats |
| US3 Ask Mira Rust (P5) | Phase 2 | US7 Ask Mira frontend |
| US4 Frontend scaffold (P6) | Phase 1 | US5–US9 (all pages) |
| US5 Todo (P7) | US4 | – |
| US6 Notes frontend (P8) | US4 + US1 | – |
| US7 Ask Mira frontend (P9) | US4 + US3 | – |
| US8 Mira Ask frontend (P10) | US4 + US2 | – |
| US9 Stats sections (P11) | US4 + US2 | – |

### Parallel Opportunities per Phase

```
Phase 2: T006–T010 (all 5 model files) can run in parallel
Phase 3–5: all three Rust backend phases can run in parallel (different files)
Phase 6: T033–T037 can all run in parallel
Phases 7–11: all 5 page phases can run in parallel after Phase 6
```

---

## Implementation Strategy

### MVP First (Stats wiki sections — spec 006, US9)

The spec 006 user stories are the declared active feature. To deliver them independently:

1. Phase 1 (Setup) + Phase 2 (Foundational Rust)
2. Phase 4 T023–T025 only: `get_wiki_schema`, `get_lint_sessions` (read-only commands)
3. Phase 6 T033–T034: types + useTauriApi
4. Phase 11 (Stats sections)
5. **STOP and validate**: Stats page shows both new sections

### Full v2 Incremental Order (recommended)

1. **Week 1**: Phase 1 + 2 + 3 (foundation + notes backend)
2. **Week 2**: Phase 4 + 5 + 6 (wiki/lint/ask backends + frontend scaffold)
3. **Week 3**: Phase 7 + 8 (Todo + Notes frontend pages)
4. **Week 4**: Phase 9 + 10 + 11 (AskMira + MiraAsk + Stats sections)
5. **Week 5**: Phase 12 (polish + smoke test)

---

## Notes

- [P] tasks touch different files and have no shared incomplete dependencies — safe to run in parallel
- Each page phase (7–11) is independently testable without the others
- The NestJS sidecar remains running throughout; existing Stats/Tasks data unaffected
- API key must be set via Settings before any AI commands (`process_note`, `ask_mira`, `trigger_lint`) will work
- Commit after each phase checkpoint; do not batch multiple phases in one commit
