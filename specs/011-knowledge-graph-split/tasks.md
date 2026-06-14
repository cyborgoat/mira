---

description: "Task list for v2.1 unified repair — auth, todo undo, settings, i18n, knowledge graph, stats"
---

# Tasks: v2.1 综合修复（统一计划）

**Input**: Design documents from `specs/011-knowledge-graph-split/` + `specs/008–010/`

**Prerequisites**: plan.md ✅, spec.md ✅ (specs 008–011 all complete)

**Tests**: Not requested — visual/manual verification per quickstart.md

**Organization**: Tasks grouped by user story to enable independent implementation.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete sibling tasks)
- **[Story]**: US1–US7 maps to the 7 implementation areas below
- All tasks include exact file paths

## Path Conventions

- Rust: `apps/web/src-tauri/src/`
- Frontend: `apps/web/src/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Add bcrypt dependency; no code changes yet.

- [x] T001 Add `bcrypt = "0.15"` to `apps/web/src-tauri/Cargo.toml` under `[dependencies]`

**Checkpoint**: `cargo build` passes with new dependency before any command code is written.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Rust auth layer. ALL frontend auth work depends on this phase being complete.

⚠️ **CRITICAL**: No user story work can begin until this phase is complete.

- [x] T002 Add `LockState` struct (fields: `fail_count: u32`, `locked_at: Option<DateTime<Utc>>`) and store functions `get_password_hash`, `save_password_hash`, `clear_password_hash`, `get_lock_state`, `save_lock_state` to `apps/web/src-tauri/src/store.rs`; fix `StoredLlmConfig::default()` base_url to `"https://api.anthropic.com"` and model to `"claude-haiku-4-5"`
- [x] T003 [P] Create `apps/web/src-tauri/src/commands/auth.rs` with `AuthStatus` struct (`is_setup: bool`, `is_locked: bool`, `lock_remaining_seconds: u32`) and `check_auth_status` command reading password_hash and lock_state from store
- [x] T004 [P] Add `test_llm_connection` command to `apps/web/src-tauri/src/commands/settings.rs`: reads API key from AppState, sends "你好" to configured endpoint, returns first sentence on success or `"connection_failed: <msg>"` on error (10s timeout)
- [x] T005 Add `setup_password` command to `apps/web/src-tauri/src/commands/auth.rs`: validate ≥6 chars, bcrypt::hash cost 12, save to store, set session_token in AppState (depends T002, T003)
- [x] T006 Add `login` command to `apps/web/src-tauri/src/commands/auth.rs`: bcrypt::verify, increment fail_count on wrong password, lock after 5 failures for 30s, return session token on success (depends T005)
- [x] T007 Add `change_password`, `logout`, `reset_all_data` commands to `apps/web/src-tauri/src/commands/auth.rs`; `reset_all_data` clears password_hash, all store keys, and session_token (depends T005)
- [x] T008 Add `pub mod auth` to `apps/web/src-tauri/src/commands/mod.rs`
- [x] T009 Extend `AppState` with `session_token: Mutex<Option<String>>` in `apps/web/src-tauri/src/main.rs`; register all 6 auth commands and `test_llm_connection` in `invoke_handler![]`; initialize `session_token: Mutex::new(None)` in setup (depends T002–T008)

**Checkpoint**: `cargo build` passes; all 7 new commands compile.

---

## Phase 3: US1 — 本地认证前端门控 (Priority: P1)

**Goal**: Tauri auth gate in App.tsx; login page and setup page fully functional.

**Independent Test**: 删除 store 中的 `password_hash` → 重启 app → 出现设置密码页；设置密码后关闭 → 重新打开 → 出现登录页；输入正确密码进入 app。

### Implementation for User Story 1

- [x] T010 [P] [US1] Add `AuthStatus` type and `tauriAuth` object (`checkStatus`, `setup`, `login`, `changePassword`, `logout`, `resetAllData`) to `apps/web/src/app/useTauriApi.ts`
- [x] T011 [P] [US1] Add `testLlmConnection` to `tauriSettings` object in `apps/web/src/app/useTauriApi.ts`
- [x] T012 [P] [US1] Add `"knowledge-graph"` to `Route` type in `apps/web/src/app/types.ts`
- [x] T013 [US1] Create `apps/web/src/app/pages/SetupPasswordPage.tsx`: full-screen deep-blue (`#1B2A4E`) background, centered Mira logo + brand name, password input (≥6 chars), confirm password input, 「设置密码」button, Chinese error messages "密码至少 6 位" / "两次密码不一致", calls `tauriAuth.setup()` on submit (depends T010)
- [x] T014 [US1] Create `apps/web/src/app/pages/LoginPage.tsx`: full-screen deep-blue background, centered Mira logo, single password input (Enter key submits), 「进入 Mira」button, error message "密码错误，请重试", lockout message "尝试次数过多，请等待 N 秒后重试" with countdown, bottom link "忘记密码？重置所有数据" → modal confirm → calls `tauriAuth.resetAllData()`, calls `tauriAuth.login()` (depends T010)
- [x] T015 [US1] Add Tauri auth state machine to `apps/web/src/app/App.tsx`: `useEffect` calling `tauriAuth.checkStatus()` on mount, state `"loading" | "needs-setup" | "needs-login" | "authenticated"`, render `SetupPasswordPage` / `LoginPage` / loading spinner before `!api.user` check (depends T013, T014)
- [x] T016 [US1] Verify auth gate in App.tsx cannot be bypassed: authenticated state only set after successful `tauriAuth.login()` or `tauriAuth.setup()`, not via URL hash manipulation

