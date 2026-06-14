# Research: 删除视图切换 & 管理者完整视图

**Feature**: specs/014-remove-viewmode-rbac + specs/015-manager-full-view
**Date**: 2026-05-26

---

## 视图切换代码清单（V01 删除范围）

### 涉及文件（6 个文件，29 处引用）

**App.tsx**（主要改动集中地）：
- L30: import `ViewModeSwitch`
- L57: `viewMode` state
- L77: `activeView` 条件选择逻辑
- L94-95: `useEffect` viewMode/canViewTeam 联动
- L140, L154: header 文案条件分支
- L169-171: `ViewModeSwitch` 组件渲染
- L237, L247: `readOnly={viewMode === "team"}` 传给 TasksView / NotesView
- L253: `showOwners={viewMode === "team"}` 传给 StatsView
- L263: `teamView={api.teamView}` 传给 SettingsView

**useMiraApi.ts**：
- `workView` / `teamView` 双视图 state
- `/me/team-view` API 调用（canViewTeam 分支）
- 返回值中的 `workView` / `teamView`

**shared.tsx**：`ViewModeSwitch` 组件（整体删除）

**types.ts**：`ViewMode` 类型定义；`User.canViewTeam` 字段

**LlmWikiPage.tsx**：`isTeamView` 逻辑及 `view: ViewMode` 参数传递

**SettingsPage.tsx**：`teamView` prop 及 `buildStats(teamView)` 调用

> NotesPage.tsx 中的 `previewMode` 属笔记内部预览，**不在删除范围**。

---

## 删除后的影响分析

**删除 viewMode 后的数据流变化**：
- `TasksView` / `NotesView` 的 `readOnly` prop → 始终为 `false`（Tauri 模式下所有数据均为自己的，无需只读）
- `StatsView` 的 `showOwners` prop → 始终为 `false`（个人视图不显示所有者标签）
- `activeView` → 直接用 `api.workView`（成员/管理者均展示自己的数据）
- `teamView` API 调用 → 删除，`useMiraApi` 不再请求 `/me/team-view`
- `SettingsPage` 的 `teamView` prop → 删除（该 prop 仅用于 stats 展示，改由统计页直接处理）

**LlmWikiPage.tsx 的处理**：
- `viewMode` / `canViewTeam` props 删除
- `isTeamView` 逻辑删除，所有 API 调用统一用 `view: "personal"` 或直接不传
- 管理者的团队 wiki 聚合通过新的 `get_team_wiki_schema` 命令实现，不依赖 LlmWiki 的 teamView

---

## Rust 侧权限验证统一方案

**Decision**: 在 `main.rs` 中新增两个公共 helper 函数

```
pub fn require_session(app) -> Result<AccountSession, String>
pub fn require_manager_session(app) -> Result<AccountSession, String>
```

**Rationale**: 现有 `get_account_id()` 已实现 session 获取，在其基础上提取两个显式验证函数，所有 command 调用对应 helper 即可，避免每个 command 重复写验证逻辑。

**Alternatives considered**:
- 用宏（macro）统一验证：编译期开销增加，演示规模不值得
- 中间件层（middleware）：Tauri 不提供 command 中间件，需要手工拦截，复杂度过高

---

## ask_mira 团队聚合方案

**Decision**: 单一命令根据 `session.role` 自动分支

```
ask_mira:
  if role == "manager" → 聚合所有账号 notes + tasks → 团队系统提示
  if role == "member"  → 仅当前账号 notes + tasks → 个人系统提示
```

**Rationale**: 与已实现的 `ask_team_mira` 命令类似，但合并进 `ask_mira` 避免前端需要判断调用哪个命令。已有的 `ask_team_mira` 可保留（供 TeamAskMiraPage 使用）或合并，视代码复杂度决定。

---

## run_lint 团队模式方案

**Decision**: 单一 `trigger_lint` 命令根据 role 分支；团队模式下一次性将所有成员数据传给 AI，由 AI 同时识别「个人」和「团队」类矛盾

- `LintQuestion` 新增 `scope: Option<String>`（"personal" / "team"）
- `LintSession` 新增 `session_type: String`（"personal" / "team"）
- 团队 LintSession 独立存储（不覆盖已有个人 Session）

**Rationale**: AI 统一识别（用户已确认，见 spec.md Clarifications Q2）；独立存储方案（用户已确认，见 spec.md Clarifications Q1）

---

## 新增 Rust Commands

### `get_team_overview`

**复用 `get_team_stats` 返回值结构**（specs/013 已实现），在统计页直接调用，不新增独立命令。统计页通过检查 `session.role` 决定是否在底部渲染「团队概览」折叠区域。

### `get_team_wiki_schema`

新增命令，逻辑：
1. 验证 manager role
2. 读取所有账号的 wiki_schema
3. 聚合：同名项目/实体/决策去重合并，附参与成员名（用户已确认，见 spec.md Clarifications Q3）
4. 返回聚合后的 `WikiSchema` 结构

---

## Constitution 冲突记录

**Principle V 冲突**：
- 当前规定：管理者恰好 7 个导航页（最后为「账号管理」）
- 实际状态（specs/013 已实现）：管理者有 8 个导航页（+团队统计、团队问Mira）
- specs 014+015 策略：将团队数据嵌入现有页面区块，不再新增独立导航项

**建议**：执行本特性后，通过 `/speckit-constitution` 将 Principle V 更新为：
- 管理者：7 个核心导航页（同上，去掉「团队统计」和「团队问Mira」独立导航项）
- 团队数据作为管理者权限下各页面的内嵌区块，不计入导航计数
