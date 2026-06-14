# Research: 管理者专属团队功能页面

**Date**: 2026-05-26
**Spec**: specs/013-manager-team-pages/spec.md

## 1. 现有数据架构分析

### 1.1 双轨存储系统

| 层 | 实现 | 存储路径 | 数据内容 |
|----|------|---------|---------|
| Tauri Plugin Store | `tauri-plugin-store` | `mira_v2.json` | notes, wiki_schema, lint_sessions, chat_history, pending_copilot, api_key, llm_config, password_hash, lock_state |
| Workspace 文件 | Markdown 文件系统 | `workspace/people/{uuid}/` | tasks.md（任务）, notes/（笔记文件）, person.md |
| SQLite (sidecar) | `mira-api.sqlite3` | `mira-workspace/` | User, TeamNode, mira_ask_index（Ask Mira 索引） |

### 1.2 关键发现

**Tasks 存储格式**（`workspace/people/{uuid}/tasks.md`）:
```markdown
- [x] 任务标题
  - Id: task_xxx
  - Priority: normal
  - Completed: 2026-05-24T10:17:54.812Z
  - Created: 2026-05-17T00:00:00.000Z
```

**账号隔离机制已存在**: `mira_ask_index.scope_key = "ask:{person_uuid}:personal"`，说明
workspace 目录中的 `{uuid}` 就是 person/user 的身份 ID。每个 `workspace/people/{uuid}/` 目录
代表一个独立用户的工作空间。

**结论**: 账号 UUID 可直接作为 workspace person 目录名，无需额外的 team_node_id 映射。

### 1.3 现有 AppState 结构

```rust
pub struct AppState {
    pub api_key: Mutex<Option<String>>,
    pub lint_state: Mutex<LintState>,
    pub note_throttle: Mutex<HashMap<String, Instant>>,
    pub session_token: Mutex<Option<String>>,   // 当前单一 token
}
```

需扩展为携带当前账号信息。

---

## 2. 存储结构设计决策

### Decision: 账号注册表使用独立 JSON 文件
- **Chosen**: `accounts.json`（独立于业务数据，与 `mira-api.sqlite3` 同级）
- **Rationale**: 密码 hash 和角色是系统级元数据，不应混入业务 store；独立文件便于账号 CRUD 且删除账号时可独立清理业务数据。
- **Alternative considered**: 存入 SQLite — 会引入对 rusqlite 的新依赖，且 sidecar 的 User 表服务于不同目的。

### Decision: 业务数据按账号隔离为独立 store 文件
- **Chosen**: 每账号一个 `mira_acct_{account_id}.json`，全局配置保留在 `mira_v2.json`。
- **Rationale**: `tauri-plugin-store` 本身支持多路径；无需修改 store 函数签名以外的架构；删除账号时直接删除对应文件即可。
- **Alternative considered**: 在 `mira_v2.json` 中以 `{account_id}:{key}` 前缀隔离 — 会造成单文件膨胀，且无法通过文件删除清理账号数据。

### Decision: Tasks 通过 workspace 子目录按账号隔离
- **Chosen**: `workspace/people/{account_id}/tasks.md`，账号 UUID 直接作为 workspace person 目录名。
- **Rationale**: 现有 sidecar 已按此模式（`scope_key = "ask:{uuid}:personal"`）隔离数据；新账号创建时初始化对应目录即可；现有 `093c046d-...` 等目录即为旧版单账号的工作空间。
- **Alternative considered**: 在 SQLite tasks 表加 account_id 列 — 需引入 rusqlite 依赖并修改 sidecar schema。

### Decision: 团队统计直接读取文件，不经过 sidecar
- **Chosen**: `get_team_stats` Rust command 遍历 accounts.json 账号列表，直接读取各账号的 Tauri store 文件和 workspace/tasks.md，在 Rust 侧计算聚合结果。
- **Rationale**: 避免依赖 sidecar REST API 的认证流程；Rust 可直接 I/O；演示版数据量小，无性能问题。
- **Alternative considered**: 通过 sidecar REST API 聚合 — 需要管理多个 JWT token。

---

## 3. 技术栈确认

- **Rust**: 已有 uuid, chrono, serde, serde_json, tauri-plugin-store — 满足所有新增需求
- **新增 Rust 依赖**: 无（文件解析用 std::fs + serde_json，tasks.md 解析用字符串匹配）
- **Frontend**: React 18 + TypeScript + Ant Design 5.20 — 现有导航组件支持条件渲染
- **bcrypt**: 已在 Cargo.toml — 满足账号密码 hash 需求

---

## 4. 迁移策略

**检测条件**: 启动时 `accounts.json` 不存在 + `mira_v2.json` 有业务数据

**迁移步骤**:
1. 扫描 `workspace/people/` 找到第一个现有目录（即旧版唯一用户），取其 UUID 为 `default_id`
2. 如 workspace 为空，生成新 UUID 为 `default_id`
3. 创建 `accounts.json`，写入默认管理者账号（id=default_id, name="默认账号", role="manager", no password）
4. 将 `mira_v2.json` 中的 notes/wiki_schema/lint_sessions/chat_history/pending_copilot/unread_lint_count 复制到 `mira_acct_{default_id}.json`
5. 从 `mira_v2.json` 中删除上述 key（保留 api_key, llm_config）

用户无感知，启动后直接看到账号选择页。