**Checkpoint**: Auth gate fully functional; main app unreachable without login.

---

## Phase 4: US2 — 待办完成撤销 (Priority: P2)

**Goal**: Completed tasks in the collapsed section have an undo button.

**Independent Test**: Create a task → mark complete → expand "已完成" section → click undo → task reappears in open list.

### Implementation for User Story 2

- [x] T017 [US2] Add undo-complete button to completed task rows in `apps/web/src/app/pages/TasksPage.tsx`: import `RotateCcw` from lucide-react, add `<button onClick={() => onUpdate(task.id, { status: "open" })} title="撤销完成">` alongside the existing delete button in the `todo-done-list` section
- [x] T018 [US2] Verify `已完成（N）` bracket style in `apps/web/src/app/pages/TasksPage.tsx` matches spec: change to `已完成 (N)` with half-width parentheses if needed

**Checkpoint**: User can complete and uncomplete tasks; counts update correctly.

---

## Phase 5: US3 — 设置页 AI 测试连接 (Priority: P3)

**Goal**: PersonalAiPanel has a 测试连接 button showing Chinese success/failure feedback.

**Independent Test**: Enter valid API key → click 测试连接 → green 连接成功 + first response sentence appears.

### Implementation for User Story 3

- [x] T019 [US3] Add `testResult: { ok: boolean; message: string } | null` state and 「测试连接」button to `PersonalAiPanel` in `apps/web/src/app/pages/SettingsPage.tsx`; button calls `tauriSettings.testLlmConnection()`; on success show green "连接成功：{message}"; on failure show red "连接失败：{error}" (depends T011)
- [x] T020 [US3] Update `PersonalAiPanel` default placeholders/labels: model placeholder → "例如：claude-haiku-4-5", base URL placeholder → "例如：https://api.anthropic.com", ensure all button labels in Chinese

**Checkpoint**: Save valid Anthropic config → test connection → green feedback received.

---

## Phase 6: US4 — 全局 UI 样式统一 (Priority: P4)

**Goal**: Consistent brand colors, padding, card styles, nav width across all pages.

