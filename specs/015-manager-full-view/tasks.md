# Tasks: 删除视图切换 & 管理者完整视图

**Input**: Design documents from `specs/015-manager-full-view/`

**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅

**Tests**: 手动验证（演示版），无自动化测试任务。

**Organization**: 按实施阶段分组，Phase 3（US5）和 Phase 4（US1）为 P1 优先级，Phase 5-6（US2-3）为 P2，Phase 7（US4）为 P3。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 可并行执行（不同文件，无依赖关系）
- **[Story]**: 归属用户故事
- 所有路径相对仓库根目录

---

## Phase 1: Setup（共享基础设施）

**Purpose**: 在 Rust 侧建立统一的权限验证 helper，供所有后续 command 复用。

**⚠️ CRITICAL**: Phase 3（权限加固）全部依赖此 helper，必须先完成。

- [X] T001 在 `apps/web/src-tauri/src/main.rs` 中新增两个公共 helper 函数：`pub fn require_session(app: &tauri::AppHandle) -> Result<AccountSession, String>`（session 不存在返回 `"请先登录"`）和 `pub fn require_manager_session(app: &tauri::AppHandle) -> Result<AccountSession, String>`（在 require_session 基础上验证 role == "manager"，否则返回 `"无权限访问团队数据"`）

---

## Phase 2: Foundational — 前端删除视图切换（阻塞性前置工作）

**Purpose**: 删除所有 viewMode 相关代码，避免后续实现产生冲突。research.md 列出 6 个文件 29 处引用。

**⚠️ CRITICAL**: 所有前端 US 实现都依赖此清理完成后的干净代码库。

**Checkpoint**: 完成后前端可正常编译，无 viewMode / ViewMode / ViewModeSwitch 符号引用。

- [ ] T002 在 `apps/web/src/app/types.ts` 中删除 `export type ViewMode = "personal" | "team"` 类型定义；删除 `User` 类型的 `canViewTeam: boolean` 字段
- [ ] T003 [P] 在 `apps/web/src/app/shared.tsx` 中删除 `ViewModeSwitch` 组件（整体删除，包含其 import 和 export）
- [ ] T004 [P] 在 `apps/web/src/app/useMiraApi.ts` 中删除 `teamView` state 及 `/me/team-view` API 调用分支；保留 `workView` 作为统一视图 state；从返回值中移除 `teamView`
- [ ] T005 [P] 在 `apps/web/src/app/pages/LlmWikiPage.tsx` 中删除 `viewMode` / `isTeamView` / `view: ViewMode` 相关逻辑（共 6 处）；所有 API 调用统一使用 `"personal"` 或移除 view 参数
- [ ] T006 [P] 在 `apps/web/src/app/pages/SettingsPage.tsx` 中删除 `teamView` prop 接收及 `buildStats(teamView)` 调用（共 2 处）
- [ ] T007 [P] 在 `apps/web/src/app/pages/TasksPage.tsx` 中删除 `readOnly` prop 接收；组件内部始终以非只读模式渲染
- [ ] T008 [P] 在 `apps/web/src/app/pages/NotesPage.tsx` 中删除 `readOnly` prop 接收；组件内部始终以非只读模式渲染
- [ ] T009 在 `apps/web/src/app/App.tsx` 中执行综合清理（13 处）：删除 `viewMode` state（L57）、`activeView` 条件逻辑（L77）、viewMode/canViewTeam useEffect（L94-95）、header 文案条件分支（L140, L154）、`ViewModeSwitch` 渲染（L169-171）、`readOnly={viewMode === "team"}` props（L237, L247）、`showOwners={viewMode === "team"}` prop（L253）、`teamView={api.teamView}` prop（L263）；用 `api.workView` 直接替代 `activeView`；从导航菜单和路由中移除 `TeamAskMiraPage` 和 `TeamStatsPage`（管理者导航项收回到 7 个）

---

## Phase 3: User Story 5 — Rust 侧权限验证加固（Priority: P1）🎯 MVP

**Goal**: 所有数据命令加统一权限验证：未登录 → 「请先登录」，越权单账号 → 「无权限访问其他账号的数据」，成员调团队命令 → 「无权限访问团队数据」。

**Independent Test**: 成员账号登录 → 通过开发工具调用 `get_team_stats` → 收到「无权限访问团队数据」错误，无数据泄漏。

