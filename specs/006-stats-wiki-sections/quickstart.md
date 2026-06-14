# Quickstart: Mira v2 Dev Setup

## Prerequisites

- macOS (required; Tauri targets macOS only per Principle I)
- Rust stable toolchain (`rustup update stable`)
- Node.js 24 LTS (`node --version` should show v24.x)
- npm (comes with Node.js)

## First-time Setup

```bash
# Install npm dependencies (root + web app)
npm install
cd apps/web && npm install && cd ../..

# Install Rust dependencies (no action needed; Cargo resolves on first build)
```

## Dev: Web-only (fastest feedback loop)

```bash
cd apps/web
npm run dev
# Opens at http://localhost:5173 — uses NestJS API on 8173 (must be running separately)
```

## Dev: Full Desktop (Tauri + NestJS + React)

```bash
# Terminal 1 — start everything via root script
npm run dev:desktop
# This launches: Tauri shell → NestJS sidecar → React Vite dev server
```

## Building

```bash
cd apps/web
npm run tauri build
# Outputs: apps/web/src-tauri/target/release/bundle/dmg/Mira_*.dmg
```

## Running Rust Tests

```bash
cd apps/web/src-tauri
cargo test
```

## Setting the API Key (runtime)

The Claude API key is NOT stored in any config file. Set it via the Settings page in the app,
or (for development) via the Tauri devtools console:

```javascript
window.__TAURI__.invoke('set_api_key', { key: 'sk-ant-...' })
```

## Key Environment Notes

- NestJS API runs at `http://127.0.0.1:8173` — existing Stats/Tasks data lives there
- v2 local data (notes, wiki, lint) lives in `~/Library/Application Support/com.mira.desktop/mira_v2.json`
- Dev data directory is resolved via `find_repo_workspace()` in `main.rs` — in dev mode it
  uses `mira-workspace/` in the monorepo root

## Adding a New Tauri Command

1. Add the handler function in the appropriate `src/commands/*.rs` file
2. Add `#[tauri::command]` attribute
3. Register in `src/commands/mod.rs` `register_commands!()` macro list
4. Add the TypeScript signature to `apps/web/src/app/useTauriApi.ts`
5. Add Chinese error messages to `apps/web/src/app/i18n.ts` if the command can error