**Independent Test**: Open all 6 pages — consistent 24px padding, cards have 8px radius, nav 200px wide, buttons deep navy.

### Implementation for User Story 4

- [x] T021 [US4] In `apps/web/src/styles.css`: define CSS variables `--brand-primary: #1B2A4E`, `--brand-accent: #E8B86D`, `--bg-base: #F8F9FA`; set `.app-shell` background to `var(--bg-base)`
- [x] T022 [US4] In `apps/web/src/styles.css`: set `.sidebar` width to `200px`; `.nav-button.active` background to `#1B2A4E` with white text; `.nav-button:hover` background to `#F5F5F5`
- [x] T023 [US4] In `apps/web/src/styles.css`: set `.main .page-scroll` padding to `24px`; set `.page-scroll > *` max-width to `960px` centered
- [x] T024 [US4] In `apps/web/src/styles.css`: set `.card`, `.settings-panel`, `.stats-summary-section` to `border-radius: 8px`, `border: 1px solid #E8E8E8`, `box-shadow: 0 1px 4px rgba(0,0,0,0.06)`
- [x] T025 [US4] In `apps/web/src/styles.css`: set primary button background to `#1B2A4E`, hover to `#14203b`; set input/button height baseline `36px`; set list-item gap `12px`, section gap `32px`
- [x] T026 [US4] Apply `color: var(--brand-accent)` to key stat numbers in StatsPage and KnowledgeGraphPage so gold `#E8B86D` highlights important counts

**Checkpoint**: Visual review — all 6 pages consistent; no English in styles; no layout breaks.

---

## Phase 7: US5 — 全局中文文案清零 (Priority: P5)

**Goal**: Zero English user-visible text across all 6 pages and global components.

**Independent Test**: Navigate all pages, trigger all states (empty, loading, error) — no English visible.

### Implementation for User Story 5

- [x] T027 [P] [US5] Scan and fix `apps/web/src/app/pages/TasksPage.tsx`: confirm placeholder "记录一件事…", empty state "今天还没有待办，记录第一件事吧"; fix any remaining English strings
- [x] T028 [P] [US5] Scan and fix `apps/web/src/app/pages/NotesPage.tsx`: page title "笔记", new button "+ 新建笔记", editor placeholder "开始记录…", empty state "还没有笔记…", autosave "已自动保存", delete confirm "确认删除这条笔记？"
- [x] T029 [P] [US5] Scan and fix `apps/web/src/app/pages/AskMiraPage.tsx`: title "问 Mira", summary section "生成总结", buttons "写日报"/"写周报"/"写月报", input placeholder "问 Mira 任何工作相关的问题…", send "发送", loading "Mira 正在思考…", copy "复制"/"已复制", empty state welcome in Chinese
- [x] T030 [P] [US5] Scan and fix `apps/web/src/app/pages/MiraAskPage.tsx`: title "Mira 的问题", empty state "目前没有待确认的问题，Mira 会在需要时联系你", tags "待回复"/"已完成", buttons "确认"/"跳过", completion "本次知识库更新完成"
- [x] T031 [P] [US5] Scan and fix `apps/web/src/app/pages/StatsPage.tsx`: title "统计", all chart/table/card labels in Chinese; achievements section labels in Chinese
- [x] T032 [P] [US5] Scan and fix `apps/web/src/app/pages/SettingsPage.tsx`: verify all tabs, field labels, button text, helper text in Chinese; remove any English provider names that should be localized

**Checkpoint**: Zero English visible text audit passes for all 6 pages.

---

## Phase 8: US6 — 知识图谱独立页面 (Priority: P6)

**Goal**: New KnowledgeGraphPage accessible from nav; shows WikiSection, LintSummarySection, refresh button.

**Independent Test**: Click 知识图谱 in nav → page opens; 刷新 button reloads data; empty state shows Chinese guidance.

### Implementation for User Story 6