- [X] T010 [P] [US5] 在 `apps/web/src-tauri/src/commands/notes.rs` 的所有命令开头调用 `require_session(&app)?`；对含 `account_id` 参数的命令，验证 `account_id == session.account_id`，不匹配时返回 `"无权限访问其他账号的数据"`（notes 命令均不接受显式 account_id 参数，现有 get_account_id() 已防止越权，无需额外改动）
- [X] T011 [P] [US5] 在 `apps/web/src-tauri/src/commands/wiki.rs` 的单账号命令中调用 `require_session(&app)?` 并验证 account_id；在现有团队命令（`get_team_stats` 等）中调用 `require_manager_session(&app)?`（team_stats.rs::get_team_stats 已更新为 require_manager_session，错误由 "unauthorized" 改为 "无权限访问团队数据"）
- [X] T012 [P] [US5] 在 `apps/web/src-tauri/src/commands/ask_mira.rs` 的 `ask_mira` 命令开头调用 `require_session(&app)?`（ask_team_mira 已更新为 require_manager_session，错误消息统一为中文）
- [ ] T013 [US5] 在 `apps/web/src/app/App.tsx` 中添加全局 invoke 错误拦截：任意页面收到 `"not_logged_in"` 或 `"请先登录"` 错误时，清空 session state 并跳转到登录页（可通过统一 wrapper 函数或 React error boundary 实现）

**Checkpoint**: Phase 3 完成后，越权调用和未登录调用均被正确拦截。

---

## Phase 4: User Story 1 — 管理者问Mira 自动聚合全团队数据（Priority: P1）

**Goal**: 管理者打开问Mira 时，AI 上下文自动包含所有成员数据；页面显示团队模式提示；Tab 键显示 4 个管理者预设问题。

**Independent Test**: 两个成员各有唯一关键词的笔记 → 管理者登录 → 问Mira 提问"大家在做什么" → AI 回答同时包含两个成员的关键词，页面显示「当前基于全团队数据回答」。

- [X] T014 [US1] 重写 `apps/web/src-tauri/src/commands/ask_mira.rs` 中的 `ask_mira` 命令逻辑：`role == "manager"` 时读取所有非删除账号的 notes + wiki_schema，合并为团队上下文字符串（截断至 8000 字符），使用团队系统提示（「以下是团队所有成员的工作数据」）调用 AI；`role == "member"` 时仅使用当前账号数据和个人系统提示；删除或保留 `ask_team_mira` 命令（不再对外暴露，从 invoke_handler 移除）
- [X] T015 [US1] 更新 `apps/web/src/app/pages/AskMiraPage.tsx`：接收 `session` prop（或从 context 读取）；当 `session.role === "manager"` 时，在输入框上方渲染一行浅灰色小字「当前基于全团队数据回答」；Tab 预设快捷问题：manager → 4 项（写日报 / 写周报 / 本周各项目进展汇总 / 哪个项目进展最慢），member → 3 项（写日报 / 写周报 / 写月报）

**Checkpoint**: Phase 4 完成后，管理者和成员的问Mira 体验分别符合 US1 验收场景。

---

## Phase 5: User Story 2 — 管理者 Lint 全团队模式（Priority: P2）

**Goal**: 管理者触发 Lint 时处理全团队数据；AI 分类个人/团队矛盾；Mira问页面团队卡片蓝色高亮。

**Independent Test**: 两成员对同一项目有矛盾描述 → 管理者触发 Lint → Mira问页面出现浅蓝色「团队」问题卡片，「个人」卡片使用默认白色背景。

