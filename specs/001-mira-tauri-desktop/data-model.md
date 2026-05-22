# Data Model: Mira·见微 — macOS Desktop App

**Feature**: `001-mira-tauri-desktop`
**Date**: 2026-05-22

All TypeScript interfaces and Rust structs must be kept in sync. The JSON serialization
format is the contract between frontend and backend — field names and types MUST match.

---

## TypeScript Interfaces (`src/types/index.ts`)

```typescript
// ── Core domain types ────────────────────────────────────────────────────────

export type Priority = 'low' | 'normal' | 'high' | 'urgent';
export type MessageRole = 'user' | 'assistant';

export interface SourceCard {
  type: string;    // "任务"
  text: string;    // task title
  status: string;  // "已完成" | "进行中"
}

export interface ChatMsg {
  role: MessageRole;
  content: string;
  time: number;           // Unix timestamp (ms)
  sources?: SourceCard[]; // only present on assistant messages in AskMira
}

export interface Task {
  id: string;              // 8-char alphanumeric random string
  weekKey: string;         // ISO week format "GGGG-[W]WW" (dayjs isoWeek)
  projectId: string;       // references Project.id
  title: string;
  detail?: string;
  priority: Priority;
  dueDate: string;         // "YYYY-MM-DD"
  done: boolean;
  tags: string[];          // from TAG_DIMENSIONS.type values
  createdAt: number;       // Unix timestamp (ms)
  finishedAt: number | null;
}

export interface Project {
  id: string;              // "p1" … "p5"
  name: string;
  color: string;           // hex color
  icon: string;            // emoji
}

export interface TeamMember {
  id: string;              // "m1" … "m6"
  name: string;
  role: string;
  avatar: string;          // emoji
  color: string;           // hex color
}

// ── Persisted application state (serialized to/from Rust) ────────────────────

export interface PersistedAppState {
  tasks: Task[];
  projects: Project[];
  chatHistory: ChatMsg[];
  wikiChatHistory: ChatMsg[];
  // route is NOT persisted — always resets to 'tasks' on load
}

// ── In-memory runtime state (superset of PersistedAppState) ──────────────────

export interface AppState extends PersistedAppState {
  route: string;
}

// ── Settings (stored separately in tauri-plugin-store) ───────────────────────

export interface AppSettings {
  model: string;           // e.g. "claude-haiku-4-5"
  apiKeySet: boolean;      // true if api_key is stored in Rust store (read-only in frontend)
}

// ── Computed types (not persisted) ───────────────────────────────────────────

export interface MemberWithAbilities extends TeamMember {
  assignedTasks: Task[];
  totalTasks: number;
  doneTasks: number;
  topTypes: AbilityTag[];      // top 5 tag types by frequency
  topProj: AbilityTag[];       // top 3 project names by frequency
  topKw: AbilityTag[];         // top 5 KEYWORD_DICT matches by frequency (weight >= 2)
  allTags: AbilityTag[];       // merged for display
}

export interface AbilityTag {
  label: string;
  weight: number;
  category: 'type' | 'project' | 'keyword';
}
```

---

## Rust Structs (`src-tauri/src/models/state.rs`)

```rust
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceCard {
    pub r#type: String,
    pub text: String,
    pub status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatMsg {
    pub role: String,
    pub content: String,
    pub time: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sources: Option<Vec<SourceCard>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Task {
    pub id: String,
    pub week_key: String,
    pub project_id: String,
    pub title: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub detail: Option<String>,
    pub priority: String,
    pub due_date: String,
    pub done: bool,
    pub tags: Vec<String>,
    pub created_at: i64,
    pub finished_at: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Project {
    pub id: String,
    pub name: String,
    pub color: String,
    pub icon: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct PersistedAppState {
    pub tasks: Vec<Task>,
    pub projects: Vec<Project>,
    pub chat_history: Vec<ChatMsg>,
    pub wiki_chat_history: Vec<ChatMsg>,
}

// Used only for AI command input/output, not for persistence
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ClaudeMessage {
    pub role: String,
    pub content: String,
}
```

**Serde note**: `#[serde(rename_all = "camelCase")]` ensures Rust's `snake_case` fields
serialize to TypeScript's `camelCase` names (e.g., `project_id` ↔ `projectId`,
`chat_history` ↔ `chatHistory`).

---

## Constants (`src/constants/index.ts`)

