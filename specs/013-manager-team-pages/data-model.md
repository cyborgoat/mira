# Data Model: 管理者专属团队功能页面

**Date**: 2026-05-26

---

## 一、文件系统布局

```
{data_dir}/                                  ← mira_data_dir() 返回的根目录
├── accounts.json                            ← 账号注册表（新增）
├── mira_v2.json                             ← 全局配置（仅保留 api_key, llm_config）
├── mira_acct_{account_id_1}.json            ← 账号1私有数据（新增）
├── mira_acct_{account_id_2}.json            ← 账号2私有数据（新增）
├── mira-api.sqlite3                         ← Sidecar DB（不变）
└── workspace/
    ├── people/
    │   ├── {account_id_1}/                  ← 账号1工作空间（已有或新建）
    │   │   ├── person.md
    │   │   ├── tasks.md                     ← 账号1的任务（markdown）
    │   │   └── notes/
    │   │       └── *.md
    │   └── {account_id_2}/                  ← 账号2工作空间（新增）
    └── README.md
```

> **设计原则**: 账号 UUID 直接等于 workspace/people 子目录名，无需额外映射表。

---

## 二、accounts.json 格式

```json
{
  "version": 1,
  "accounts": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "张三",
      "password_hash": "$2b$12$abcdefghijklmnopqrstuuVGZzL6Cq/LiQ2aJrSQ...",
      "role": "manager",
      "created_at": "2026-05-26T00:00:00Z",
      "fail_count": 0,
      "locked_at": null
    },
    {
      "id": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
      "name": "李四",
      "password_hash": "$2b$12$...",
      "role": "member",
      "created_at": "2026-05-26T01:00:00Z",
      "fail_count": 0,
      "locked_at": null
    }
  ]
}
```

**字段说明**:

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | UUID string | 账号唯一标识，同时作为 workspace/people/{id}/ 目录名 |
| `name` | String | 显示名称 |
| `password_hash` | String | bcrypt hash（cost=12）；迁移默认账号为空字符串 |
| `role` | "member" \| "manager" | 角色 |
| `created_at` | ISO 8601 | 创建时间 |
| `fail_count` | u32 | 登录失败次数（暴力破解防护） |
| `locked_at` | ISO 8601 \| null | 锁定时间（null=未锁定） |

---

## 三、mira_acct_{account_id}.json 格式

与现有 `mira_v2.json` 结构完全相同，仅包含账号私有数据：

```json
{
  "notes": [ { "id": "...", "content": "...", "created_at": "...", "updated_at": "..." } ],
  "wiki_schema": { "projects": [], "entities": [], "decisions": [] },
  "lint_sessions": [],
  "chat_history": [],
  "pending_copilot": [],
  "unread_lint_count": 0
}
```

**全局 mira_v2.json 保留**:

```json
{
  "api_key": "sk-ant-...",
  "llm_config": { "provider": "claude", "base_url": "...", "model": "..." }
}
```

---

## 四、Rust 数据模型（新增类型）

```rust
// accounts.json 中的账号记录
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Account {
    pub id: String,
    pub name: String,
    pub password_hash: String,
    pub role: String,               // "member" | "manager"
    pub created_at: String,
    pub fail_count: u32,
    pub locked_at: Option<String>,
}

// 对外暴露（不含 password_hash）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AccountInfo {
    pub id: String,
    pub name: String,
    pub role: String,
    pub created_at: String,
}

// 登录成功返回的 session
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionInfo {
    pub account_id: String,
    pub name: String,
    pub role: String,
    pub token: String,              // UUID v4，仅存内存
}

// AppState 扩展
pub struct AccountSession {
    pub id: String,
    pub name: String,
    pub role: String,               // "member" | "manager"
}
// AppState.current_account: Mutex<Option<AccountSession>>  ← 新增

// 团队统计结构
#[derive(Debug, Serialize, Deserialize)]
pub struct TeamStats {
    pub total_tasks_done: u32,
    pub active_members: u32,
    pub total_notes: u32,
    pub member_stats: Vec<MemberStat>,
    pub group_stats: Vec<GroupStat>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MemberStat {
    pub account_id: String,
    pub name: String,
    pub tasks_done_this_week: u32,
    pub notes_this_week: u32,
    pub is_deleted: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GroupStat {
    pub group_name: String,         // 分类/标签名；无分类 → "未分组"
    pub members: Vec<String>,       // 参与账号名字列表
    pub tasks_done_this_week: u32,
    pub total_tasks: u32,
    pub progress_ratio: f32,
}
```

---

## 五、store.rs 变更策略

