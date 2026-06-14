# Data Model: Mira v2

**Date**: 2026-05-25  
**Feature**: All specs 001–006 (v2 full redesign)

---

## Rust Types

All types live under `apps/web/src-tauri/src/models/`.
All types derive `Debug, Clone, Serialize, Deserialize` unless noted.
All timestamps are ISO 8601 strings (`String`) to avoid chrono version churn in JSON serialization.

### `models/note.rs`

```rust
pub struct Note {
    pub id: String,        // UUID v4
    pub content: String,   // Markdown text (no title field; first line is display title)
    pub created_at: String,
    pub updated_at: String,
}
```

### `models/wiki.rs`

```rust
pub struct WikiProject {
    pub id: String,
    pub name: String,
    pub status: String,    // AI-returned Chinese: 进行中 | 已完成 | 暂停
    pub task_count: u32,
}

pub struct WikiEntity {
    pub id: String,
    pub name: String,
    pub entity_type: String,   // "person" | "tool" | "concept"
}

pub struct WikiDecision {
    pub id: String,
    pub content: String,
    pub project_id: Option<String>,
    pub recorded_at: String,
}

pub struct WikiSchema {
    pub projects: Vec<WikiProject>,
    pub entities: Vec<WikiEntity>,
    pub decisions: Vec<WikiDecision>,
}
```

### `models/lint.rs`

```rust
pub struct LintQuestion {
    pub id: String,
    pub question: String,
    pub context: String,     // Snippet of source content for disambiguation
    pub answered: bool,
    pub answer: Option<String>,
}

#[serde(rename_all = "snake_case")]
pub enum LintSessionStatus {
    Open,     // Has unanswered questions
    Done,     // All questions answered or dismissed
    Expired,  // Superseded by newer session
}

pub struct LintSession {
    pub id: String,
    pub created_at: String,
    pub items_analyzed: u32,
    pub time_span_days: u32,
    pub issues_found: u32,
    pub updated_projects: Vec<String>,  // Project names (display)
    pub questions: Vec<LintQuestion>,
    pub status: LintSessionStatus,
}
```

### `models/chat.rs`

```rust
#[serde(rename_all = "snake_case")]
pub enum MessageRole {
    User,
    Assistant,
}

pub struct ChatMessage {
    pub id: String,
    pub role: MessageRole,
    pub content: String,
    pub created_at: String,
}
```

### `models/copilot.rs`

```rust
pub struct CopilotQuestion {
    pub id: String,
    pub question: String,
    pub context: String,
    pub source_id: String,
    pub source_type: String,   // "note" (future: "task")
    pub dismissed: bool,
}
```

### `AppState` (in `main.rs`)

```rust
pub struct LintState {
    pub item_count_since_last: u32,  // Incremented by process_note/process_task
    pub last_lint_at: Option<String>,
}

pub struct AppState {
    pub api_key: Mutex<Option<String>>,
    pub lint_state: Mutex<LintState>,
}
```

### `PersistedData` (stored in tauri-plugin-store, key: `"mira_v2"`)

```rust
#[derive(Default)]
pub struct PersistedData {
    pub notes: Vec<Note>,
    pub wiki_schema: WikiSchema,
    pub lint_sessions: Vec<LintSession>,   // All sessions, newest first
    pub chat_history: Vec<ChatMessage>,    // Max 100, ring buffer
    pub pending_copilot: Vec<CopilotQuestion>,
    pub unread_lint_count: u32,            // Badge counter for Mira Ask nav item
}
```

---

## TypeScript Types

These types are consumed by the frontend via Tauri invoke responses.
Add to `apps/web/src/app/types.ts`.

```typescript
// Note (local, v2 — distinct from legacy NestJS MeetingNote)
export type Note = {
  id: string;
  content: string;   // Markdown
  createdAt: string; // ISO 8601
  updatedAt: string;
};

// Wiki
export type WikiProject = {
  id: string;
  name: string;
  status: string;    // Chinese: 进行中 | 已完成 | 暂停
  taskCount: number;
};

export type WikiEntity = {
  id: string;
  name: string;
  entityType: string; // person | tool | concept
};

export type WikiDecision = {
  id: string;
  content: string;
  projectId: string | null;
  recordedAt: string;
};

export type WikiSchema = {
  projects: WikiProject[];
  entities: WikiEntity[];
  decisions: WikiDecision[];
};

// Lint
export type LintQuestion = {
  id: string;
  question: string;
  context: string;
  answered: boolean;
  answer: string | null;
};

export type LintSessionStatus = 'open' | 'done' | 'expired';

export type LintSession = {
  id: string;
  createdAt: string;
  itemsAnalyzed: number;
  timeSpanDays: number;
  issuesFound: number;
  updatedProjects: string[];
  questions: LintQuestion[];
  status: LintSessionStatus;
};

// Chat
export type MessageRole = 'user' | 'assistant';

export type ChatMessage = {
  id: string;
  role: MessageRole;
  content: string;
  createdAt: string;
};

// Copilot
export type CopilotQuestion = {
  id: string;
  question: string;
  context: string;
  sourceId: string;
  sourceType: 'note' | 'task';
  dismissed: boolean;
};
```

---

## Tauri Commands (invoke signatures)

```typescript
// Notes
invoke('get_notes') → Note[]
invoke('create_note', { content: string }) → Note
invoke('update_note', { id: string, content: string }) → Note
invoke('delete_note', { id: string }) → void

// Wiki
invoke('process_note', { id: string }) → CopilotQuestion | null
invoke('get_wiki_schema') → WikiSchema
invoke('get_lint_sessions') → LintSession[]
invoke('answer_lint_question', { session_id: string, question_id: string, answer: string }) → void
invoke('dismiss_lint_question', { session_id: string, question_id: string }) → void
invoke('trigger_lint') → LintSession

// Ask Mira
invoke('ask_mira', { question: string, time_range?: { days: number } }) → ChatMessage
invoke('get_chat_history') → ChatMessage[]
invoke('clear_chat_history') → void

// Copilot
invoke('dismiss_copilot', { id: string }) → void
invoke('get_pending_copilot') → CopilotQuestion[]

// Badge
invoke('mark_lint_read') → void  // Resets unread_lint_count to 0
invoke('get_unread_lint_count') → number
```

---

## New Cargo Dependencies

Add to `apps/web/src-tauri/Cargo.toml`:

```toml
[dependencies]
tauri = { version = "2", features = [] }
tauri-plugin-shell = "2"
tauri-plugin-store = "2"         # NEW: local persistence
serde = { version = "1", features = ["derive"] }  # NEW
serde_json = "1"                 # NEW
tokio = { version = "1", features = ["full"] }     # NEW: async runtime + timers
reqwest = { version = "0.12", features = ["json", "rustls-tls"], default-features = false }  # NEW: Claude API client
uuid = { version = "1", features = ["v4"] }        # NEW: ID generation
chrono = { version = "0.4", features = ["serde"] } # NEW: timestamp generation
```

## New npm Dependency

Add to `apps/web/package.json`:

```json
"antd": "^5.20.0"
```
