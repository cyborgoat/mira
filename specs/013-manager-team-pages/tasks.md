---
description: "Task list for multi-account RBAC + 团队统计 + 团队问Mira"
---

# Tasks: 管理者专属团队功能页面（含多账号基础架构）

**Input**: Design documents from `specs/013-manager-team-pages/`

**Prerequisites**: plan.md ✅ spec.md ✅ research.md ✅ data-model.md ✅

**Organization**: Tasks grouped by phase and user story for independent implementation and testing.

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no blocking dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Exact file paths included in all descriptions

---

## Phase 1: Setup（新增文件骨架）

**Purpose**: 创建所有新文件，不修改现有逻辑，不影响已有功能。

- [X] T001 Create `apps/web/src-tauri/src/models/account.rs` with structs: `Account`, `AccountInfo`, `SessionInfo`, `AccountSession` per data-model.md §四
- [X] T002 [P] Create `apps/web/src-tauri/src/models/team_stats.rs` with structs: `TeamStats`, `MemberStat`, `GroupStat` per data-model.md §四
- [X] T003 [P] Create `apps/web/src-tauri/src/accounts.rs` with stub functions: `read_accounts`, `write_accounts`, `find_account_by_id` (bodies return defaults)
- [X] T004 [P] Create `apps/web/src-tauri/src/commands/team_stats.rs` with stub `get_team_stats` command returning empty `TeamStats`
- [X] T005 Add `pub mod account;` and `pub mod team_stats;` to `apps/web/src-tauri/src/models/mod.rs`

---

## Phase 2: Foundational（多账号 Rust 核心，所有用户故事的前提）

**Purpose**: 账号系统、数据隔离、迁移逻辑。所有 User Story 实现依赖此阶段完成。

**⚠️ CRITICAL**: 此阶段完成前不要开始 Phase 3 及以后工作。

### 2a. AppState 与 Store 改造

- [X] T006 Update `apps/web/src-tauri/src/main.rs`: add `current_account: Mutex<Option<AccountSession>>` to `AppState` struct; initialize as `None`
- [X] T007 Update `apps/web/src-tauri/src/store.rs`: add `account_store_path(account_id: &str) -> String` helper (returns `format!("mira_acct_{account_id}.json")`); add `account_id: &str` parameter to all per-account functions: `get_notes`, `save_notes`, `get_wiki_schema`, `save_wiki_schema`, `get_lint_sessions`, `save_lint_sessions`, `get_chat_history`, `save_chat_history`, `get_pending_copilot`, `save_pending_copilot`, `get_unread_lint_count`, `save_unread_lint_count`; global functions (`get_stored_api_key`, `save_api_key`, `get_llm_config`, `save_llm_config`) remain unchanged using `mira_v2.json`

### 2b. accounts.json I/O

- [X] T008 Implement `apps/web/src-tauri/src/accounts.rs`: `read_accounts(data_dir: &Path) -> Vec<Account>` reads `accounts.json`; `write_accounts(data_dir: &Path, accounts: &[Account])`; `find_account_by_id<'a>(accounts: &'a [Account], id: &str) -> Option<&'a Account>`; `accounts_path(data_dir: &Path) -> PathBuf`

### 2c. 账号 Tauri Commands

- [X] T009 Implement `login_account` in `apps/web/src-tauri/src/commands/auth.rs`: takes `account_id: String, password: String`; loads accounts.json; bcrypt-verifies password (empty password_hash = no-password account, allow direct login); on success sets `AppState.current_account` with id/name/role and `AppState.session_token` with new UUID; returns `SessionInfo {account_id, name, role, token}`; re-uses brute-force lock logic per-account using `fail_count`/`locked_at` fields in accounts.json
- [X] T010 [P] Implement `list_accounts` in `apps/web/src-tauri/src/commands/auth.rs`: reads accounts.json; returns `Vec<AccountInfo>` (excludes `password_hash`); includes deleted accounts (`deleted_at` is Some) with `is_deleted=true` in response — Note: add `deleted_at: Option<String>` field to `Account` struct
- [X] T011 [P] Implement `create_account` in `apps/web/src-tauri/src/commands/auth.rs`: check `AppState.current_account.role == "manager"` or return `Err("unauthorized")`; validate name non-empty, password ≥6 chars; bcrypt hash password (cost=12); generate UUID; push to accounts.json; create `workspace/people/{new_id}/` directory with empty `tasks.md` (header: `# {name} Tasks\n`); return `AccountInfo`
- [X] T012 [P] Implement `delete_account` in `apps/web/src-tauri/src/commands/auth.rs`: check manager role; check `account_id != current_session.id`; set `deleted_at = Utc::now().to_rfc3339()` on the account record in accounts.json (soft delete — keeps data for team stats); do NOT delete store files or workspace (data preserved for 已注销 display); return `Ok(())`
- [X] T013 [P] Implement `update_account_role` in `apps/web/src-tauri/src/commands/auth.rs`: check manager role; if changing target to "member", verify at least 2 managers exist after the change (return `Err("last_manager")` if not); update accounts.json; return `Ok(())`