```typescript
export const PROJECTS: Project[] = [
  { id: 'p1', name: '某国有大行数字化转型咨询', color: '#1B2A4E', icon: '🏦' },
  { id: 'p2', name: '某股份制银行智能风控项目', color: '#E8B86D', icon: '🛡️' },
  { id: 'p3', name: '某城商行运营效能提升',     color: '#52C41A', icon: '📈' },
  { id: 'p4', name: '某农商行客户旅程优化',     color: '#722ED1', icon: '🗺️' },
  { id: 'p5', name: '某外资银行合规咨询',       color: '#FA541C', icon: '📋' },
];

export const TEAM_MEMBERS: TeamMember[] = [
  { id: 'm1', name: '陈思远', role: '高级顾问', avatar: '🧑‍💼', color: '#1B2A4E' },
  { id: 'm2', name: '林晓彤', role: '咨询顾问', avatar: '👩‍💼', color: '#E8B86D' },
  { id: 'm3', name: '王嘉琪', role: '咨询顾问', avatar: '👨‍💻', color: '#52C41A' },
  { id: 'm4', name: '赵明轩', role: '初级顾问', avatar: '🧑‍🎓', color: '#722ED1' },
  { id: 'm5', name: '孙艺涵', role: '高级顾问', avatar: '👩‍🔬', color: '#FA541C' },
  { id: 'm6', name: '周文博', role: '项目经理', avatar: '🧑‍🔧', color: '#13C2C2' },
];

export const KEYWORD_DICT: string[] = [
  '需求调研', '方案设计', '客户汇报', '投标', '标书编写', '项目立项',
  '里程碑评审', '交付物编写', '数据分析', '流程梳理', '组织诊断',
  '运营指标设计', 'KPI体系搭建', '竞品分析', '合规审查', '风险识别',
  '培训赋能', '知识转移', '变更管理', '干系人沟通', '项目复盘',
  '质量检查', '资源协调', '商务谈判', '合同签署', 'SOP制定',
  '系统对接', 'UAT测试', '上线支持',
];

export const PRIORITIES = [
  { value: 'low',    label: '低',  color: 'default' },
  { value: 'normal', label: '普通', color: 'blue'    },
  { value: 'high',   label: '高',  color: 'orange'  },
  { value: 'urgent', label: '紧急', color: 'red'     },
] as const;

export const TAG_TYPE_OPTIONS = [
  '需求分析', '方案交付', '客户沟通', '项目管理', '投标商务',
  '数据分析', '运营优化', '合规风控', '培训赋能', '系统实施',
];
```

---

## State Transitions

### Task Lifecycle

```
NEW (form submitted)
  │ addTask action → generate id, createdAt, weekKey
  ▼
PENDING (done: false)
  │ updateTask { done: true } → set finishedAt = Date.now()
  ▼
DONE (done: true, finishedAt set)
  │ removeTask
  ▼
DELETED (removed from state)
```

### Chat Message Lifecycle

```
User submits input
  │ addChatMessage { role: 'user' }
  ▼
Loading state (optimistic UI — append placeholder)
  │ invoke('ask_mira' | 'ask_wiki' | 'polish_report')
  ▼
Response arrives
  │ addChatMessage { role: 'assistant', sources? }
  ▼
Displayed in chat
  │ clearChat / clearWikiChat
  ▼
CLEARED
```

### App Boot Sequence

```
main.tsx mounts
  │
  ▼
BootLoader renders (deep-blue splash)
  │ invoke('load_state')
  ▼
PersistedAppState received
  │ tasks.length === 0?
  ├── YES → buildSeed() → invoke('save_state', seed)
  └── NO  → use as-is
  │
  ▼
StoreProvider initializes with state (route = 'tasks')
  │
  ▼
BootLoader unmounts → MainLayout renders
```

---

## Validation Rules

| Field | Rule |
|-------|------|
| `Task.title` | Non-empty string; MUST validate before save |
| `Task.id` | 8-char alphanumeric; generated client-side via `Math.random().toString(36).slice(2, 10)` |
| `Task.weekKey` | Derived from `createdAt` via `dayjs(createdAt).format('GGGG-[W]WW')` |
| `Task.dueDate` | Format `YYYY-MM-DD`; default = tomorrow on new task creation |
| `Task.priority` | One of `'low' \| 'normal' \| 'high' \| 'urgent'`; default = `'normal'` |
| `ChatMsg.time` | `Date.now()` at message creation |
| `AppSettings.model` | Non-empty string; not validated against live model list |
