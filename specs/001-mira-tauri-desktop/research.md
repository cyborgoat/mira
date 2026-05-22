# Research: Mira·见微 — macOS Desktop App

**Feature**: `001-mira-tauri-desktop`
**Date**: 2026-05-22
**Status**: Complete — no NEEDS CLARIFICATION items remain

---

## 1. Tauri 2.x Project Scaffolding with Vite + React + TypeScript

**Decision**: Use `npm create tauri-app@latest` with the `react-ts` Vite template as the
starting point, then manually add Ant Design, dayjs, and marked.

**Rationale**: The official Tauri CLI handles all the wiring between `src/` (Vite frontend)
and `src-tauri/` (Rust backend), including the `tauri.conf.json` and `Cargo.toml` baseline.
Starting from the template avoids misconfiguration of the `beforeDevCommand`,
`beforeBuildCommand`, and `devUrl` settings in `tauri.conf.json`.

**Key `tauri.conf.json` settings**:
```json
{
  "app": {
    "windows": [{
      "title": "Mira",
      "width": 1200,
      "height": 800,
      "minWidth": 960,
      "minHeight": 640,
      "resizable": true,
      "fullscreen": false
    }]
  },
  "bundle": {
    "identifier": "com.mira.app",
    "targets": ["dmg"],
    "macOS": { "minimumSystemVersion": "11.0" }
  }
}
```

**Universal binary**: Set via environment variable before `tauri build`:
```bash
export MACOSX_DEPLOYMENT_TARGET=11.0
tauri build --target universal-apple-darwin
```
Tauri 2.x supports `universal-apple-darwin` natively via the `lipo` tool bundled in Xcode.

**Alternatives considered**:
- Electron: Rejected — constitution mandates Tauri 2.x; Electron adds ~150MB to binary.
- Manual Vite + Tauri wiring: Rejected — error-prone; CLI template is maintained by Tauri team.

---

## 2. Tauri Command Pattern (invoke API)

**Decision**: Use `#[tauri::command]` attribute on async Rust functions, registered in
`tauri::Builder::invoke_handler`. Frontend calls via `@tauri-apps/api`'s `invoke()`.

**Rust command signature pattern**:
```rust
#[tauri::command]
async fn load_state(app: tauri::AppHandle) -> Result<AppState, String> {
    // read JSON from app_data_dir / mira-state.json
    // return deserialized AppState or error string
}
```

**Frontend call pattern**:
```typescript
import { invoke } from '@tauri-apps/api/core';

async function loadState(): Promise<AppState> {
  return invoke<AppState>('load_state');
}
```

**Error handling**: Rust returns `Result<T, String>` where the `Err` string is forwarded
to the frontend as a rejected Promise. Frontend wraps all `invoke()` calls in try/catch
and shows user-friendly error messages.

**Rationale**: `Result<T, String>` is the simplest serde-compatible error type. Using
`anyhow::Error` requires a custom `From` impl; `String` is sufficient for this app's needs.

---

## 3. Data Persistence via serde_json + app_data_dir

**Decision**: Persist the full `AppState` as a single JSON file
`{app_data_dir}/mira-state.json`. Read on `load_state`, overwrite on `save_state`.

**File location** (macOS): `~/Library/Application Support/com.mira.app/mira-state.json`

**Rust implementation sketch**:
```rust
use tauri::Manager;
use std::fs;

fn state_file_path(app: &tauri::AppHandle) -> PathBuf {
    app.path().app_data_dir().unwrap().join("mira-state.json")
}

#[tauri::command]
async fn load_state(app: tauri::AppHandle) -> Result<AppState, String> {
    let path = state_file_path(&app);
    if !path.exists() {
        return Ok(AppState::default()); // triggers seed generation on frontend
    }
    let json = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    serde_json::from_str(&json).map_err(|e| e.to_string())
}

#[tauri::command]
async fn save_state(app: tauri::AppHandle, state: AppState) -> Result<(), String> {
    let path = state_file_path(&app);
    fs::create_dir_all(path.parent().unwrap()).map_err(|e| e.to_string())?;
    let json = serde_json::to_string_pretty(&state).map_err(|e| e.to_string())?;
    fs::write(&path, json).map_err(|e| e.to_string())
}
```

**Frontend behavior on empty state**: If `load_state` returns the default `AppState`
(empty tasks array), the frontend `StoreProvider` detects `tasks.length === 0` and calls
`buildSeed()` to populate initial data, then calls `save_state` immediately.

**Alternatives considered**:
- SQLite via `rusqlite`: Overkill for a single-user app with ~1000 tasks max. JSON is
  simpler, human-readable, and trivial to backup/inspect.
- `tauri-plugin-sql`: Same concern — adds a Cargo dependency for no meaningful gain.

---

## 4. API Key Storage via tauri-plugin-store

**Decision**: Use `tauri-plugin-store` to store the API key as an encrypted key-value entry.
The store file lives in `app_data_dir` managed by Tauri.

**Why tauri-plugin-store over macOS Keychain**: `tauri-plugin-store` is cross-platform,
officially maintained by the Tauri team, and sufficient for this threat model (the app is
single-user, local, not shared). macOS Keychain would require `security-framework` crate and
adds complexity; it can be added in a future version if needed.