### 2d. 数据隔离：现有 Commands 加 account_id

- [X] T014 Update `apps/web/src-tauri/src/commands/notes.rs`: at start of each command, get `account_id` from `AppState.current_account` (return `Err("not_logged_in")` if None); pass `account_id` to all `store::*` calls
- [X] T015 [P] Update `apps/web/src-tauri/src/commands/wiki.rs`: same pattern — get account_id from AppState, pass to store calls
- [X] T016 [P] Update `apps/web/src-tauri/src/commands/ask_mira.rs` personal functions (`ask_mira`, `get_chat_history`, `clear_chat_history`): same pattern — get account_id from AppState, pass to store calls

### 2e. 启动迁移

- [X] T017 Implement startup migration in `apps/web/src-tauri/src/main.rs` `setup()` function: call `migrate_if_needed(app)` before AppState initialization; logic: if `accounts.json` exists skip; else scan `workspace/people/` for first UUID directory (fallback: generate new UUID as `default_id`); create accounts.json with one manager entry (`id=default_id, name="默认账号", role="manager", password_hash="", fail_count=0, locked_at=null, deleted_at=null`); copy keys `notes/wiki_schema/lint_sessions/chat_history/pending_copilot/unread_lint_count` from `mira_v2.json` to `mira_acct_{default_id}.json`; delete those keys from `mira_v2.json`; also delete `password_hash` and `lock_state` from `mira_v2.json`

### 2f. 注册所有新 Commands

- [X] T018 Update `apps/web/src-tauri/src/main.rs` `invoke_handler`: add `commands::auth::login_account`, `commands::auth::list_accounts`, `commands::auth::create_account`, `commands::auth::delete_account`, `commands::auth::update_account_role`, `commands::team_stats::get_team_stats`; add `mod accounts;` to module declarations (old single-user commands kept for backward compat until frontend migration)

### Checkpoint: Foundation Ready ✅
此时所有账号 Rust 命令可用，数据按账号隔离。可独立验证：cargo build 通过；login_account 返回 SessionInfo；list/create/delete/update_role 正常工作。

---

## Phase 3: Frontend 认证 & 导航

**Purpose**: 登录页账号列表、Session 加 role、菜单动态渲染、设置页账号管理。

- [X] T019 Update `apps/web/src/app/useTauriApi.ts`: add `tauriAccounts` export with `listAccounts()`, `createAccount(name, password, role)`, `deleteAccount(accountId)`, `updateAccountRole(accountId, role)`, `loginAccount(accountId, password)` invoke wrappers; add `TauriAccountInfo` and `TauriSessionInfo` types
- [X] T020 Redesign `apps/web/src/app/pages/LoginPage.tsx`: show account card list (head avatar placeholder with first char of name + 圆形背景, name, role badge 「团队成员」/「团队管理者」); on card click show password input field + 「登录」button (空密码账号直接点登录即可); call `tauriAccounts.loginAccount`; on success call `onLogin(session)` callback; show 「密码错误，请重试」on wrong password; show 「账号已锁定，请等待 Xs」on lock
- [X] T021 Update `apps/web/src/app/App.tsx`: replace `AuthState` + old `tauriAuth` login flow with multi-account flow; add `TauriSessionInfo | null` as `session` state (null = not logged in); `nav` array changes: base nav = 6 items (tasks/notes/ask-mira/mira-ask/stats/knowledge-graph); if `session?.role === "manager"` add team-stats and team-ask-mira after stats; pass `session` to child pages that need it; on logout clear session; add `TeamStatsView` and `TeamAskMiraView` route cases
- [X] T022 Update `apps/web/src/app/pages/SettingsPage.tsx`: add `AccountManagementPanel` section visible only when `session?.role === "manager"`; panel shows account list table (name, role badge, created_at, actions: 修改角色 / 删除账号); 「新建账号」button opens modal with name/password/role fields; confirm delete shows 「删除后该账号所有数据将被清除」confirmation dialog; cannot delete self (button disabled); cannot degrade last manager (show error 「至少需要保留一名管理者」)

### Checkpoint: Auth & Nav Working ✅
可验证：登录页显示账号卡片；成员登录后导航 6 项；管理者导航 8 项；设置页含账号管理面板。

