# Tauri Command Contracts: Mira v2

These are the Tauri invoke command schemas exposed by the Rust backend to the frontend.
All commands use `tauri::command` and are registered via `invoke_handler`.

---

## Notes Commands

### `get_notes`
Returns all notes, sorted by `updated_at` descending.

**Args**: none  
**Returns**: `Note[]`

```typescript
type Note = {
  id: string;
  content: string;   // Markdown text
  createdAt: string; // ISO 8601
  updatedAt: string;
};
```

**Errors**: Store read failure → `"暂时无法加载数据，请稍后重试"`

---

### `create_note`
Creates a new note with a generated UUID and current timestamp.

**Args**:
```typescript
{ content: string }  // Markdown text, may be empty string
```

**Returns**: `Note` (the newly created note)

---

### `update_note`
Updates note content and sets `updatedAt` to now. Also resets any dismissed copilot question for this note (new content triggers fresh processing opportunity).

**Args**:
```typescript
{ id: string; content: string }
```

**Returns**: `Note` (updated)  
**Errors**: `"note_not_found"` if id does not exist

---

### `delete_note`
Deletes a note and any associated pending copilot question for it.

**Args**:
```typescript
{ id: string }
```

**Returns**: `void`  
**Errors**: `"note_not_found"` if id does not exist

---

### `process_note`
Sends note content to Claude API. Extracts wiki entities (projects, entities, decisions), updates WikiSchema in store, generates a CopilotQuestion if ambiguity found. Increments `lint_state.item_count_since_last`.

**Args**:
```typescript
{ id: string }
```

**Returns**: `CopilotQuestion | null`  
(null = no ambiguity found; question = Copilot card should be shown)

**Side effects**: WikiSchema updated in store; lint counter incremented  
**Throttle**: 3 seconds minimum between calls for the same note id  
**Errors**: API key missing → `"api_key_not_set"`; network error → `"ai_request_failed"`

---

## Wiki Commands

### `get_wiki_schema`
Returns the current accumulated WikiSchema.

**Args**: none  
**Returns**:
```typescript
type WikiSchema = {
  projects: WikiProject[];
  entities: WikiEntity[];
  decisions: WikiDecision[];
};

type WikiProject = { id: string; name: string; status: string; taskCount: number };
type WikiEntity  = { id: string; name: string; entityType: string };
type WikiDecision = { id: string; content: string; projectId: string | null; recordedAt: string };
```

**Empty state**: Returns `{ projects: [], entities: [], decisions: [] }` (never errors on empty)

---

### `get_lint_sessions`
Returns all lint sessions, newest first.

**Args**: none  
**Returns**: `LintSession[]`

```typescript
type LintSession = {
  id: string;
  createdAt: string;
  itemsAnalyzed: number;
  timeSpanDays: number;
  issuesFound: number;
  updatedProjects: string[];
  questions: LintQuestion[];
  status: 'open' | 'done' | 'expired';
};

type LintQuestion = {
  id: string;
  question: string;
  context: string;
  answered: boolean;
  answer: string | null;
};
```

---

### `answer_lint_question`
Records the user's answer to a lint question. If all questions in the session are answered, sets session status to `done`.

**Args**:
```typescript
{ sessionId: string; questionId: string; answer: string }
```

**Returns**: `void`  
**Errors**: `"session_not_found"`, `"question_not_found"`

---

### `dismiss_lint_question`
Marks a question as skipped (answered=true, answer=null). Same completion logic as `answer_lint_question`.

**Args**:
```typescript
{ sessionId: string; questionId: string }
```

**Returns**: `void`

---

### `trigger_lint`
Manually triggers a lint cycle immediately. Creates a new LintSession by analyzing recent notes against the WikiSchema. Marks previous open sessions as `expired`.

**Args**: none  
**Returns**: `LintSession` (the newly created session)  
**Errors**: `"api_key_not_set"`; `"ai_request_failed"`; `"no_content_to_lint"` if notes list is empty

---

## Copilot Commands

### `get_pending_copilot`
Returns undismissed copilot questions.

**Args**: none  
**Returns**: `CopilotQuestion[]`

```typescript
type CopilotQuestion = {
  id: string;
  question: string;
  context: string;
  sourceId: string;
  sourceType: 'note' | 'task';
  dismissed: boolean;
};
```

---

### `dismiss_copilot`
Marks a copilot question as dismissed.

**Args**:
```typescript
{ id: string }
```

**Returns**: `void`

---

## Ask Mira Commands

### `ask_mira`
Sends a question to Claude with optional time range context. Appends both user question and assistant reply to `chat_history` (capped at 100 entries total, ring buffer).

**Args**:
```typescript
{ question: string; timeRange?: { days: number } }
```

**Returns**: `ChatMessage` (the assistant reply)

```typescript
type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
};
```

**Errors**: `"api_key_not_set"`; `"ai_request_failed"`

---

### `get_chat_history`
Returns conversation history, oldest first.

**Args**: none  
**Returns**: `ChatMessage[]`

---

### `clear_chat_history`
Clears the entire chat history from the store.

**Args**: none  
**Returns**: `void`

---

## Badge / Read State Commands

### `get_unread_lint_count`
Returns the number of lint sessions created since the user last visited Mira Ask.

**Args**: none  
**Returns**: `number`

---

### `mark_lint_read`
Resets `unread_lint_count` to 0 in the store. Called when user navigates to Mira Ask page.

**Args**: none  
**Returns**: `void`

---

## Settings Commands

### `get_api_key_status`
Returns whether an API key is currently set (boolean only — never returns the key itself, per Principle VI).

**Args**: none  
**Returns**: `{ isSet: boolean }`

---

### `set_api_key`
Stores the API key in Rust AppState memory. Does NOT persist to the store file (stays in process memory only; user must re-enter on each app launch).

**Args**:
```typescript
{ key: string }
```

**Returns**: `void`  
**Validation**: Rejects empty string with error `"api_key_empty"`