**Plugin setup** (`main.rs`):
```rust
tauri::Builder::default()
    .plugin(tauri_plugin_store::Builder::default().build())
    .invoke_handler(tauri::generate_handler![...])
```

**Rust command pattern**:
```rust
use tauri_plugin_store::StoreExt;

#[tauri::command]
async fn set_api_key(app: tauri::AppHandle, key: String) -> Result<(), String> {
    let store = app.store("settings.json").map_err(|e| e.to_string())?;
    store.set("api_key", serde_json::Value::String(key));
    store.save().map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_api_key_set(app: tauri::AppHandle) -> Result<bool, String> {
    let store = app.store("settings.json").map_err(|e| e.to_string())?;
    Ok(store.get("api_key")
        .and_then(|v| v.as_str().map(|s| !s.is_empty()))
        .unwrap_or(false))
}
```

**Key insight**: `get_api_key_set` returns a boolean only — the raw key is never sent to
the frontend. The AI command handlers read the key directly from the store internally.

---

## 5. Claude API Calls via reqwest (Rust)

**Decision**: Use `reqwest` with the `rustls-tls` feature (avoids OpenSSL dependency) to
call the Anthropic Messages API directly.

**API endpoint**: `https://api.anthropic.com/v1/messages`
**Default model**: `claude-haiku-4-5` (configurable via settings store)

**Rust helper sketch**:
```rust
use reqwest::Client;

async fn call_claude(
    api_key: &str,
    model: &str,
    system: &str,
    messages: Vec<ClaudeMessage>,
) -> Result<String, String> {
    let client = Client::new();
    let body = serde_json::json!({
        "model": model,
        "max_tokens": 4096,
        "system": system,
        "messages": messages
    });
    let resp = client
        .post("https://api.anthropic.com/v1/messages")
        .header("x-api-key", api_key)
        .header("anthropic-version", "2023-06-01")
        .header("content-type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| e.to_string())?;
    let json: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    json["content"][0]["text"]
        .as_str()
        .map(|s| s.to_string())
        .ok_or_else(|| format!("Unexpected response: {}", json))
}
```

**System prompt strategy**:
- `ask_mira`: Inject all tasks as JSON in the system prompt; ask model to answer the user
  question and return relevant task references in a structured format.
- `ask_wiki`: Inject project-specific tasks; answer project-level questions.
- `polish_report`: Provide the Markdown report; ask model to rewrite it in a polished
  professional consulting style while preserving structure and factual content.

**No streaming**: The `reqwest` call blocks until the full response arrives. The frontend
shows a loading indicator during this time. `max_tokens: 4096` is sufficient for all three
use cases.

**Alternatives considered**:
- Anthropic Rust SDK: No official SDK exists yet; direct `reqwest` is the standard approach.
- `ureq` (blocking HTTP): Works but `reqwest` integrates better with `tokio` async runtime
  that Tauri already uses.

---

## 6. React Context State Management Pattern

**Decision**: Single `StoreProvider` wrapping the entire app, exposing `state` and
`dispatch` (or named action functions) via `AppContext`. State is the single source of
truth in-memory; Rust holds the on-disk source of truth.

**Hydration flow**:
1. App mounts → `StoreProvider` calls `invoke('load_state')`.
2. If result has `tasks.length === 0` → call `buildSeed()` → call `invoke('save_state', seed)`.
3. Set state → hide boot loader → show main interface.

**Save-on-change flow**:
```typescript
useEffect(() => {
  if (initialized) {
    invoke('save_state', { state: storeState });
  }
}, [storeState]);
```
Fire-and-forget for non-critical writes (task updates); the `save_state` command is
idempotent and atomic (full overwrite).

**State shape** (exactly mirrors `demo_spec.md` Section 2.1, adapted for Tauri):
```typescript
interface AppState {
  tasks: Task[];
  projects: Project[];  // loaded from constants; persisted for future extensibility
  route: string;        // NOT persisted — always starts at 'tasks'
  chatHistory: ChatMsg[];
  wikiChatHistory: ChatMsg[];
}
```
`route` is reset to `'tasks'` on every app start (not persisted to JSON).

---

## 7. Boot Loading / Splash Screen

**Decision**: Implement as a React component (`BootLoader`) that covers the full window
with the deep-blue gradient while `load_state` is in-flight. Once hydration completes,
`BootLoader` unmounts and `MainLayout` is shown.

**No separate Tauri splash window**: Tauri 2.x's `tauri-plugin-splashscreen` adds complexity.
A React-rendered splash inside the main window achieves the same visual effect with zero
additional setup. The `BootLoader` renders the exact CSS spec from `demo_spec.md` Section 8.

---

## 8. Universal macOS Binary

**Decision**: Build with `--target universal-apple-darwin` using the Tauri CLI.

**Prerequisites**:
```bash
rustup target add x86_64-apple-darwin aarch64-apple-darwin
```
**Build command**:
```bash
npm run tauri build -- --target universal-apple-darwin
```
Output: `src-tauri/target/universal-apple-darwin/release/bundle/dmg/Mira_*.dmg`

**Code signing**: If distributing outside the Mac App Store, ad-hoc signing is sufficient
for development. Production distribution requires an Apple Developer ID certificate. This
is out of scope for Phase 1.
