# Feature Specification: Mira·见微 — macOS Desktop App

**Feature Branch**: `001-mira-tauri-desktop`

**Created**: 2026-05-22

**Status**: Draft

**Design Authority**: `demo_spec.md` in the project root is the single source of truth for all
UI layout, component sizing, colors, copy, empty states, loading states, and interactions.
Any detail not explicitly stated in this spec defaults to `demo_spec.md`.

---

## User Scenarios & Testing

### User Story 1 — Application Launch & Navigation (Priority: P1)

A consultant opens Mira on their Mac. A branded splash screen appears while the app loads
persisted data. Once ready, the main interface appears with the sidebar, and they can switch
between "个人" (personal) and "管理" (management) perspectives, navigating to any of the
available modules.

**Why this priority**: Without a working shell and navigation, no other feature can be used.
This is the structural foundation of the entire application.

**Independent Test**: Launch the app, see the splash screen animate, then the main layout
appears with the sidebar and 随手记 as the default page. Switch perspectives; management
view reveals the 人才库 menu item; personal view hides it. Click each menu item to navigate.

**Acceptance Scenarios**:

1. **Given** the app is launched for the first time, **When** it starts, **Then** a splash
   screen with the Mira logo pulse animation and slogan is shown, followed by the main
   interface within 2 seconds.
2. **Given** the main interface is loaded, **When** no action has been taken, **Then** the
   随手记 page is displayed by default in personal perspective.
3. **Given** the user is in personal perspective, **When** they switch to management
   perspective, **Then** the 人才库 menu item becomes visible and the current page resets
   to 随手记.
4. **Given** the user is in management perspective, **When** they switch to personal
   perspective, **Then** the 人才库 menu item is hidden.
5. **Given** no local data file exists (first launch), **When** the app loads, **Then** seed
   data is automatically generated (8 weeks of history tasks + current-week fixed tasks).

---

### User Story 2 — Task Management (随手记) (Priority: P1)

A consultant records a new task during a client call, fills in the title, project, priority,
and due date, then later marks it as done. They can also edit existing tasks and delete
irrelevant ones.

**Why this priority**: Task management is the core data-creation surface. All other modules
(reports, AI Q&A, talent pool) depend on tasks existing in the system.

**Independent Test**: Create a task, verify it appears in the pending list. Mark it done,
verify it moves to the archived column. Edit a task and verify changes persist after restart.
Delete a task and confirm it is gone.

**Acceptance Scenarios**:

1. **Given** the user clicks 新建任务, **When** they fill in a title and save, **Then** the
   task appears at the top of the pending list (sorted by creation time, descending).
2. **Given** a pending task exists, **When** the user marks it as done, **Then** it moves
   to the archived column and a notification confirms the action.
3. **Given** the user clicks a task row, **When** the edit modal opens, **Then** all
   existing field values are pre-populated and saving updates the task in place.
4. **Given** a pending task exists, **When** the user deletes it after confirming the
   Popconfirm, **Then** it is removed from the list and from persistent storage.
5. **Given** the app is restarted, **When** it loads, **Then** all previously created,
   updated, and completed tasks are restored exactly as left.
6. **Given** the user tries to save a task with an empty title, **When** they click save,
   **Then** a warning message "请输入标题" is shown and the modal remains open.

---

### User Story 3 — Report Generation (写总结) (Priority: P2)

A consultant selects tasks from the past week and generates a personal Markdown report. A
manager selects team members and generates a team report grouped by project. Either report
can be copied to the clipboard.

**Why this priority**: Report generation is the primary value-delivery mechanism for the
target users. It is independent of AI (reports are generated locally without AI involvement
until the polish step).

**Independent Test**: Select at least one task in the personal tab for the weekly period.
Click 生成周报. A formatted Markdown report appears in the preview pane. Click 复制. Then
switch to the team tab, select at least one member, generate a team report, verify it is
grouped by project.

**Acceptance Scenarios**:

1. **Given** the user selects ≥1 task on the personal tab, **When** they click generate,
   **Then** a Markdown report with "已完成工作" and "待完成工作" sections is rendered.
