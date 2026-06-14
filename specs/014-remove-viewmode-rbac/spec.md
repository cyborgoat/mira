# Feature Specification: 删除视图切换 & 收紧成员权限

**Feature Branch**: `main`

**Created**: 2026-05-26

**Status**: Draft

**Input**: 删除视图切换功能，收紧成员权限（V01 + V02）

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 成员登录后无视图切换入口 (Priority: P1)

成员账号登录后，整个界面中不存在任何切换"个人视图"与"团队视图"的控件（按钮、下拉、Tab 或开关）。所有个人数据页面（待办、笔记、统计、问Mira、Mira问、知识图谱）直接展示该成员自己的数据，无需也无法切换。

**Why this priority**: 视图切换是当前最显眼的遗留逻辑，与"角色决定视图"原则冲突，且直接影响成员的使用体验。

**Independent Test**: 成员账号登录，扫描所有可见页面，确认找不到任何视图切换控件；页面数据与该账号自身数据一致。

**Acceptance Scenarios**:

1. **Given** 成员账号已登录，**When** 查看顶栏和侧边栏，**Then** 不存在"个人/团队"切换开关、下拉或任何视图选择器。
2. **Given** 成员账号已登录，**When** 打开待办、笔记、统计任意页面，**Then** 页面直接显示该成员的个人数据，无需任何切换操作。
3. **Given** 管理者账号已登录，**When** 查看界面，**Then** 同样不存在视图切换控件（管理者通过专属导航项访问团队数据，而非视图切换）。

---

### User Story 2 - 成员的"问Mira"只访问自身数据 (Priority: P2)

成员在"问Mira"页面发起 AI 问答时，系统只将该成员自己的任务和笔记作为 AI 上下文，不包含其他任何成员的信息。后端对此进行强制校验。

**Why this priority**: 数据隔离是多账号系统的核心安全要求，防止成员通过问答泄露他人数据。

**Independent Test**: 两个成员账号各自创建不同内容的笔记；以账号 A 的身份登录并提问，验证 AI 回答内容只反映账号 A 的数据。

**Acceptance Scenarios**:

1. **Given** 成员 A 已登录，**When** 在问Mira 中发送问题，**Then** AI 回答只基于成员 A 自己的任务和笔记生成。
2. **Given** 成员 B 与成员 A 的笔记内容完全不同，**When** 成员 A 提问"我最近在做什么"，**Then** 回答不包含成员 B 的任何信息。
3. **Given** 存在恶意构造的请求携带其他 account_id，**When** 后端收到该请求，**Then** 返回权限错误，拒绝执行。

---

### User Story 3 - 成员的 Lint（Mira问）只处理自身数据 (Priority: P2)

成员触发 Lint 扫描时，系统只分析该成员自己的任务和笔记，生成的 LintSession 不包含其他成员的信息，成员也无法查看其他账号的 Lint 结果。

**Why this priority**: 与"问Mira"数据隔离原则一致，保障 Lint 结果的数据边界。

**Independent Test**: 成员 A 触发 Lint，验证 LintSession 中的矛盾项和待确认项只来自成员 A 自己的数据。

**Acceptance Scenarios**:

1. **Given** 成员 A 已登录，**When** 触发 Lint 扫描，**Then** 系统只分析成员 A 的任务和笔记，不读取其他账号数据。
2. **Given** 成员 A 已登录，**When** 查看 Lint 结果列表，**Then** 只显示基于成员 A 数据生成的 LintSession。
3. **Given** 成员 A 的账号，**When** 尝试查询其他账号的 Lint 结果，**Then** 系统返回权限错误或空结果。

---

### User Story 4 - 成员的统计和知识图谱只展示自身数据 (Priority: P3)

成员在统计页面看到的所有数字（任务完成数、笔记数等）只反映自己的个人数据。知识图谱也只展示从该成员自己的任务和笔记中提取的信息，不包含其他成员的内容。

**Why this priority**: 统计和知识图谱本身不涉及跨账号 AI 调用，隔离逻辑相对简单；但其正确性对成员体验有直接影响。

**Independent Test**: 成员 A 和成员 B 各自有不同数量的任务；以成员 A 登录，验证统计页显示的数字与成员 A 的实际任务数量一致。

**Acceptance Scenarios**:

1. **Given** 成员 A 已登录，**When** 打开统计页面，**Then** 所有统计数字（任务完成数、笔记数）只计算成员 A 的数据。
2. **Given** 成员 A 已登录，**When** 打开知识图谱，**Then** 图谱节点和关系只来自成员 A 的任务和笔记。
3. **Given** 成员 A 与成员 B 统计数字不同，**When** 分别以两个账号登录查看统计，**Then** 各自看到各自的数字，互不影响。

