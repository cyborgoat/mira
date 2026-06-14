# Implementation Plan: 管理者专属团队功能页面

**Branch**: `feature/team-roles-demo` | **Date**: 2026-05-26 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/013-manager-team-pages/spec.md`

## Summary

为 Mira 实现本地多账号系统（account_id 隔离存储）和两个管理者专属页面：「团队统计」聚合
全账号任务和笔记数据展示，「团队问Mira」以所有成员数据为上下文调用 AI 回答跨团队问题。
底层采用 accounts.json 账号注册表 + 每账号独立 Tauri Store 文件的双层隔离方案。

详细存储结构见: [data-model.md](data-model.md)
研究结论见: [research.md](research.md)

## Technical Context

**Language/Version**: Rust (backend commands), TypeScript/React 18 (frontend)

**Primary Dependencies**: tauri 2.x, tauri-plugin-store 2.x, bcrypt 0.15, uuid 1.x, chrono 0.4, Ant Design 5.20

**Storage**:
- `accounts.json` — 账号注册表（新增）
- `mira_acct_{account_id}.json` — 每账号私有 Tauri Store（新增）
- `mira_v2.json` — 全局配置（api_key, llm_config，保留）
- `workspace/people/{account_id}/tasks.md` — 每账号任务（现有格式）
- `mira-api.sqlite3` — sidecar DB（不变）

**Testing**: 手动验证（演示版，无自动化测试）

**Target Platform**: macOS desktop（Tauri 2.x）

**Performance Goals**: 团队统计页面 ≤10s 加载（本地文件 I/O，演示数量级）

**Constraints**: 纯本地离线；无网络依赖；bcrypt cost=12；session token 仅存内存

**Scale/Scope**: 演示版，预计 2-10 个账号，无高并发需求

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. macOS Desktop Application | ✅ Pass | Tauri 2.x，纯本地 |
| II. Local Authentication | ✅ Pass | 每账号 bcrypt hash；session 仅内存；login_account 新增 |
| III. AI-First Background Intelligence | ✅ Pass | ask_team_mira 检查 API key |
| IV. Invisible LLM Wiki | ✅ Pass | 不涉及 Wiki 暴露 |
| V. Navigation Structure | ⚠️ Amendment Required | 管理者页面从 7 页扩展至 9 页（团队统计、团队问Mira 新增）；需修订 constitution v4 → v5 |
| VI. Chinese-Only Frontend | ✅ Pass | 所有新增文案为中文 |
| VII. UI Design Standards | ✅ Pass | 沿用 24px padding, #1B2A4E, #E8B86D, 8px radius |
| VIII. API Key Isolation | ✅ Pass | API key 仍仅在 Rust 侧 |
| IX. AI Feature Gate | ✅ Pass | ask_team_mira 检查 API key 配置 |
| X. Tauri Command Architecture | ✅ Pass | 所有新增 AI 调用经 Tauri invoke |
| XI. Non-Intrusive Copilot | ✅ Pass | 不涉及 |
| XII. System-Initiated Mira Ask | ✅ Pass | 不涉及 |
| XIII. Minimal Dependency | ✅ Pass | 无新依赖引入 |
| XIV. Multi-Account Local Storage | ✅ Pass | accounts.json + per-account store 是本 feature 核心实现 |
| XV. Role-Based Access Control | ✅ Pass | manager-only commands 检查 role |
| XVI. Account Management Page | ✅ Pass | 团队统计/团队问Mira 为 manager-only 页面 |

**⚠️ Constitution Amendment Required**: Principle V 需要更新管理者页面数量（7 → 9），建议在实现前执行 `/speckit-constitution`。

## Project Structure

### Documentation (this feature)

```text
specs/013-manager-team-pages/
├── plan.md              ← 本文件
├── research.md          ← 存储架构研究结论
├── data-model.md        ← accounts.json 格式 + 数据隔离方案
└── tasks.md             ← 待生成（/speckit-tasks）
```

### Source Code

```text
apps/web/src-tauri/src/
├── main.rs                           ← AppState 新增 current_account
├── store.rs                          ← 账号私有数据函数加 account_id 参数
├── commands/
│   ├── auth.rs                       ← 改造：login_account 替换原 login；加 list_accounts 等
│   ├── notes.rs                      ← 改造：传入 account_id
│   ├── wiki.rs                       ← 改造：传入 account_id
│   ├── ask_mira.rs                   ← 改造：传入 account_id；新增 ask_team_mira
│   ├── settings.rs                   ← 无需改动（全局 api_key/llm_config）
│   └── team_stats.rs                 ← 新增：get_team_stats
├── models/
│   ├── account.rs                    ← 新增：Account, AccountInfo, SessionInfo
│   └── team_stats.rs                 ← 新增：TeamStats, MemberStat, GroupStat

apps/web/src/app/
├── App.tsx                           ← session state 加 role；菜单动态渲染
├── pages/
│   ├── LoginPage.tsx                 ← 改造：账号列表 → 选择 → 密码输入
│   ├── SettingsPage.tsx              ← 加 AccountManagementPanel（仅 manager）
│   ├── TeamStatsPage.tsx             ← 新增
│   └── TeamAskMiraPage.tsx           ← 新增（复用 AskMiraPage 布局）
└── useTauriApi.ts                    ← 新增账号管理 + 团队功能 invoke 函数
```

## Implementation Order

参考用户指定的实现顺序，分为 7 个阶段：

1. **Rust 账号系统** — accounts.json + 5 个账号 command（list/create/delete/update_role/login）
2. **数据隔离** — store.rs 加 account_id 参数；现有 command 从 AppState 取 account_id
3. **数据迁移** — startup 检测旧数据并迁移至 default account
4. **登录页改造** — 账号卡片列表 → 点击 → 密码输入 → 登录
5. **Session + 菜单权限** — 前端 session 加 role；菜单按 role 动态渲染
6. **设置页账号管理面板** — AccountManagementPanel（仅 manager 可见）
7. **团队统计页面** — TeamStatsPage + get_team_stats Rust command
8. **团队问Mira 页面** — TeamAskMiraPage + ask_team_mira Rust command

## Complexity Tracking

| 决策 | 原因 | 被拒绝的更简单方案 |
|------|------|-----------------|
| 每账号独立 store 文件而非 key 前缀 | 删除账号时可直接删文件；无 key 污染 | `{account_id}:notes` 前缀 — 文件膨胀，无法通过文件删除清理 |
| 账号 UUID = workspace/people 目录名 | 复用现有 sidecar 隔离模式；零额外映射 | 单独 team_node_id 字段 — 引入额外 sidecar 耦合 |
| tasks.md 文本解析而非 rusqlite | 无需新依赖；演示量级 I/O 足够 | 加 rusqlite 查 SQLite 任务表 — 任务实际在文件系统而非 SQLite |
