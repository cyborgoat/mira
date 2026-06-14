# Implementation Plan: 删除视图切换 & 管理者完整视图

**Branch**: `main` | **Date**: 2026-05-26 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/015-manager-full-view/spec.md`（合并 specs/014 V01+V02 和 specs/015 V03+V04）

## Summary

删除前端所有视图切换（viewMode）逻辑，改为由 session.role 在运行时自动决定每个页面的数据范围和 UI 内容。管理者登录后自动获得：问Mira 全团队聚合、Lint 跨成员矛盾检测、统计页「团队概览」折叠区域、知识图谱「团队知识图谱」区域。Rust 侧统一收紧权限验证：未登录 → 「请先登录」，越权单账号 → 「无权限访问其他账号的数据」，成员调团队命令 → 「无权限访问团队数据」。

详细代码搜索结论见：[research.md](research.md)

## Technical Context

**Language/Version**: Rust 1.x（backend）, TypeScript / React 18（frontend）

**Primary Dependencies**: Tauri 2.x, tauri-plugin-store 2.x, bcrypt 0.15, uuid 1.x, chrono 0.4, Ant Design 5.20

**Storage**:
- `mira_acct_{account_id}.json` — 每账号私有 Tauri Store（现有，含 wiki_schema）
- `accounts.json` — 账号注册表（现有）
- `mira_v2.json` — 全局配置（现有，不变）

**Testing**: 手动验证（演示版）

**Target Platform**: macOS desktop（Tauri 2.x）

**Performance Goals**: 页面加载 ≤2 秒（本地 I/O，演示数量级）

**Constraints**: 纯本地离线；AI 上下文截断 ≤8000 字符；bcrypt cost=12

**Scale/Scope**: 演示版，2-10 个账号

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. macOS Desktop Application | ✅ Pass | Tauri 2.x，纯本地 |
| II. Local Authentication | ✅ Pass | session.role 在 login_account 时确定，始终随 session 携带 |
| III. AI-First Background Intelligence | ✅ Pass | ask_mira / trigger_lint 根据 role 分支，均检查 API key |
| IV. Invisible LLM Wiki | ✅ Pass | LlmWiki 不暴露至导航 |
| V. Navigation Structure | ⚠️ Amendment Needed | 当前代码（specs/013）管理者有 8 个导航项（+团队统计、团队问Mira），违反"恰好 7 项"规定。本 spec 策略：团队数据改为嵌入现有页面区块，不再保留独立导航项（详见 Complexity Tracking） |
| VI. Chinese-Only Frontend | ✅ Pass | 新增文案均为中文 |
| VII. UI Design Standards | ✅ Pass | 沿用 24px padding, #1B2A4E, #E8B86D, 8px radius |
| VIII. API Key Isolation | ✅ Pass | API key 仅在 Rust 侧 |
| IX. AI Feature Gate | ✅ Pass | ask_mira / trigger_lint 均检查 API key |
| X. Tauri Command Architecture | ✅ Pass | 所有 AI 调用经 Tauri invoke |
| XI. Non-Intrusive Copilot | ✅ Pass | 不涉及 |
| XII. System-Initiated Mira Ask | ✅ Pass | 不涉及 |
| XIII. Minimal Dependency | ✅ Pass | 无新依赖 |
| XIV. Multi-Account Local Storage | ✅ Pass | 所有数据查询以 account_id 隔离 |
| XV. Role-Based Access Control | ✅ Pass | 权限验证加固是本 spec 核心任务 |
| XVI. Account Management Page | ✅ Pass | 账号管理功能不变 |

**⚠️ Constitution Amendment Required**: Principle V 需更新——管理者导航中移除「团队统计」和「团队问Mira」独立项，改为在统计页和知识图谱页嵌入团队区块。建议实现完成后执行 `/speckit-constitution`。

## Project Structure

### Documentation (this feature)

```text
specs/015-manager-full-view/
├── plan.md              ← 本文件
├── research.md          ← 视图切换代码清单 + 技术决策
├── data-model.md        ← LintQuestion/LintSession 模型变更
└── tasks.md             ← 待生成（/speckit-tasks）
```

### Source Code

```text
apps/web/src-tauri/src/
├── main.rs                       ← 新增 require_session / require_manager_session helpers
├── commands/
│   ├── ask_mira.rs               ← ask_mira 根据 role 分支；权限验证
│   ├── wiki.rs                   ← trigger_lint 根据 role 分支；新增 get_team_wiki_schema
│   ├── notes.rs                  ← 权限验证加固
│   ├── settings.rs               ← 无需改动
│   ├── auth.rs                   ← 无需改动（已有 require_manager）
│   └── team_stats.rs             ← 已实现，复用于统计页团队概览

apps/web/src/app/
├── App.tsx                       ← 删除 viewMode / ViewModeSwitch / activeView 等（13 处）
├── useMiraApi.ts                 ← 删除 teamView / workView 双视图，统一用 workView（5 处）
├── types.ts                      ← 删除 ViewMode 类型；删除 User.canViewTeam（2 处）
├── useTauriApi.ts                ← 新增 getTeamWikiSchema invoke wrapper
├── shared.tsx                    ← 删除 ViewModeSwitch 组件（1 处）
└── pages/
    ├── AskMiraPage.tsx           ← 根据 session.role 显示提示文字和预设问题（需传入 session）
    ├── MiraAskPage.tsx           ← 团队 LintSession 卡片蓝色背景 + 「团队」标签
    ├── StatsPage.tsx             ← manager 底部显示「团队概览」折叠区域
    ├── KnowledgeGraphPage.tsx    ← manager 底部显示「团队知识图谱」区域
    ├── LlmWikiPage.tsx           ← 删除 viewMode / isTeamView 相关逻辑（6 处）
    ├── SettingsPage.tsx          ← 删除 teamView prop（2 处）
    ├── TasksPage.tsx             ← readOnly prop 改为始终 false
    └── NotesPage.tsx             ← readOnly prop 改为始终 false
```

## Implementation Order

按用户指定的顺序，分 9 个阶段：

1. **前端删除视图切换代码**（清理优先，避免后续冲突）
2. **Rust 权限验证加固**（所有 command 加 role/account_id 检查）
3. **ask_mira 根据 role 切换聚合逻辑**
4. **run_lint 根据 role 切换处理范围**（+新 get_team_wiki_schema command）
5. **菜单动态渲染**（移除团队统计/团队问Mira 独立导航项）
6. **问Mira 页面根据 role 显示不同提示和快捷问题**
7. **Mira问页面团队问题标注**（蓝色卡片 + 「团队」标签）
8. **统计页面团队概览区域**（manager 底部折叠区）
9. **知识图谱团队区域**（manager 底部聚合区）

## Complexity Tracking

| 决策 | 原因 | 被拒绝的更简单方案 |
|------|------|-----------------|
| 团队数据嵌入现有页面而非独立导航项 | 修复 Principle V 违规（specs/013 导致 8 个导航项）；管理者无需额外导航切换 | 保留独立「团队统计」导航 — 继续违反 constitution |
| ask_mira 单命令按 role 分支 | 前端无需判断调用哪个命令；与 trigger_lint 模式一致 | 保留 ask_team_mira 独立命令 — 前端增加分支判断 |
| LintSession 独立存储（非覆盖） | 用户确认（clarification Q1）；历史记录可追溯 | 覆盖个人 Session — 破坏历史可追溯性 |