---

### Edge Cases

- 成员通过直接输入 URL/hash 尝试访问团队统计页面时，应被重定向到待办页面（已由 Phase 6 路由守卫覆盖）。
- 成员账号的笔记或任务为空时，统计页和知识图谱显示空状态，不报错。
- 删除视图切换状态后，管理者的个人数据页面（待办、笔记等）应仍只展示管理者自己的数据，与删除前行为一致。
- 旧会话（未升级前的 session_token）登录后，数据隔离逻辑仍然正常工作。

---

## Requirements *(mandatory)*

### Functional Requirements

**V01 — 删除视图切换**

- **FR-001**: 系统 MUST 从所有页面移除「个人视图/团队视图」切换控件（按钮、Tab、下拉、开关）。
- **FR-002**: 系统 MUST 移除前端中 `viewMode`、`currentView`、`isTeamView`、`switchView` 等视图切换相关的 state、props 和函数。
- **FR-003**: 系统 MUST 确保删除视图切换逻辑后，所有数据页面（待办、笔记、统计）功能不受影响，直接展示当前登录账号的数据。
- **FR-004**: 系统 MUST 移除所有因视图切换产生的条件渲染路径（如 `viewMode === "team"` 的分支）。
- **FR-005**: 系统 MUST 移除与视图切换相关的遗留注释、变量和无用代码。

**V02 — 成员权限收紧**

- **FR-006**: 系统 MUST 保证成员账号登录后菜单只显示：待办、笔记、问Mira、Mira问、统计、知识图谱，不显示团队统计及其他团队页面。
- **FR-007**: 问Mira 后端命令 MUST 验证请求的 account_id 与当前 session 的 account_id 一致；不一致时返回权限错误。
- **FR-008**: Lint 触发和读取命令 MUST 只处理当前 session 账号的数据，不读取其他账号数据。
- **FR-009**: 统计页面 MUST 只展示当前登录账号的个人统计数据。
- **FR-010**: 知识图谱 MUST 只展示从当前登录账号的任务和笔记中提取的信息。

### Key Entities

- **Session（会话）**: 登录时确定的身份信息，包含 account_id 和 role；所有数据读取操作以此为数据边界。
- **账号隔离边界**: 每个 account_id 对应独立的数据空间（tasks.md、笔记 store、wiki schema），任何跨账号访问均视为越权。

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 成员账号登录后，在任意页面中找不到视图切换的可交互控件（零个切换按钮、下拉、Tab）。
- **SC-002**: 成员账号发起"问Mira"问答，AI 回答内容不包含其他任何账号的任务或笔记信息。
- **SC-003**: 成员账号触发 Lint，生成的 LintSession 数量和内容只反映该成员自己的数据，与其他账号的 Lint 结果相互独立。
- **SC-004**: 成员和管理者各自登录时，统计页面的数字与各自账号的实际任务和笔记数量严格一致（误差为零）。
- **SC-005**: 删除视图切换代码后，应用构建无错误、无 TypeScript 类型报错，现有测试场景（登录、待办、笔记操作）功能正常。

---

## Out of Scope

- 不改变管理者账号可见的团队统计和团队问Mira 页面（这些由 specs/013 实现，本 spec 不触及）。
- 不新增任何文案或多语言字符串（删除控件后无需替换文本）。
- 不引入新的数据库表、API 端点或外部依赖。
- 不修改账号管理面板（创建/删除/修改角色）的逻辑。

---

## Assumptions

- 当前代码库中视图切换逻辑集中在前端 `App.tsx` 和相关的 `shared.tsx` / `useMiraApi` 中，删除后不影响 Rust 侧的数据命令（Rust 已按 account_id 隔离）。
- 问Mira 的 `ask_mira` 命令已通过 `get_account_id` 从 session 获取 account_id，只需验证请求参数与 session 一致即可收紧权限。
- Lint 命令（`trigger_lint`、`get_lint_sessions`）的数据读取路径已通过 store 的 account_id 参数隔离，验证路径与问Mira 相同。
- 统计页面数据来自前端调用后端命令时传入的 account_id，已按账号隔离；如有前端聚合逻辑则一并清理。
- 知识图谱当前已按 account_id 读取 wiki_schema；若存在遗留的跨账号读取路径，一并修复。
- 删除视图切换后，`useMiraApi` 中的 `teamView`、`workView` 相关的 API 调用若依然被其他功能使用，仅删除 viewMode 切换逻辑；若完全未被使用则一并删除。
