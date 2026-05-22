---

description: "Task list for Mira·见微 — macOS Desktop App (Tauri 2.x)"
---

# Tasks: Mira·见微 — macOS Desktop App

**Input**: Design documents from `/specs/001-mira-tauri-desktop/`

**Prerequisites**: plan.md ✅ spec.md ✅ research.md ✅ data-model.md ✅ contracts/tauri-commands.md ✅ quickstart.md ✅

**Tests**: Not requested in spec. No test tasks generated.

**Implementation order (per user's plan)**: Global architecture + Rust skeletons + state management first → App shell → Task management → Local reports → Settings → AI features last.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

**Remediation applied (2026-05-22)**:
- C1: Added T006 for Tauri 2.x capability declarations (was missing; blocks all Rust commands at runtime)
- I1: Renumbered T037b → T039 (non-standard ID corrected)
- U1: Added T036 for `get_model` Rust command + frontend wiring; updated T035 (SettingsPage)
- U2: Clarified T043 (`ask_wiki`) to handle both empty-project (general assistant) and project-scoped modes

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to
- Include exact file paths in all descriptions

## Path Conventions

- Frontend source: `src/`
- Rust backend: `src-tauri/src/`
- Design authority: `demo_spec.md` (all UI decisions default to this file)

---

## Phase 1: Setup (Project Initialization)

**Purpose**: Scaffold the Tauri 2.x project, install all dependencies, and declare required platform capabilities.

- [X]T001 Scaffold Tauri 2.x + Vite + React + TypeScript project via `npm create tauri-app@latest` with the `react-ts` template; ensure `npm run tauri dev` starts without errors
- [X]T002 [P] Install frontend npm dependencies: `antd @ant-design/icons dayjs marked @tauri-apps/api`
- [X]T003 [P] Add Cargo dependencies to `src-tauri/Cargo.toml`: `tauri-plugin-store = "2"`, `reqwest` (rustls-tls features), `serde`+`serde_json`, `tokio` (full), `anyhow`
- [X]T004 Configure `src-tauri/tauri.conf.json`: set `title="Mira"`, `width=1200`, `height=800`, `minWidth=960`, `minHeight=640`, `identifier="com.mira.app"`, macOS `minimumSystemVersion="11.0"`, bundle targets `["dmg"]`
- [X]T005 [P] Add universal binary Rust targets: `rustup target add aarch64-apple-darwin x86_64-apple-darwin`
- [X]T006 Configure Tauri 2.x capability declarations: create `src-tauri/capabilities/default.json` granting `http:default` (for reqwest AI API calls), `fs:scope` scoped to `$APPDATA/**` (for app_data_dir JSON state file), `core:default`, and `store:default` (for tauri-plugin-store); ensure `tauri.conf.json` references this capabilities file; verify `npm run tauri dev` shows no capability permission errors in console

**Checkpoint**: `npm run tauri dev` launches in a macOS window with correct minimum size and zero capability errors in the Rust console.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Rust command skeleton, TypeScript types, global styles, state management, and shared UI components that all user story phases depend on.

⚠️ **CRITICAL**: No user story implementation can begin until this phase is complete.

### Rust Backend Skeleton

- [X]T007 Create Rust model structs in `src-tauri/src/models/state.rs`: `PersistedAppState`, `Task`, `Project`, `ChatMsg`, `SourceCard`, `ClaudeMessage` — all with `#[derive(Serialize, Deserialize)]` and `#[serde(rename_all = "camelCase")]`; `PersistedAppState` derives `Default`
- [X]T008 [P] Create state commands skeleton in `src-tauri/src/commands/state.rs`: `load_state(app)` reads `app_data_dir()/mira-state.json` (return default if missing); `save_state(app, state)` writes JSON; create dir if absent; atomic write (temp file + rename)
- [X]T009 [P] Create AI commands skeleton in `src-tauri/src/commands/ai.rs`: stub functions `ask_mira`, `ask_wiki`, `polish_report` — all return `Err("Not implemented".to_string())` for now; define correct input/output signatures per `contracts/tauri-commands.md`
- [X]T010 [P] Create settings commands skeleton in `src-tauri/src/commands/settings.rs`: `get_api_key_set(app)` reads bool from tauri-plugin-store; `set_api_key(app, key, model)` saves to store; `get_model(app)` returns current model string (default `"claude-haiku-4-5"` if unset); validate key non-empty in set
- [X]T011 Wire all commands and `tauri-plugin-store` plugin in `src-tauri/src/main.rs`: register plugin, call `tauri::generate_handler![load_state, save_state, ask_mira, ask_wiki, polish_report, get_api_key_set, set_api_key, get_model]`

### Frontend Types, Constants & Styles

- [X]T012 [P] Create TypeScript interfaces in `src/types/index.ts`: `Priority`, `MessageRole`, `SourceCard`, `ChatMsg`, `Task`, `Project`, `TeamMember`, `PersistedAppState`, `AppState`, `AppSettings`, `MemberWithAbilities`, `AbilityTag` — exactly matching `data-model.md`
- [X]T013 [P] Create constants in `src/constants/index.ts`: `PROJECTS` (5 entries), `TEAM_MEMBERS` (6 entries), `KEYWORD_DICT` (29 items), `PRIORITIES` (4 entries with value/label/color), `TAG_TYPE_OPTIONS` (10 items) — values from `demo_spec.md` §3
- [X]T014 [P] Create global CSS in `src/styles/global.css`: all `--mira-*` CSS variables from `demo_spec.md` §6.1; scrollbar styles; base font-family. Create `src/styles/components.css`: `.chat-bubble` (user + assistant variants), `.project-card` (hover translate + shadow), `.mira-card-title::before` (gold left bar), `.boot-loading` + `.boot-logo` + `@keyframes pulse`, `.report-preview`, `.md-preview`, `.tag-chip`, `.chat-source-card`

### Tauri Typed Wrappers & Business Logic

- [X]T015 [P] Create Tauri command wrappers in `src/hooks/useTauri.ts`: typed `invoke()` wrappers for all 8 commands (`loadState`, `saveState`, `askMira`, `askWiki`, `polishReport`, `getApiKeySet`, `setApiKey`, `getModel`) per `contracts/tauri-commands.md`
- [X]T016 [P] Create seed data generator in `src/lib/seed.ts`: `buildSeed()` → calls `generateHistoryTasks(8)` (8 weeks, 2-5 tasks/week, random project/keyword/priority/done) + `generateCurrentTasks()` (8 fixed current-week tasks covering all 5 projects); uses `dayjs` isoWeek for `weekKey`; generates 8-char alphanumeric ids
- [X]T017 [P] Create talent algorithms in `src/lib/talent.ts`: `hashCode(s: string)` (Java-style int hash); `assignTasksToMembers(tasks)` (deterministic: `TEAM_MEMBERS[Math.abs(hashCode(id)) % 6]`); `computeMemberAbilities(memberId, allTasks)` (top-5 typeCount, top-3 projCount, top-5 kwCount with weight≥2)

### State Management

- [X]T018 Create React Context store: `src/store/actions.ts` (action type union + reducer for `setRoute`, `addTask`, `updateTask`, `removeTask`, `addChatMessage`, `clearChat`, `addWikiChatMessage`, `clearWikiChat`, `resetAll`); `src/store/context.tsx` (`AppContext`, `StoreProvider` with `useEffect` → `saveState` on every state change after init, `useStore` hook)

### Shared UI Components

- [X]T019 [P] Create `src/components/common/MiraCard.tsx`: card container with `border-radius:12px`, `box-shadow:0 2px 8px rgba(27,42,78,0.04)`, and optional `title` prop rendering `<h3>` with gold left-border `::before` element and 8px gap per `demo_spec.md` §6.6
- [X]T020 [P] Create `src/components/common/ChatBubble.tsx`: accepts `role`, `content`, `time` props; user variant = deep-blue gradient bubble right-aligned; assistant variant = white bubble with border left-aligned; `marked` renders Markdown for assistant messages; timestamp in 10px muted text
- [X]T021 [P] Create `src/components/common/SourceCard.tsx`: renders list of `SourceCard[]` from AI response; `📎 来源` header; each item = blue Tag + status text per `demo_spec.md` §5.5

**Checkpoint**: `npm run tauri dev` — app loads, Tauri commands are registered (stubs), React context initializes, shared components importable, no permission errors.

---

## Phase 3: User Story 1 — App Shell & Navigation (Priority: P1) 🎯 MVP

**Goal**: Working application shell with splash screen, sidebar navigation, and dual perspective switching.

**Independent Test**: Launch app → see splash screen pulse animation → main interface loads with 随手记 as default page → switch to management perspective → 人才库 appears → switch back → hides. All five menu items navigate to placeholder pages.

- [X]T022 [P] [US1] Create `src/components/layout/BootLoader.tsx`: full-window deep-blue gradient (`linear-gradient(135deg, #1B2A4E 0%, #2C3F6B 100%)`); 🪞 logo 64px with `pulse` animation; "Mira ｜ 见微" title 32px 600 letter-spacing:4px; slogan 14px opacity:0.7; shown while `invoke('load_state')` in-flight
- [X]T023 [P] [US1] Create `src/components/layout/AppSider.tsx`: 200px width; user Avatar(36px, #E8B86D, 🪞 emoji); username "Mira·Self/Team" 13px 600; role text 11px muted; `Segmented` (👤个人/👥管理) size=small block; menu items list with selected gold-gradient border style, hover `#F5F7FB`, transition 0.15s; bottom slogan area; dispatch `setRoute` on click; hide 人才库 in personal perspective
- [X]T024 [US1] Create `src/components/layout/MainLayout.tsx`: `Layout` with Header (56px, `linear-gradient(135deg...)`, brand name) + `AppSider` + `Content` (padding:20px 28px); `RouteRenderer` mapping `route` → page component; placeholder `<div>Coming soon</div>` for unimplemented pages
- [X]T025 [US1] Create `src/App.tsx`: `ConfigProvider` with antd theme tokens (`colorPrimary:'#1B2A4E'`, `colorLink:'#E8B86D'`, `borderRadius:8`, `fontFamily`); `StoreProvider`; on mount call `loadState()` → if `tasks.length === 0` call `buildSeed()` then `saveState(seed)` → set `initialized = true` → swap `BootLoader` for `MainLayout`; import both CSS files

**Checkpoint**: App launches with pulse splash, loads (or seeds) data, shows sidebar with navigation. Perspective toggle works. Route changes render correct placeholder pages.

---

## Phase 4: User Story 2 — Task Management / 随手记 (Priority: P1)

**Goal**: Full CRUD for tasks with pending and archived columns. Data persists across restarts.

**Independent Test**: Create a task → appears in pending list top. Mark done → moves to archived with notification. Click task row → edit modal opens pre-populated → save → updated in list. Delete task with Popconfirm → removed. Restart app → all changes persist.

- [X]T026 [P] [US2] Create `src/pages/tasks/TaskModal.tsx`: antd `Modal`; fields: `Input` title (required), `TextArea` rows=3 detail, `Select` project (PROJECTS options, purple tag), `Select` priority (120px, PRIORITIES options), date `Input` type=date; default priority=`normal`, dueDate=tomorrow; validation: title non-empty else `message.warning('请输入标题')`; `onSave` dispatches `addTask` or `updateTask`
- [X]T027 [P] [US2] Create `src/pages/tasks/TaskItem.tsx`: `Checkbox` (no-op, cosmetic); title + detail; purple project Tag; priority Tag (color per PRIORITIES); type Tags in gold; complete button → `updateTask({done:true, finishedAt:Date.now()})` + `notification.success({message:'✅ 已完成', description:'「{title}」已归档', placement:'bottomRight', duration:2})`; delete `Popconfirm` title="确认删除？" → `removeTask`; click row → open edit modal
- [X]T028 [US2] Create `src/pages/tasks/TasksPage.tsx`: top card (deep-blue gradient, pending count + done count, 80px ✅ watermark opacity:0.08); left Col:15 pending list (sorted by `createdAt` desc, `TaskItem` per task, 新建任务 Button, `Empty description="暂无待办"` when empty); right Col:9 archived list (title strikethrough gray, project icon + `finishedAt` MM/DD, `max-height:calc(100vh-220px)`, `Empty description="暂无已完成事项"` PRESENTED_IMAGE_SIMPLE)
- [X]T029 [US2] Implement `load_state` and `save_state` fully in `src-tauri/src/commands/state.rs` (replace stubs): atomic write using temp file in same dir + `fs::rename`; handle `create_dir_all`; JSON pretty-print; `PersistedAppState::default()` when file missing

**Checkpoint**: Full task CRUD works end-to-end with persistence. App restart restores all task state.

---

## Phase 5: User Story 3 — Report Generation / 写总结 (Priority: P2)

**Goal**: Local personal and team report generation for daily/weekly/monthly periods, with clipboard copy. No AI in this phase.

**Independent Test**: Select tasks in personal tab → click generate → Markdown report renders. Switch period → task list updates. Click copy → "已复制" toast appears, clipboard has Markdown. Switch to team tab → select members → generate team report grouped by project.

- [X]T030 [P] [US3] Create `src/lib/report.ts`: `generatePersonalReport(tasks, period, selectedIds, projectFilter)` → Markdown with `# {项目名-}{日报/周报/月报}` header, `## 已完成工作` and `## 待完成工作` sections; `generateTeamReport(tasks, period, selectedMemberIds)` → project-grouped Markdown with participants, completed list (with member name prefix), in-progress list, team summary section per `demo_spec.md` §4.3; period cutoffs: daily=1d, weekly=7d, monthly=30d
- [X]T031 [P] [US3] Create `src/pages/report/PersonalTab.tsx`: left Col:13 task selector (project filter Select 200px, 全选/清空 buttons, tasks grouped by done/todo with Checkbox + title + detail + project Tag, `Empty description="该时段暂无工作项"`); right Col:11 report preview (`Button` generate disabled when 0 selected, `Button` copy, Markdown rendered in `.md-preview` div, empty state 📝 48px + "勾选左侧工作项后点击生成{周期}报"); no AI button yet
- [X]T032 [US3] Create `src/pages/report/TeamTab.tsx`: left Col:13 member selector (`assignTasksToMembers` to compute; each member = Avatar 36px + name+role + top-3 ability Tags + done count; 全选/清空 buttons); right Col:11 team report preview (generate disabled when 0 selected, copy button, Markdown in `.md-preview`, empty state 👥 48px + "勾选左侧团队成员后点击生成团队{周期}报"); no AI button yet
- [X]T033 [US3] Create `src/pages/report/ReportPage.tsx`: top card (deep-blue gradient, current date, 📝 watermark, `Segmented` 个人总结/团队总结, `Segmented` Daily/Weekly/Monthly); render `PersonalTab` or `TeamTab` based on active tab; pass `period` prop down

**Checkpoint**: Both personal and team reports generate correctly. Copy works. Period switching filters tasks. No AI involved yet.

---

## Phase 6: User Story 7 — Settings & API Key (Priority: P2)

**Goal**: Settings page where the user can enter and save their API key and model choice. Both stored securely in Rust. Needed before AI features can be enabled.

**Independent Test**: Open Settings → enter a valid API key → click Save → success message. Navigate away and back → input shows masked placeholder and current saved model. Restart app → API key and model persist. AI features work in subsequent phases.

- [X]T034 [US7] Implement `set_api_key`, `get_api_key_set`, and `get_model` fully in `src-tauri/src/commands/settings.rs`: use `tauri_plugin_store::StoreExt`; `set_api_key(app, key, model)` validates non-empty key, saves `api_key` and `model` to `settings.json` store; `get_api_key_set(app)` returns `true` if `api_key` is non-empty string; `get_model(app)` returns saved `model` string or `"claude-haiku-4-5"` as default
- [X]T035 [US7] Create `src/pages/settings/SettingsPage.tsx`: on mount call `getApiKeySet()` AND `getModel()` in parallel; show masked "••••••••" placeholder if key already set; `Input.Password` for new key entry; `Select` for model pre-populated with current saved model (default `claude-haiku-4-5`); Save `Button` → calls `setApiKey(key, model)` → `message.success('已保存')`; inline note "API key 存储在应用安全存储中，不会出现在前端代码或日志里"
- [X]T036 [US7] Add `getModel` wrapper to `src/hooks/useTauri.ts`: `getModel: () => invoke<string>('get_model')`; verify T015 is updated or update it now if not already done
- [X]T037 [US7] Add Settings route to navigation: add `route='settings'` case to `RouteRenderer` in `src/components/layout/MainLayout.tsx`; add Settings menu item (⚙️ icon, both perspectives) to `src/components/layout/AppSider.tsx`

**Checkpoint**: Settings page accessible from sidebar. API key and model saved and persisted across restart. `getApiKeySet()` returns `true`, `getModel()` returns saved model after restart. Raw key never visible in devtools.

---

## Phase 7: User Story 4 — AI Report Polish (Priority: P2)

**Goal**: 「AI 润色」button polishes generated reports using the real Claude API via the Rust `polish_report` command.

**Independent Test**: Generate a personal report → 「AI 润色」button appears → click it → loading state → real API response replaces preview. If API key missing → informative error pointing to Settings. Original report preserved on error.

- [X]T038 [US4] Implement `polish_report` fully in `src-tauri/src/commands/ai.rs`: read `api_key` and `model` from tauri-plugin-store; if key empty return `Err("API key not configured. Please add your API key in Settings.")`; build system prompt instructing Claude to rewrite the report with professional consulting style while preserving all facts and Markdown heading structure; call Anthropic Messages API via `reqwest`; return `{ polished_markdown: String }`
- [X]T039 [US4] Add 「AI 润色」button and loading state to `src/pages/report/PersonalTab.tsx`: show button only after report is generated; `loading` state on button while awaiting `polishReport()` invoke; on success replace `.md-preview` content with polished Markdown; on error show `message.error(errorMsg)` and keep original report intact
- [X]T040 [US4] Add 「AI 润色」button and loading state to `src/pages/report/TeamTab.tsx`: same pattern as T039 (PersonalTab)

**Checkpoint**: AI polish works end-to-end with real API response. Loading state shows. Error handled gracefully. API key check prevents crashes.

---

## Phase 8: User Story 6 — Ask Mira AI Chat / 问Mira (Priority: P2)

**Goal**: Conversational AI interface using the full task list as context, with source cards on responses.

**Independent Test**: Navigate to 问Mira → type a work question → "思考中…" loading indicator appears → real Claude response arrives with source cards → Enter sends, Shift+Enter is newline → clear history resets to empty state.

- [X]T041 [US6] Implement `ask_mira` fully in `src-tauri/src/commands/ai.rs`: read API key + model from store; build system prompt: Mira work-assistant persona + all tasks serialized as JSON context; pass full `messages` conversation history to the API; call Anthropic API; parse `content[0].text`; extract source cards by keyword-matching the user's last message against `task.title + task.detail` — return the top-3 matched tasks as `SourceCard` items; return `{ content: String, sources: Vec<SourceCard> }`
- [X]T042 [US6] Create `src/pages/ask/AskMiraPage.tsx`: top card (white bg, "🪞 Ask Mira" title, 清空历史 button → `clearChat` action); chat area `height:calc(100vh-220px)` flex column; messages using `ChatBubble` + `SourceCard` components; on send: `addChatMessage({role:'user'})` → append loading bubble (🪞 Avatar + "思考中…" half-opacity) → `askMira(chatHistory, tasks)` invoke → remove loading → `addChatMessage({role:'assistant', content, sources})`; `TextArea` autoSize minRows:1 maxRows:4; Enter sends (Shift+Enter newline); send button 40px; auto-scroll to bottom on new message; empty state 🪞 48px + "Ask Mira anything"

**Checkpoint**: Full Ask Mira flow with real API. Source cards show. Chat history persists across page navigation via Context store.

---

## Phase 9: User Story 5 — Work Library / 工作库 (Priority: P2)

**Goal**: Project cards for browsing tasks by project (no AI), plus real AI conversational insights when no project is selected.

**Independent Test**: Navigate to 工作库 → see 5 project cards with progress bars → click a card → right panel shows project detail with task lists and filters → click card again → returns to chat view → type a question in chat → "分析中…" → real AI response.

- [X]T043 [US5] Implement `ask_wiki` fully in `src-tauri/src/commands/ai.rs`: read API key + model from store; **dual-mode**: if `project_context.project_name` is empty, use a general work-assistant system prompt with ALL tasks as JSON context (same pattern as `ask_mira` but without source cards); if `project_name` is non-empty, use a project-scoped system prompt with only that project's tasks; call Anthropic API; return `{ content: String }` (no source cards)
- [X]T044 [P] [US5] Create `src/pages/wiki/ProjectCard.tsx`: project icon 24px + name + "N任务·N已完成" text + `Badge` count=pending (color: ≥80% green / ≥50% yellow / <50% red) + `Progress` small strokeColor matching completion rate + top-4 tags; `cursor:pointer`; gold `border-color:#E8B86D` when selected; hover translate(-3px) shadow; click → toggle selection
- [X]T045 [P] [US5] Create `src/pages/wiki/ProjectDetail.tsx`: header = project icon + name + 返回 Button → clear selection; 4-Select filter bar (project name label, type Select, priority Select, status Select) all size=small allowClear; two columns ✅已完成 (title strikethrough + tags + finishedAt MM/DD) and ⏳待完成 (title + tags + dueDate); `Empty description="暂无"` PRESENTED_IMAGE_SIMPLE for each empty column
- [X]T046 [P] [US5] Create `src/pages/wiki/WikiChat.tsx`: same chat UI pattern as AskMiraPage but with 📚 Avatar; loading state "分析中…"; empty state 📚 48px + "对话式工作洞察" + "点击左侧项目卡片查看详情，或在此对话提问"; calls `askWiki(wikiChatHistory, {projectName: '', tasks: allTasks})` — passing empty `projectName` triggers general-assistant mode in Rust; dispatches `addWikiChatMessage` / `clearWikiChat`
- [X]T047 [US5] Create `src/pages/wiki/WikiPage.tsx`: top card (deep-blue gradient, "按项目分类，标签筛选，对话式洞察" subtitle); left Col:8 project card list (5 `ProjectCard` components, `max-height:calc(100vh-220px)` scrollable); right Col:16 conditional: if `selectedProjectId` → `ProjectDetail` else → `WikiChat`; `selectedProjectId` state local to WikiPage

**Checkpoint**: Project cards show with correct data. Project detail filters work. AI chat in wiki returns real responses using appropriate context. Switching between chat and detail is seamless.

---

## Phase 10: User Story 8 — Talent Pool / 人才库 (Priority: P3)

**Goal**: Management-only grid of team members with auto-generated ability tags, multi-dimensional filtering, and detail modal.

**Independent Test**: Switch to management perspective → open 人才库 → 6 member cards appear with ability tags → apply project filter → non-matching members disappear → apply all filters (AND logic) → click a member card → modal opens with stats, all tags, project distribution, and recent 8 tasks.

- [X]T048 [P] [US8] Create `src/pages/talent/MemberCard.tsx`: `Avatar` 48px with `member.color` background; name + role; completed count 28px bold; completion rate `Progress` small with color by rate; ability Tags (top-4 from `computeMemberAbilities`, type→gold/project→purple/keyword→blue); `+N` when more than 4; `.project-card` CSS class (hover effect); `onClick` → open modal
- [X]T049 [P] [US8] Create `src/pages/talent/MemberModal.tsx`: `Modal` width=680, no footer; title area Avatar 40px + name + role; 3 stat `Card`s (总任务 deep-blue / 已完成 green / 能力标签数 gold); ability tags section (all tags with weight numbers, colored by category); project distribution (Progress bar per project + "N项" label); recent 8 tasks `List` sorted by `createdAt` desc (status emoji + title + tags)
- [X]T050 [US8] Create `src/pages/talent/TalentPoolPage.tsx`: top card (deep-blue gradient, "基于任务数据自动生成能力标签，多维度圈选团队成员"); filter row: project `Select` 200px + ability type `Select` 150px + keyword `Select` 150px + 重置筛选 Button; `assignTasksToMembers` → `computeMemberAbilities` for all 6 members; filter logic AND (member passes all active filters); `Row gutter={16}` 3-Col grid of `MemberCard`s; `Empty description="没有匹配的团队成员"` when none match

**Checkpoint**: All 6 members shown with correct ability tags. All 3 filter dimensions work in combination. Member modal shows correct data. Available only in management perspective.

---

## Phase 11: Polish & Cross-Cutting Concerns

**Purpose**: UI fidelity review, security verification, performance check, and final build validation.

- [ ] T051 Full UI review against `demo_spec.md` §5 (page interactions), §6 (UI spec), and §7 (states/copy): check every empty state, loading state, notification message, and font size/weight against the spec; fix any deviations; pay particular attention to chat bubble corner radii, tag colors, and Sider menu active state gradient; also time the app startup from launch to main interface on a subsequent launch and verify < 3 seconds (SC-006)
- [ ] T052 [P] Security audit: with API key set, open browser devtools in the Tauri webview (Cmd+Option+I) → verify key absent from Sources panel, Network requests from webview, Application → Local Storage, and all JS variables accessible at runtime; document result
- [ ] T053 Universal binary build: run `npm run tauri build -- --target universal-apple-darwin`; verify `.dmg` file created in `src-tauri/target/universal-apple-darwin/release/bundle/dmg/`; install and launch the `.dmg`; verify splash screen, navigation, task CRUD, and AI features work from the packaged app
- [ ] T054 [P] Run all items in `specs/001-mira-tauri-desktop/quickstart.md` validation checklist; confirm all boxes can be checked; document any remaining gaps

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 (especially T006 capabilities) — BLOCKS all user story work
- **US1 App Shell (Phase 3)**: Depends on Phase 2 (store, types, CSS, shared components)
- **US2 Task Management (Phase 4)**: Depends on Phase 3 (working routing + store)
- **US3 Report Generation (Phase 5)**: Depends on Phase 4 (real task data)
- **US7 Settings (Phase 6)**: Depends on Phase 3 (routing); can run in parallel with Phase 5
- **US4 AI Polish (Phase 7)**: Depends on Phase 5 (reports must exist) AND Phase 6 (API key + model)
- **US6 Ask Mira (Phase 8)**: Depends on Phase 6 (API key) AND Phase 4 (tasks data)
- **US5 Work Library (Phase 9)**: Shares Phase 8 Rust AI infrastructure; depends on Phase 6
- **US8 Talent Pool (Phase 10)**: Depends on Phase 4 (tasks); can run after Phase 3
- **Polish (Phase 11)**: Depends on all user stories complete

### Parallel Opportunities

- T002, T003, T005 parallel after T001; T006 after T004
- T008, T009, T010 parallel after T007; T011 after T010
- T012, T013, T014, T015, T016, T017 all parallel after T011
- T019, T020, T021 parallel after T018
- T022, T023 parallel in Phase 3
- T026, T027 parallel in Phase 4; T029 parallel to T026-T027
- T030, T031 parallel in Phase 5
- T044, T045, T046 parallel in Phase 9
- T048, T049 parallel in Phase 10
- T052, T054 parallel in Phase 11

---

## Implementation Strategy

### MVP (User Stories 1 + 2 only — Phases 1–4)

1. Complete Phase 1 (including T006 capabilities — critical)
2. Complete Phase 2: Foundational
3. Complete Phase 3: US1 App Shell
4. Complete Phase 4: US2 Task Management
5. **VALIDATE**: Launch app, create/complete/delete tasks, verify persistence across restart
6. Result: Working macOS task manager with local persistence and branded UI

### Incremental Delivery

1. MVP → Phase 5 (local reports, no AI) → copy and period-filter working
2. Phase 6 (Settings) → API key + model stored and retrievable
3. Phase 7 (AI polish) → first real AI feature active
4. Phase 8 (Ask Mira) → flagship AI feature active
5. Phase 9 (Work Library) → full AI coverage
6. Phase 10 (Talent Pool) → management features complete
7. Phase 11 (Polish + .dmg) → ship-ready

---

## Notes

- **T006 (capabilities)** must complete before any Rust command that touches the network or filesystem is tested — otherwise permission errors mask the real code behavior
- `demo_spec.md` is the single source of truth for all UI decisions; developers MUST check it before implementing any component
- `get_model` (T036) is registered as a Rust command stub in T010 and fully implemented in T034 — T036 only adds the frontend wrapper in `useTauri.ts`
- `ask_wiki` (T043) dual-mode: empty `projectName` = general assistant + all tasks; non-empty `projectName` = project-scoped + filtered tasks
- Source card extraction in `ask_mira` (T041) uses simple keyword matching (tokenize user message → search task title+detail) — NOT embedding similarity
- Never add console.log, localStorage.setItem, or any network call that could expose the API key in the frontend layer
- `[P]` = different files, no blocking dependency; safe to run in parallel
- `[USN]` label maps each task to the user story it delivers