2. **Given** no tasks are selected, **When** the generate button is visible, **Then** it is
   disabled (cannot be clicked with zero selections).
3. **Given** a report is displayed, **When** the user clicks 复制, **Then** the raw Markdown
   text is copied to the system clipboard and a "已复制" toast appears.
4. **Given** the user selects ≥1 team member on the team tab, **When** they generate a team
   report, **Then** the report is grouped by project with per-project participant lists,
   completed items, and in-progress items, followed by a team summary section.
5. **Given** the user switches the period selector (日/周/月), **When** a period is selected,
   **Then** the task list on the left updates to show only tasks within that time window.

---

### User Story 4 — AI Report Polish (写总结 AI润色) (Priority: P2)

After generating a personal or team report, the consultant clicks 「AI 润色」 and Mira
rewrites the report in a more polished professional style. The polished result replaces the
preview.

**Why this priority**: AI polish is the key differentiator from a plain task-list export.
It must not block report generation (US3) which works without AI.

**Independent Test**: Generate a personal report. Verify the 「AI 润色」 button appears.
Click it; a loading indicator appears. When the response arrives, the preview updates with
polished content. The AI call must have reached a real API (not mocked).

**Acceptance Scenarios**:

1. **Given** a report is displayed in the preview, **When** the user clicks 「AI 润色」,
   **Then** the button enters a loading state and the preview shows a loading indicator.
2. **Given** the AI polish request is in-flight, **When** the response arrives, **Then**
   the preview is updated with the polished Markdown and the button returns to normal state.
3. **Given** the user has not configured an API key, **When** they click 「AI 润色」,
   **Then** an informative error message directs them to the Settings page to add an API key.
4. **Given** an AI polish error occurs (network failure, API error), **When** the error is
   received, **Then** the original report is preserved in the preview and an error message
   is shown.

---

### User Story 5 — Work Library AI Chat (工作库) (Priority: P2)

A consultant can browse tasks by project using the left project cards. When no project is
selected, they can type questions in a chat interface and receive real AI responses that
cite relevant task data as context.

**Why this priority**: Work library combines project-level browsing (no AI needed) with
AI-powered conversational insights — two independent value propositions.

**Independent Test**: On the wiki page with no project selected, type a work-related
question. Verify a "分析中…" loading indicator appears. When the response arrives, it
references actual task data. Then click a project card, verify the right panel switches to
the project detail view with task lists.

**Acceptance Scenarios**:

1. **Given** no project is selected, **When** the user types a question and sends it,
   **Then** a "分析中…" loading state appears and a real AI response is shown using the
   project's task data as context.
2. **Given** a project card is clicked, **When** the selection is made, **Then** the right
   panel switches to show that project's completed and pending task lists with tag filters.
3. **Given** a project is selected, **When** the user clicks the same card again or clicks
   a back button, **Then** the right panel returns to the chat interface.
4. **Given** the chat interface is showing, **When** the user sends a message while an
   AI response is pending, **Then** the input and send button are disabled until the
   response arrives.

---

### User Story 6 — Ask Mira AI Chat (问Mira) (Priority: P2)

A consultant types a free-form work question. Mira answers using the user's full task
history as context and shows source cards identifying which tasks informed the answer.

**Why this priority**: This is the flagship AI feature — the primary reason users would
choose Mira over a generic task tool.

**Independent Test**: Navigate to 问Mira. Type a question about work. Verify "思考中…"
loading indicator appears. When the response arrives, it should include source cards linking
back to relevant tasks. The clear history button removes all messages.

**Acceptance Scenarios**:

1. **Given** the user types a question and sends it, **When** the message is submitted,
   **Then** a "思考中…" indicator appears and a real AI response is returned using all
   tasks as context.
2. **Given** an AI response is returned, **When** relevant tasks are found, **Then** source
   cards appear below the response showing the referenced task titles and statuses.
3. **Given** messages exist in the chat, **When** the user clicks 清空历史, **Then** all
   messages are removed and the empty state is shown.
4. **Given** the user presses Enter in the input field, **When** the field is not empty,
   **Then** the message is sent (Shift+Enter inserts a newline instead).