**原则**: 全局配置函数保持签名不变（使用 `mira_v2.json`）；账号私有数据函数增加 `account_id` 参数。

```rust
// 账号私有 store 路径
fn account_store_path(account_id: &str) -> String {
    format!("mira_acct_{account_id}.json")
}

// 修改后的函数签名示例
pub fn get_notes(app: &AppHandle, account_id: &str) -> Vec<Note>
pub fn save_notes(app: &AppHandle, account_id: &str, notes: &[Note])
pub fn get_wiki_schema(app: &AppHandle, account_id: &str) -> WikiSchema
// ... 其余私有数据同理

// 全局配置函数（不变）
pub fn get_stored_api_key(app: &AppHandle) -> String      // 仍用 mira_v2.json
pub fn save_api_key(app: &AppHandle, key: &str)
pub fn get_llm_config(app: &AppHandle) -> StoredLlmConfig
pub fn save_llm_config(app: &AppHandle, config: &StoredLlmConfig)
```

所有现有 command 需在内部从 `AppState.current_account` 取 `account_id` 传入 store 函数。

---

## 六、新增 Tauri Commands 契约

```rust
// 账号管理（仅 manager 可写，任意人可查列表）
list_accounts()  → Result<Vec<AccountInfo>, String>
create_account(name: String, password: String, role: String) → Result<AccountInfo, String>
delete_account(account_id: String) → Result<(), String>
update_account_role(account_id: String, role: String) → Result<(), String>

// 登录
login_account(account_id: String, password: String) → Result<SessionInfo, String>

// 团队功能（仅 manager）
get_team_stats() → Result<TeamStats, String>
ask_team_mira(question: String) → Result<ChatMessage, String>
```

**安全约束**:
- `create_account` / `delete_account` / `update_account_role`: 检查 `AppState.current_account.role == "manager"`，否则返回 `Err("unauthorized")`
- `get_team_stats` / `ask_team_mira`: 同上
- `delete_account`: 不允许删除当前登录账号（`account_id != current_session.id`）
- `update_account_role`: 若当前设备只剩一个 manager 且操作目标是该 manager，拒绝并返回 `Err("last_manager")`

---

## 七、团队统计计算逻辑

**本周定义**: 本自然周周一 00:00:00 本地时间 → 当前时刻

```
get_team_stats():
  week_start = 本周一 00:00:00

  FOR each account in accounts.json:
    store = mira_acct_{account.id}.json
    notes_this_week = COUNT store.notes WHERE created_at >= week_start
    total_notes += notes_this_week

    tasks_file = workspace/people/{account.id}/tasks.md
    (tasks_done, group_map) = parse_tasks_md(tasks_file, week_start)
    total_tasks_done += tasks_done

    IF notes_this_week > 0 OR tasks_done > 0:
      active_members += 1

    member_stats.push(MemberStat { ..., is_deleted = false })

  // 注：已删除账号的处理：账号从 accounts.json 删除时，历史文件保留一份
  // snapshot 供团队统计（具体实现见 delete_account 设计）

  SORT member_stats by tasks_done_this_week DESC, name ASC
  RETURN TeamStats { total_tasks_done, active_members, total_notes, member_stats, group_stats }
```

**tasks.md 解析规则**:
- `- [x]` 开头的行 = 完成的任务
- `  - Completed: {ISO8601}` = 完成时间
- `  - Id: task_xxx` = 任务 ID（可选，用于分组去重）
- 任务"标签/分类"从任务标题或 Details 字段提取（当前 tasks.md 无标签字段，归入「未分组」）

---

## 八、迁移脚本逻辑

```
fn migrate_if_needed(app: &AppHandle):
  IF accounts.json exists → skip（已迁移）

  existing_person = first dir in workspace/people/ OR new UUID
  default_account = Account {
    id: existing_person,
    name: "默认账号",
    password_hash: "",          // 空密码，首次登录免密
    role: "manager",
    created_at: now,
    fail_count: 0,
    locked_at: None,
  }
  write accounts.json with [default_account]

  // 迁移 Tauri store 数据
  old_store = mira_v2.json
  new_store = mira_acct_{existing_person}.json
  COPY old_store.notes → new_store.notes
  COPY old_store.wiki_schema → new_store.wiki_schema
  COPY old_store.lint_sessions → new_store.lint_sessions
  COPY old_store.chat_history → new_store.chat_history
  COPY old_store.pending_copilot → new_store.pending_copilot
  COPY old_store.unread_lint_count → new_store.unread_lint_count

  DELETE from old_store: notes, wiki_schema, lint_sessions,
                         chat_history, pending_copilot, unread_lint_count,
                         password_hash, lock_state
```