- [X] T016 [US2] 在 LintQuestion 和 LintSession 的 Rust 结构体中新增字段（定位在 `apps/web/src-tauri/src/commands/wiki.rs` 或 `apps/web/src-tauri/src/models/` 目录的相关文件）：`LintQuestion` 新增 `scope: Option<String>`（"personal" | "team"，nil 向后兼容视为 "personal"）；`LintSession` 新增 `session_type: Option<String>`（"personal" | "team"）；同步更新前端 TypeScript 类型 `apps/web/src/app/types.ts` 中的对应接口
- [X] T017 [US2] 在 `apps/web/src-tauri/src/commands/wiki.rs` 中更新 `trigger_lint` 命令：`role == "manager"` 时读取所有非删除账号数据，构建团队 Lint 提示词（要求 AI 输出 JSON，每条 LintQuestion 含 scope 字段区分 "personal"/"team"），写入新建的独立 LintSession（`session_type: "team"`，不覆盖已有个人 Session）；`role == "member"` 时仅处理当前账号，`session_type: "personal"`，所有 question `scope: "personal"`
- [X] T018 [US2] 在 `apps/web/src/app/pages/MiraAskPage.tsx` 中更新 LintSession 卡片渲染：对 `session_type === "team"` 的 Session 在标题区显示蓝色「团队」Tag 标签；对 `scope === "team"` 的 LintQuestion 卡片使用 `background: #e6f4ff`（Ant Design token `colorInfoBg`）；`scope === "personal"` 卡片保持默认白色背景

**Checkpoint**: Phase 5 完成后，管理者 Lint 结果正确分类，前端视觉区分符合 US2 验收场景。

---

## Phase 6: User Story 3 — 统计页「团队概览」区域（Priority: P2）

**Goal**: 管理者打开统计页时，页面底部自动出现默认展开的「团队概览」折叠区域，显示本周团队汇总数据。

**Independent Test**: 两成员各完成若干任务 → 管理者打开统计页 → 「团队概览」区域显示正确的任务总数和活跃成员数；成员打开统计页 → 无「团队概览」区域。

- [ ] T019 [US3] 在 `apps/web/src/app/pages/StatsPage.tsx` 中，当 `session.role === "manager"` 时：于个人统计区域下方渲染 Ant Design `<Collapse>` 组件，标题「团队概览」，`defaultActiveKey` 设为展开状态；Collapse 面板内调用 `tauriStats.getTeamStats()`（specs/013 已实现命令），展示本周团队完成待办总数、活跃成员数、各项目进度条（`<Progress>`）；`role === "member"` 时不渲染该 Collapse

**Checkpoint**: Phase 6 完成后，管理者统计页符合 US3 验收场景。

---

## Phase 7: User Story 4 — 知识图谱「团队知识图谱」区域（Priority: P3）

**Goal**: 新增 `get_team_wiki_schema` Rust 命令，聚合所有成员 wiki schema 并去重；知识图谱页管理者底部显示「团队知识图谱」区域。

**Independent Test**: 两成员各有不同项目/实体 → 管理者打开知识图谱 → 「团队知识图谱」同时展示两成员的项目（同名合并并附成员名）和实体。

- [ ] T020 [P] [US4] 在 `apps/web/src-tauri/src/commands/wiki.rs` 中新增 `get_team_wiki_schema` 命令（调用 `require_manager_session(&app)?`）：读取所有非删除账号的 wiki_schema；按 data-model.md 去重规则聚合：Projects（同 name → 合并，members 含所有来源账号名，taskCount 取最大，status 优先级 done > active > paused）、Entities（同 name + type → 合并 members）、Decisions（同 description → 合并 members）；返回 `TeamWikiSchema { projects, entities, decisions }` 结构
- [ ] T021 [P] [US4] 在 `apps/web/src-tauri/src/main.rs` 的 `tauri::generate_handler!` 列表中注册 `commands::wiki::get_team_wiki_schema`
- [ ] T022 [P] [US4] 在 `apps/web/src/app/useTauriApi.ts` 中添加 `getTeamWikiSchema: () => invoke<TeamWikiSchema>("get_team_wiki_schema")` wrapper；在 `apps/web/src/app/types.ts` 中添加 `TeamWikiSchema`、`TeamWikiProject`、`TeamWikiEntity`、`TeamWikiDecision` TypeScript 接口（对应 data-model.md）
- [ ] T023 [US4] 在 `apps/web/src/app/pages/KnowledgeGraphPage.tsx` 中，当 `session.role === "manager"` 时：调用 `getTeamWikiSchema()`；于个人知识图谱区域下方渲染「团队知识图谱」分区，展示 Projects（附「成员A、成员B」注释）、Entities、Decisions 列表；`role === "member"` 时不渲染

**Checkpoint**: Phase 7 完成后，管理者知识图谱页符合 US4 验收场景。

---

## Phase 8: Polish & 收尾

**Purpose**: 确认导航项目数符合 Constitution Principle V（管理者恰好 7 项），清理残余代码。