- [x] T033 [US6] Create `apps/web/src/app/pages/KnowledgeGraphPage.tsx`: import `WikiSection` from `@/components/WikiSection` and `LintSummarySection` from `@/components/LintSummarySection`; add page-level state for `loading`; add 「刷新」button calling `tauriWiki.getSchema()` + `tauriWiki.getLintSessions()` to force re-render; render LintSummarySection on top, WikiSection below
- [x] T034 [US6] Add knowledge-graph nav item to `apps/web/src/app/App.tsx` nav array: `{ key: "knowledge-graph", icon: <network/cluster Lucide icon> }` after stats; add `{route === "knowledge-graph" && <KnowledgeGraphPage />}` to main render section
- [x] T035 [US6] Verify `apps/web/src/components/WikiSection.tsx` and `apps/web/src/components/LintSummarySection.tsx` show correct Chinese empty-state messages when no data; update if English text present

**Checkpoint**: Navigate to 知识图谱 → content renders; 刷新 triggers new data fetch.

---

## Phase 9: US7 — Stats 页面精简 (Priority: P7)

**Goal**: Stats page shows only metric cards and trend chart; no wiki/lint content.

**Independent Test**: Navigate to 统计 → no WikiSection/LintSummarySection → 4+ metric cards visible → no large empty space.

### Implementation for User Story 7

- [x] T036 [US7] Remove `WikiSection` and `LintSummarySection` imports and JSX from `apps/web/src/app/pages/StatsPage.tsx`
- [x] T037 [US7] Add top-row metric cards to `apps/web/src/app/pages/StatsPage.tsx` using Ant Design `Statistic` or custom card: 本周完成待办数, 本周新增待办数, 笔记总数, 活跃项目数 (derive from existing `tasks` and `notes` props)
- [x] T038 [US7] Add secondary metric row to `apps/web/src/app/pages/StatsPage.tsx`: 本月完成待办数, 本月新增待办数, 本周新增笔记数, 知识库最后更新时间 (last item from `tauriWiki.getSchema()`)
- [x] T039 [US7] Add 7-day completed tasks trend to `apps/web/src/app/pages/StatsPage.tsx`: group `completedTasks` by day for last 7 days, render as simple CSS bar chart or table; all day labels in Chinese date format (M月D日)

**Checkpoint**: Stats page clean with metric cards; WikiSection nowhere visible.

---

## Phase 10: Polish & Cross-Cutting Concerns

**Purpose**: Final validation and any cross-page fixes.

- [x] T040 [P] Verify Settings page 账户与安全 section: ensure `PasswordSettingsPanel` wires correctly to Tauri `change_password` command (not sidecar) for local auth flow in `apps/web/src/app/pages/SettingsPage.tsx`
- [x] T041 [P] Add 「退出登录」button to Settings page that calls `tauriAuth.logout()` and resets auth state in App.tsx to `"needs-login"` in `apps/web/src/app/pages/SettingsPage.tsx` + `apps/web/src/app/App.tsx`
- [x] T042 Run full app validation per quickstart.md: auth gate, lockout, todo undo, test connection, knowledge graph refresh, stats page, Chinese copy audit

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 (cargo build must pass with bcrypt) — BLOCKS US1 frontend
- **US1 (Phase 3)**: Depends on Phase 2 (Rust auth commands must exist) — partial blocker for settings logout (T041)
- **US2 (Phase 4)**: Depends only on Phase 1 — can start after bcrypt compiles; independent of auth
- **US3 (Phase 5)**: Depends on Phase 2 (test_llm_connection Rust command) and Phase 3 (useTauriApi.ts update T011)
- **US4 (Phase 6)**: Depends only on Phase 1 — pure CSS, no Rust or auth dependency
- **US5 (Phase 7)**: Depends only on Phase 1 — pure text changes
- **US6 (Phase 8)**: Depends on Phase 2 (useTauriApi must have tauriWiki) + Phase 1
- **US7 (Phase 9)**: Depends on Phase 2 (for getSchema last-updated time) — otherwise independent
- **Polish (Phase 10)**: Depends on US1 (auth flow complete) and US3 (settings panel complete)