---

### User Story 7 — Settings & API Key (Priority: P2)

A user navigates to Settings to enter their AI API key. The key is stored securely on the
system (not in the frontend). They can also see and change the active AI model.

**Why this priority**: All three AI features (US4, US5, US6) require a valid API key. The
Settings page is the gateway for enabling AI functionality.

**Independent Test**: Open Settings, enter a valid API key, save it. Navigate to Ask Mira
and send a question — it should succeed. Restart the app; the API key should persist without
re-entry.

**Acceptance Scenarios**:

1. **Given** the Settings page is open, **When** the user enters an API key and clicks save,
   **Then** the key is stored securely and a success message is shown.
2. **Given** an API key is saved, **When** the app is restarted, **Then** AI features work
   without the user needing to re-enter the key.
3. **Given** the Settings page is open, **When** the user views the model selector,
   **Then** they can see and change the current AI model (default: claude-haiku-4-5).
4. **Given** the API key field is displayed, **When** a key is already saved, **Then** the
   field shows a masked placeholder (e.g., "••••••••") — the raw key is never shown in
   the frontend.

---

### User Story 8 — Talent Pool (人才库) (Priority: P3)

A manager in management perspective views a grid of team members with auto-generated ability
tags based on task data. They can filter by project, ability type, or keyword, and click a
member card to see a detailed capability breakdown.

**Why this priority**: This is a management-only feature that depends on all task data
existing (US2). It adds value for managers but is not required for the core consultant workflow.

**Independent Test**: Switch to management perspective and open 人才库. Six member cards
should appear. Apply a project filter — cards not matching should disappear. Click a member
card to open the detail modal with statistics, ability tags, project distribution, and
recent tasks.

**Acceptance Scenarios**:

1. **Given** the user is in management perspective and opens 人才库, **When** the page
   loads, **Then** up to 6 team member cards are shown with ability tags derived from
   task data.
2. **Given** one or more filter selects are set, **When** the filter is applied, **Then**
   only members matching all active filters (AND logic) are shown.
3. **Given** no members match the active filters, **When** the filter is applied, **Then**
   an empty state "没有匹配的团队成员" is shown.
4. **Given** the user clicks a member card, **When** the detail modal opens, **Then** it
   shows the member's total tasks, completed tasks, ability tags with weights, project
   distribution progress bars, and up to 8 recent tasks.

---

### Edge Cases

- What happens when the Rust-side data file is corrupted or missing on startup?
  → App falls back to generating seed data and logs an error; it MUST NOT crash.
- What happens when an AI API call times out or returns an error?
  → The loading state clears, the user's input is preserved, and a non-blocking error
  message is shown.
- What happens when the API key is invalid or expired?
  → A clear error message is shown after the AI call fails, directing the user to Settings.
- What happens when the task list is empty and the user generates a report?
  → The generate button is disabled; an empty state is shown in the task selection area.
- What happens if the app window is resized below the minimum?
  → The window enforces a minimum size; content does not overflow or break.

---

## Requirements

### Functional Requirements

- **FR-001**: The application MUST display a splash screen with the Mira logo pulse animation
  on launch and transition to the main interface once data is loaded.
- **FR-002**: The application MUST load persisted task and project data from local storage on
  startup; if no data exists, it MUST generate seed data automatically.
- **FR-003**: Users MUST be able to create, read, update, and delete tasks with the fields
  defined in the data model (title, detail, project, priority, due date).
- **FR-004**: Users MUST be able to mark tasks as done; done tasks MUST appear in the
  archived column and MUST NOT appear in the pending column.
- **FR-005**: Users MUST be able to switch between personal and management perspectives;
  the 人才库 menu MUST only be visible in management perspective.
- **FR-006**: Users MUST be able to generate personal Markdown reports for daily, weekly,
  and monthly periods based on selected tasks.
- **FR-007**: Users MUST be able to generate team Markdown reports grouped by project for
  the selected period and team members.
