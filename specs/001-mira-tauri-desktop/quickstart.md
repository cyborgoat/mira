# Developer Quickstart: Mira·见微 macOS Desktop App

**Feature**: `001-mira-tauri-desktop`
**Date**: 2026-05-22

---

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Node.js | 20 LTS+ | `brew install node` |
| Rust | stable (≥ 1.77) | `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \| sh` |
| Tauri CLI v2 | latest | `cargo install tauri-cli --version "^2"` |
| Xcode CLI tools | latest | `xcode-select --install` |

### Rust targets (for universal binary)

```bash
rustup target add aarch64-apple-darwin x86_64-apple-darwin
```

---

## Project Setup (from scratch)

> **Note**: If the project has already been scaffolded, skip to "Running in Development."

### 1. Scaffold the Tauri + Vite + React + TypeScript project

```bash
npm create tauri-app@latest mira-app -- --template react-ts
cd mira-app
```

### 2. Install frontend dependencies

```bash
npm install antd @ant-design/icons dayjs marked
npm install @tauri-apps/api
```

### 3. Add Rust dependencies to `src-tauri/Cargo.toml`

```toml
[dependencies]
tauri = { version = "2", features = [] }
tauri-plugin-store = "2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
tokio = { version = "1", features = ["full"] }
reqwest = { version = "0.12", default-features = false, features = ["json", "rustls-tls"] }
anyhow = "1"
```

### 4. Configure minimum window size in `src-tauri/tauri.conf.json`

```json
"app": {
  "windows": [{
    "title": "Mira",
    "width": 1200,
    "height": 800,
    "minWidth": 960,
    "minHeight": 640
  }]
}
```

---

## Running in Development

```bash
npm run tauri dev
```

This starts the Vite dev server and the Tauri app simultaneously. Hot reload is active
for frontend changes. Rust changes require a recompile (Tauri handles this automatically).

**Expected startup**: The splash screen appears for ~1-2 seconds, then the main interface
loads with seed data (tasks page visible).

---

## Building for Production

### Debug build (fast, no optimizations)

```bash
npm run tauri build
```

### Universal macOS binary (.dmg)

```bash
npm run tauri build -- --target universal-apple-darwin
```

Output location:
```
src-tauri/target/universal-apple-darwin/release/bundle/dmg/Mira_<version>_universal.dmg
```

---

## Setting Up AI Features

1. Launch the app.
2. Navigate to **Settings** (gear icon or menu item).
3. Enter your Anthropic API key.
4. Select the model (default: `claude-haiku-4-5`).
5. Click **Save**.
6. Navigate to **问Mira** or **工作库** to test AI responses.

The API key is stored encrypted on the Rust side — it is never written to any frontend
file or localStorage.

---

## Project Structure Overview

```
mira-app/
├── src/                  # Frontend (React + TypeScript)
│   ├── types/            # TypeScript interfaces
│   ├── constants/        # PROJECTS, TEAM_MEMBERS, etc.
│   ├── store/            # React Context state management
│   ├── lib/              # Business logic (seed, report, talent algorithms)
│   ├── hooks/            # Tauri invoke wrappers
│   ├── components/       # Shared UI components
│   ├── pages/            # One directory per route
│   └── styles/           # Global CSS and component styles
├── src-tauri/            # Rust backend (Tauri 2.x)
│   ├── src/
│   │   ├── main.rs       # App entry, plugin + command registration
│   │   ├── models/       # Rust structs matching TypeScript interfaces
│   │   └── commands/     # load_state, save_state, ask_mira, ask_wiki, polish_report, etc.
│   ├── Cargo.toml
│   └── tauri.conf.json
├── demo_spec.md          # Design authority — all UI decisions reference this file
└── specs/001-mira-tauri-desktop/
    ├── spec.md
    ├── plan.md           # This document's parent
    ├── research.md
    ├── data-model.md
    └── contracts/tauri-commands.md
```

---

## Key Decisions Reference

| Decision | Choice | See |
|----------|--------|-----|
| State persistence | Rust-side JSON via `app_data_dir()` | `research.md §3` |
| API key storage | `tauri-plugin-store` (Rust only) | `research.md §4` |
| AI calls | `reqwest` + Anthropic Messages API | `research.md §5` |
| Splash screen | React component (no Tauri plugin) | `research.md §7` |
| Universal binary | `--target universal-apple-darwin` | `research.md §8` |

---

## Validation Checklist (after implementation)

- [ ] `npm run tauri dev` starts without errors
- [ ] Splash screen shows on first launch with pulse animation
- [ ] Seed data appears in 随手记 on first launch
- [ ] Can create, edit, complete, and delete a task; data persists after restart
- [ ] Switching perspectives shows/hides 人才库 correctly
- [ ] Personal and team reports generate correctly for all three periods
- [ ] After entering API key in Settings: Ask Mira, Wiki chat, and AI polish all return
      real API responses
- [ ] API key is not visible in browser devtools (Sources, Network, Application tabs)
- [ ] Universal `.dmg` builds without errors on both arm64 and x86_64
- [ ] All empty states, loading states, and notification copy match `demo_spec.md §7`
