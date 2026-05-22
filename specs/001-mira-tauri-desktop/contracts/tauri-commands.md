# Tauri Command Contracts

**Feature**: `001-mira-tauri-desktop`
**Date**: 2026-05-22

These are the six Tauri commands exposed to the frontend. All commands are called via
`invoke(commandName, args?)` from `@tauri-apps/api/core`. All return Promises.

Error behavior: on Rust `Err(msg)`, the Promise rejects with the error string. The
frontend MUST wrap all `invoke()` calls in `try/catch`.

---

## `load_state`

**Purpose**: Load the full persisted application state from disk on app startup.

**Input**: none

**Output**:
```typescript
PersistedAppState // { tasks, projects, chatHistory, wikiChatHistory }
```

**Behavior**:
- If `mira-state.json` does not exist → returns `PersistedAppState` with all arrays empty.
- If file exists but is malformed JSON → returns `Err("Failed to parse state: ...")`
- `route` is never included in the returned object (always reset to `'tasks'` by frontend).

**Error conditions**:
- File read permission error → `Err("IO error: ...")`
- JSON parse failure → `Err("Parse error: ...")`

---

## `save_state`

**Purpose**: Persist the current in-memory state to disk after any state change.

**Input**:
```typescript
{ state: PersistedAppState }
```

**Output**: `void` (resolves when write completes)

**Behavior**:
- Creates `app_data_dir()` if it doesn't exist.
- Overwrites `mira-state.json` atomically (write to temp → rename).
- `route`, `chatHistory`, and `wikiChatHistory` are included in the persisted payload
  (chat history is persisted across sessions per spec).

**Error conditions**:
- Disk full → `Err("IO error: no space left on device")`
- Permission denied → `Err("IO error: permission denied")`

---

## `ask_mira`

**Purpose**: Send a user message to the Claude AI with all tasks as context. Returns
the assistant's response.

**Input**:
```typescript
{
  messages: Array<{ role: 'user' | 'assistant', content: string }>, // full conversation
  tasksContext: Task[]  // all current tasks, serialized
}
```

**Output**:
```typescript
{
  content: string,        // the assistant's response text (may contain Markdown)
  sources: SourceCard[]   // task references extracted by the model or by Rust heuristic
}
```

**Behavior**:
- Reads API key from `tauri-plugin-store` internally — never accepts key as parameter.
- Reads model name from store (defaults to `"claude-haiku-4-5"` if unset).
- Constructs system prompt: role description + tasks as structured JSON context.
- Calls Anthropic Messages API, waits for full response (no streaming).
- Parses `content[0].text` from API response.
- Source cards are derived by Rust from the model response or by matching task titles
  mentioned in the response text.

**Error conditions**:
- API key not set → `Err("API key not configured. Please add your API key in Settings.")`
- Network error → `Err("Network error: ...")`
- API error (4xx/5xx) → `Err("AI API error: {status} {body}")`

---

## `ask_wiki`

**Purpose**: Send a user message to Claude with a specific project's tasks as context.

**Input**:
```typescript
{
  messages: Array<{ role: 'user' | 'assistant', content: string }>,
  projectContext: {
    projectName: string,
    tasks: Task[]
  }
}
```

**Output**:
```typescript
{ content: string }   // assistant response text (Markdown OK)
```

**Behavior**:
- Same API call pattern as `ask_mira` but with project-scoped system prompt.
- No source cards (wiki chat does not show citation cards per spec).

**Error conditions**: Same as `ask_mira`.

---

## `polish_report`

**Purpose**: Send a generated Markdown report to Claude for professional rewriting.

**Input**:
```typescript
{
  reportMarkdown: string, // the locally-generated report text
  tasksContext: Task[]    // tasks used to generate the report (for context)
}
```

**Output**:
```typescript
{ polishedMarkdown: string }  // the rewritten report
```

**Behavior**:
- System prompt instructs the model to improve clarity, professionalism, and readability
  while strictly preserving all factual content and Markdown heading structure.
- Returns the full polished Markdown string.

**Error conditions**: Same as `ask_mira`.

---

## `get_api_key_set`

**Purpose**: Check whether an API key has been saved, without exposing the key itself.

**Input**: none

**Output**:
```typescript
boolean  // true if a non-empty API key is stored; false otherwise
```

**Behavior**:
- Reads from `tauri-plugin-store` and returns `true` if `api_key` is a non-empty string.
- Used by the frontend to show/hide the "API key not configured" warning and to determine
  whether to show the API key masked placeholder in Settings.

**Error conditions**: Store read failure → returns `false` (fail-safe).

---

## `set_api_key`

**Purpose**: Store the user's AI API key and selected model securely on the Rust side.

**Input**:
```typescript
{ key: string, model: string }
```

**Output**: `void`

**Behavior**:
- Saves `key` under `"api_key"` and `model` under `"model"` in `tauri-plugin-store`.
- The key is never logged or returned to the frontend after this call.

**Error conditions**:
- Empty string key → `Err("API key cannot be empty")`
- Store write failure → `Err("Failed to save API key: ...")`

---

## `get_model`

**Purpose**: Retrieve the currently saved AI model name so the Settings page can display it.

**Input**: none

**Output**:
```typescript
string  // e.g. "claude-haiku-4-5"
```

**Behavior**:
- Reads `"model"` from `tauri-plugin-store`.
- Returns `"claude-haiku-4-5"` as the default if no model has been saved yet.
- This allows `SettingsPage` to pre-populate the model selector after a restart without
  exposing the API key.

**Error conditions**: Store read failure → returns default `"claude-haiku-4-5"` (fail-safe).

---

## Frontend Typed Wrapper (`src/hooks/useTauri.ts`)

```typescript
import { invoke } from '@tauri-apps/api/core';
import type { PersistedAppState, Task, ChatMsg } from '../types';

export const tauriCommands = {
  loadState: () =>
    invoke<PersistedAppState>('load_state'),

  saveState: (state: Omit<PersistedAppState, never>) =>
    invoke<void>('save_state', { state }),

  askMira: (messages: ChatMsg[], tasksContext: Task[]) =>
    invoke<{ content: string; sources: Array<{ type: string; text: string; status: string }> }>(
      'ask_mira', { messages, tasksContext }
    ),

  askWiki: (messages: ChatMsg[], projectContext: { projectName: string; tasks: Task[] }) =>
    invoke<{ content: string }>('ask_wiki', { messages, projectContext }),

  polishReport: (reportMarkdown: string, tasksContext: Task[]) =>
    invoke<{ polishedMarkdown: string }>('polish_report', { reportMarkdown, tasksContext }),

  getApiKeySet: () =>
    invoke<boolean>('get_api_key_set'),

  setApiKey: (key: string, model: string) =>
    invoke<void>('set_api_key', { key, model }),

  getModel: () =>
    invoke<string>('get_model'),
};
```