---

## Phase 4: User Story 1 - 团队统计 (Priority: P1) 🎯 MVP

**Goal**: 管理者在团队统计页看到全账号汇总数据（本周任务完成数、活跃成员数、笔记数、成员明细、分组进度）。

**Independent Test**: 创建 2 个成员账号各自写入待办和笔记，管理者登录后查看团队统计，验证三张卡片数字与各账号实际数据吻合。

### Implementation for User Story 1

- [X] T023 [US1] Implement `parse_tasks_this_week(tasks_md_path: &Path, week_start: DateTime<Utc>) -> (u32, HashMap<String, (Vec<String>, u32, u32)>)` in `apps/web/src-tauri/src/commands/team_stats.rs`: read tasks.md; parse `- [x]` items with `Completed: {ISO8601}` field; count those where completed_at >= week_start; also track `- [ ]` items as total tasks; extract group from task line (check for `[label]` or `#tag` pattern in title; fallback to `"未分组"`); returns (done_count, group_map where key=group_name, value=(member_names, done, total))
- [X] T024 [US1] Implement `get_team_stats` command in `apps/web/src-tauri/src/commands/team_stats.rs`: check manager role; compute week_start (Monday 00:00 local time); iterate all accounts in accounts.json (including soft-deleted); for each account: read `mira_acct_{id}.json` notes (count where created_at >= week_start), read workspace tasks.md (call parse_tasks_this_week); build MemberStat (is_deleted = deleted_at.is_some()); build GroupStat list; sort member_stats by tasks_done_this_week DESC then name ASC; return TeamStats
- [X] T025 [US1] Add `getTeamStats: () => invoke<TeamStats>("get_team_stats")` to `apps/web/src/app/useTauriApi.ts`; add `TeamStats`, `MemberStat`, `GroupStat` TypeScript types
- [X] T026 [US1] Build `apps/web/src/app/pages/TeamStatsPage.tsx` overview section: three `Statistic` cards in a row showing 本周团队完成待办总数 / 团队活跃成员数 / 团队笔记总数; fetch on mount via `tauriAccounts.getTeamStats()` (or new tauriTeam wrapper); show `Spin` loading state
- [X] T027 [US1] Build `apps/web/src/app/pages/TeamStatsPage.tsx` member list section: Ant Design `Table` with columns 姓名(with 已注销 `Tag` for is_deleted=true) / 本周完成待办 / 本周新增笔记; empty state 「本周暂无活跃数据」
- [X] T028 [US1] Build `apps/web/src/app/pages/TeamStatsPage.tsx` group stats section: list of `Card` per group showing group_name, member name tags, progress bar `Progress` (tasks_done/total_tasks), fraction label X/Y; hide progress bar if total_tasks=0; 「未分组」rendered last

**Checkpoint**: 团队统计页面可独立展示，数据准确。

---

## Phase 5: User Story 2 - 团队问Mira (Priority: P2)

**Goal**: 管理者在团队问Mira页以全团队数据为上下文进行 AI 问答，支持 Tab 预设问题。

**Independent Test**: 两账号各有笔记，管理者发送「团队本周完成了什么」，验证 Mira 回答包含两账号的信息。

### Implementation for User Story 2

- [X] T029 [US2] Implement `ask_team_mira(question: String)` command in `apps/web/src-tauri/src/commands/ask_mira.rs`: check manager role; read all accounts from accounts.json; for each non-deleted account load `mira_acct_{id}.json` notes (take last 10 by updated_at, label with account name) and wiki_schema; concatenate into combined_context (tasks priority: latest notes first, then notes of other accounts, truncate to ~8000 chars); build system prompt with combined_context mentioning 「以下是全团队所有成员的工作记录」; call AI; return `ChatMessage`
- [X] T030 [US2] Add `askTeamMira: (question: string) => invoke<TauriChatMessage>("ask_team_mira", { question })` to `apps/web/src/app/useTauriApi.ts`
- [X] T031 [US2] Build `apps/web/src/app/pages/TeamAskMiraPage.tsx`: copy structure from `AskMiraPage.tsx`; add gray description text above input 「基于全团队数据回答，可询问跨成员的项目进展」; add Tab-key handler on input to show dropdown with 3 preset questions: 「本周各项目进展汇总」「团队本周完成了什么」「哪个项目进展最慢」; click preset fills input; send calls `tauriChat.askTeamMira`; no-API-key guard shows 「请先在设置中配置 API Key」; conversation not persisted between sessions

**Checkpoint**: 团队问Mira 可收发消息，Tab 预设问题正常工作。