- **FR-008**: Users MUST be able to copy generated reports to the system clipboard.
- **FR-009**: After a report is generated, users MUST be able to trigger AI polishing via
  the backend AI service; the original report MUST be preserved if polishing fails.
- **FR-010**: Users MUST be able to have real AI conversations in the 问Mira module; all
  tasks MUST be passed as context; responses MUST include source cards.
- **FR-011**: Users MUST be able to have real AI conversations in the 工作库 module when
  no project is selected; the relevant project's tasks MUST be passed as context.
- **FR-012**: Users MUST be able to browse tasks by project in the 工作库 module using
  project cards with progress indicators and task counts.
- **FR-013**: Users MUST be able to enter and save their AI API key in a Settings page;
  the key MUST be stored in secure backend storage and MUST NOT be readable by the UI layer
  (not in any browser-accessible variable, local storage, or network response).
- **FR-014**: Users MUST be able to filter team members in 人才库 by project, ability type,
  and keyword (AND logic); clicking a member card MUST open a detail modal.
- **FR-015**: All task data MUST be persisted to a local JSON file managed by the Rust
  backend; data MUST survive application restarts.
- **FR-016**: Task-to-member assignment MUST be deterministic (based on task ID hash) so
  that team report and talent pool views are stable across renders and restarts.
- **FR-017**: The application MUST enforce a minimum window size appropriate for the layout.

### Key Entities

- **Task**: Core work item with id, title, detail, projectId, priority, dueDate, done,
  tags, createdAt, finishedAt, weekKey. The primary data entity in the system.
- **Project**: A consulting engagement with id, name, color, icon. Fixed set of 5 projects.
- **ChatMessage**: A single turn in a conversation with role (user/assistant), content,
  timestamp, and optional source cards (for Ask Mira responses).
- **SourceCard**: A reference to a task attached to an AI response, with type, task title,
  and completion status.
- **TeamMember**: A fixed team member profile with id, name, role, avatar emoji, and color.
  Ability tags are computed dynamically from task data.
- **AppSettings**: User-configurable settings including AI model selection. API key is
  managed as an opaque secret on the Rust side.

---

## Success Criteria

### Measurable Outcomes

- **SC-001**: A user can create a task, mark it complete, and have it persist across app
  restarts — end-to-end in under 30 seconds.
- **SC-002**: A user can generate a personal weekly report from ≥1 selected task in under
  5 seconds (excluding AI polish time).
- **SC-003**: The AI polish, Ask Mira, and Wiki AI chat features all connect to a real
  external AI API and return non-mocked responses.
- **SC-004**: All five modules (随手记, 写总结, 工作库, 问Mira, 人才库) are navigable and
  functionally complete with no placeholder or stub content.
- **SC-005**: The visual output of the desktop app matches `demo_spec.md` brand colors
  (#1B2A4E, #E8B86D), layout proportions, and component styles to the extent that a side-
  by-side comparison shows no perceptible differences.
- **SC-006**: The app launches and reaches the main interface in under 3 seconds on a modern
  Mac (Apple Silicon or Intel).
- **SC-007**: The API key entered in Settings is never readable from the frontend (not in
  localStorage, not in any JS variable, not in network requests from the webview).
- **SC-008**: All empty states, loading states, and notification messages match the exact
  copy specified in `demo_spec.md` Section 7.

---

## Assumptions

- The target platform is macOS only (arm64 + x86_64); Windows and Linux are out of scope.
- The fixed set of 5 projects and 6 team members from `demo_spec.md` is used; no
  user-managed project or member creation is required.
- AI model default is `claude-haiku-4-5` (Anthropic API); the settings page allows the
  user to change the model string but does not validate it against a live model list.
- AI responses are returned as a single payload (no streaming); the loading indicator
  remains until the full response is received.
- User login, multi-account, system tray, menu bar persistence, and launch-at-login are
  explicitly out of scope.
- ECharts charts are explicitly out of scope (dependency is reserved but unused).
- The local data JSON file is stored in the macOS standard application support directory
  (`~/Library/Application Support/com.mira.app/`).
- No network connectivity is required except for the three AI-integrated features; the app
  MUST be fully usable offline for task management and local report generation.