### User Story Dependencies

- **US1 (local auth)**: Can start after Phase 2 completes — no dependency on other US
- **US2 (todo undo)**: Can start after Phase 1 — completely independent
- **US3 (test connection)**: Can start after Phase 2 T004 (test_llm_connection Rust) + T011 (useTauriApi update)
- **US4 (styles)**: Fully independent — start any time after Phase 1
- **US5 (copy)**: Fully independent — start any time after Phase 1
- **US6 (knowledge graph)**: Independent except needs KnowledgeGraphPage new file; can start after Phase 1
- **US7 (stats)**: Independent; needs tauriWiki for last-updated time (after Phase 2)

### Within Each User Story

- For US1: T010–T012 [P] → T013, T014 [P] → T015 → T016
- For US2: T017, T018 [P]
- For US3: T019 → T020
- For US4–US5: all tasks within each US are sequential (same or related files)
- For US6: T033 → T034 → T035
- For US7: T036 → T037 → T038 → T039

### Parallel Opportunities

- **After Phase 2**: US2, US4, US5 can all start in parallel (no inter-dependency)
- **US5 tasks (T027–T032)**: All six are [P] — different files, can be done simultaneously
- **US1 setup (T010–T012)**: All three [P] — different sections of different files
- **Polish (T040–T041)**: [P] — different concerns

---

## Parallel Example: Recommended Parallel Start After Phase 2

```bash
# After Phase 2 is complete, start in parallel:

Task US2-T017: "Add undo-complete button to TasksPage.tsx"

Task US4-T021: "Set CSS variables and bg color in styles.css"

Task US5-T027: "Scan/fix TasksPage.tsx Chinese copy"
Task US5-T028: "Scan/fix NotesPage.tsx Chinese copy"
Task US5-T029: "Scan/fix AskMiraPage.tsx Chinese copy"
Task US5-T030: "Scan/fix MiraAskPage.tsx Chinese copy"
Task US5-T031: "Scan/fix StatsPage.tsx Chinese copy"
Task US5-T032: "Scan/fix SettingsPage.tsx Chinese copy"

Task US6-T033: "Create KnowledgeGraphPage.tsx"
```

---

## Implementation Strategy

### MVP First (US1 + US2 Only)

1. Complete Phase 1: Setup (T001)
2. Complete Phase 2: Foundational Rust (T002–T009) — CRITICAL
3. Complete Phase 3: Local Auth Frontend (T010–T016)
4. **STOP and VALIDATE**: Auth gate works; no bypass possible
5. Complete Phase 4: Todo Undo (T017–T018)
6. **STOP and VALIDATE**: Todo completion + undo both work

### Full Delivery Order

```
Phase 1 → Phase 2 → [Phase 3 + Phase 4 in parallel] → [Phase 5 + Phase 6 + Phase 7 + Phase 8 in parallel] → Phase 9 → Phase 10
```

### Independent Delivery Points

- After Phase 3: Auth feature shippable
- After Phase 4: Todo undo shippable
- After Phase 5: AI settings test shippable
- After Phase 6: Style polish shippable
- After Phase 7: Copy cleanup shippable
- After Phase 8: Knowledge graph page shippable
- After Phase 9: Stats simplification shippable

---

## Notes

- [P] tasks = different files or independent concerns, no conflicts
- Each US phase is independently completable and testable
- T002 in Phase 2 modifies store.rs in two places — do both in one commit to avoid conflicts
- T015 (auth gate in App.tsx) is the highest-risk task; test thoroughly before proceeding to later phases
- US5 copy tasks should do a final grep for any remaining English strings after each file is done
- `apps/web/src/main.tsx` requires NO changes — ConfigProvider zhCN already present