---

## Phase 6: User Story 3 - 成员访问控制 (Priority: P3)

**Goal**: 成员账号无法访问或发现团队统计和团队问Mira页面。

**Independent Test**: 成员登录后检查导航只有 6 项，直接输入 team-stats 路由被重定向至待办页。

### Implementation for User Story 3

- [X] T032 [US3] Add route guard in `apps/web/src/app/App.tsx`: if `session?.role !== "manager"` and current route is `team-stats` or `team-ask-mira`, reset route to `tasks`; apply this check in the route-rendering switch and in `useEffect` on session change
- [X] T033 [US3] Verify in `apps/web/src/app/App.tsx` nav definition: add comment `// members: 6 items (no team pages); managers: 8 items (+ team-stats, team-ask-mira)`; ensure `TeamStatsView` and `TeamAskMiraView` components are NOT imported/rendered at all in member sessions (conditional import or null render)

**Checkpoint**: 成员无法通过任何路径访问团队页面。

---

## Phase 7: Polish & Cross-Cutting Concerns

- [X] T034 Apply 24px page padding, `#1B2A4E` primary color, `#E8B86D` accent, `8px` card border-radius to `TeamStatsPage.tsx` and `TeamAskMiraPage.tsx` per Principle VII (use existing CSS variables if defined, else add inline style)
- [X] T035 Add role badge display in `LoginPage.tsx`: role label 「团队管理者」 for manager, 「团队成员」 for member (Ant Design `Tag` with gold color for manager, default for member)
- [X] T036 Ensure logout in `App.tsx` clears `AppState.current_account` via `tauriAuth.logout()` (which already clears `session_token`; add `current_account` clear to Rust `logout` command in `auth.rs`)
- [X] T037 Add `route: Route` type entries `"team-stats"` and `"team-ask-mira"` to `apps/web/src/app/types.ts`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundation)**: Depends on Phase 1 — BLOCKS all user stories
  - 2a (AppState/Store) → 2b (accounts.rs) → 2c (commands) → 2d (existing commands) → 2e (migration) → 2f (registration)
  - Within 2c: T009 (login_account) must be done before T010-T013 can be tested
- **Phase 3 (Frontend Auth)**: Depends on Phase 2 completion
- **Phases 4-6 (User Stories)**: All depend on Phase 3; can proceed in parallel
- **Phase 7 (Polish)**: Depends on Phases 4-6

### Within-Phase Parallel Opportunities

```
Phase 1:  T001 ‖ T002 ‖ T003 ‖ T004
          then T005

Phase 2:  T006 → T007 (sequential, T007 depends on T006's AppState)
          T007 done → T008 ‖ T009
          T009 done → T010 ‖ T011 ‖ T012 ‖ T013
          T014 → T015 ‖ T016 ‖ T017 (sequential start)
          T018 last in phase

Phase 3:  T019 → T020 ‖ T021
          T021 done → T022

Phase 4:  T023 → T024
          T024 done → T025 ‖ T026
          T026 done → T027 ‖ T028

Phase 5:  T029 → T030 → T031

Phase 6:  T032 ‖ T033

Phase 7:  T034 ‖ T035 ‖ T036 ‖ T037
```

---

## Implementation Strategy

### MVP First (Phase 1 + 2 + 3 + Phase 4 only)

1. Complete Phase 1: Setup (new files)
2. Complete Phase 2: Foundation (Rust multi-account core)
3. Complete Phase 3: Frontend auth & nav
4. Complete Phase 4: US1 团队统计
5. **STOP and VALIDATE**: Manager can view team stats with real data from multiple accounts
6. Demo ready at this point

### Incremental Delivery

1. Setup + Foundation → 多账号 Rust 系统可用
2. + Frontend Phase 3 → 登录页账号列表正常，菜单按角色显示
3. + Phase 4 → 团队统计可展示（**MVP!**）
4. + Phase 5 → 团队问Mira 可用
5. + Phase 6 → 访问控制严格执行
6. + Phase 7 → 视觉规范对齐

---

## Notes

- [P] tasks = different files, no inter-task dependencies
- [US1/US2/US3] = maps task to user story for traceability
- Foundation phase is unusually large because multi-account infrastructure is a prerequisite for ALL stories
- `delete_account` uses soft-delete (sets `deleted_at`) to preserve team stats display of 已注销 accounts
- `ask_team_mira` context truncation: notes of all accounts sorted by updated_at DESC, truncate from tail to stay under ~8000 chars; wiki_schema appended after notes if space allows
- tasks.md parser is text-based (no new deps); assumes standard format from existing workspace files