- [ ] T024 [P] 在 `apps/web/src-tauri/src/main.rs` 中从 `tauri::generate_handler!` 移除 `ask_team_mira`（已被重写后的 `ask_mira` 按 role 替代），避免死代码保留
- [ ] T025 [P] 在 `apps/web/src/app/App.tsx` 中确认管理者导航菜单恰好 7 项：问Mira / Mira问 / 统计 / 知识图谱 / 笔记 / 任务 / 账号管理；如有多余项残留则删除
- [ ] T026 [P] 全局搜索 `viewMode`、`ViewMode`、`ViewModeSwitch`、`teamView`、`canViewTeam`、`isTeamView`、`activeView` 关键词，确认所有文件均已清除，无编译警告

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1（Setup）**: 无依赖，立即开始
- **Phase 2（Foundational）**: 无依赖于 Phase 1，可与 Phase 1 并行；**阻塞所有前端 Phase**
- **Phase 3（US5）**: 依赖 Phase 1 完成（require_session helper）；不依赖 Phase 2
- **Phase 4（US1）**: 依赖 Phase 2（viewMode 已清理）；依赖 Phase 3（ask_mira 已加权限验证）
- **Phase 5（US2）**: 依赖 Phase 2；依赖 Phase 3（wiki.rs 权限加固先于 trigger_lint 团队逻辑）
- **Phase 6（US3）**: 依赖 Phase 2；Phase 3 建议先完成（StatsPage 底层命令需权限保护）
- **Phase 7（US4）**: 依赖 Phase 1（require_manager_session）；可与 Phase 4-6 并行（不同文件）
- **Phase 8（Polish）**: 依赖所有实现 Phase 完成

### User Story Dependencies

| Story | Priority | 依赖 | 可并行开始于 |
|-------|----------|------|-----------|
| US5（权限加固）| P1 | Phase 1 | Phase 1 完成后 |
| US1（问Mira 聚合）| P1 | Phase 2 + Phase 3 | Phase 2 & 3 均完成后 |
| US2（Lint 团队模式）| P2 | Phase 2 + Phase 3 | Phase 2 & 3 均完成后，可与 US1 并行 |
| US3（统计团队概览）| P2 | Phase 2 + Phase 3 | 同上，可与 US1/US2 并行 |
| US4（知识图谱聚合）| P3 | Phase 1 + Phase 2 | Phase 1 & 2 完成后，可与 US1-3 并行 |

### Parallel Opportunities

```text
# 同时启动（无任何依赖）：
T001（Rust helper）, T002-T008（前端清理各文件）

# Phase 1 完成后可并行：
T010, T011, T012（各 Rust command 权限加固）

# Phase 2 & 3 完成后可并行：
T014（ask_mira Rust）, T016（数据模型字段），
T019（StatsPage），T020/T021/T022（知识图谱 Rust+TS）

# T020/T021/T022 完成后：
T023（KnowledgeGraphPage）
```

---

## Implementation Strategy

### MVP（US5 + US1，两个 P1 故事）

1. 完成 Phase 1（T001）
2. 完成 Phase 2（T002-T009）
3. 完成 Phase 3（T010-T013）
4. 完成 Phase 4（T014-T015）
5. **验证 MVP**：管理者问Mira 聚合全团队，权限加固生效
6. 演示/交付 MVP

### 完整交付顺序

1. MVP（US5 + US1）
2. 加 US2（Lint 团队模式）→ 独立验证
3. 加 US3（统计团队概览）→ 独立验证
4. 加 US4（知识图谱团队区域）→ 独立验证
5. Phase 8 收尾验证

---

## Notes

- [P] 任务 = 不同文件，可并行，无先后依赖
- [US?] 标签映射到 spec.md 中的用户故事，便于追踪
- Phase 2（前端清理）是最关键的基础：清理后代码结构更清晰，后续实现不易出错
- Rust helper（T001）的签名为 `pub fn`，需确保 `commands/*.rs` 可通过 `crate::require_session` 调用
- `trigger_lint` 团队模式（T017）的 AI prompt 需明确要求返回结构化 JSON（含 scope 字段），否则解析失败
- `get_team_wiki_schema`（T020）去重逻辑：status 优先级 done > active > paused（data-model.md 已确认）
- Constitution Principle V 合规（T025）：管理者 7 个导航项，团队数据嵌入现有页面，不作为独立导航
