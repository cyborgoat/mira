# Implementation Plan: Mira·见微 — macOS Desktop App

**Branch**: `001-mira-tauri-desktop` | **Date**: 2026-05-22 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/001-mira-tauri-desktop/spec.md`

## Summary

Replicate the Mira·见微 React web demo as a production-quality macOS desktop application
using Tauri 2.x. The frontend is a Vite + React 18 + TypeScript web app rendered inside
the Tauri webview; the Rust backend manages all file I/O, AI API calls, and secret storage.
All frontend–backend communication goes through six Tauri `invoke()` commands. The app ships
as a universal macOS `.dmg` supporting both Apple Silicon and Intel. UI, interactions, and
copy must 1:1 match `demo_spec.md`. Implementation proceeds in four phases: project scaffold
→ core app shell + tasks → secondary pages (report, wiki, ask) → AI integration + settings.

## Technical Context

**Language/Version**: TypeScript 5.x (frontend) · Rust 2021 edition / stable toolchain (backend)

**Primary Dependencies**:
- Frontend: React 18, Ant Design 5.20, `@ant-design/icons`, dayjs (with plugins), marked 12.x,
  `@tauri-apps/api` 2.x
- Backend (Cargo): `tauri` 2.x, `tauri-plugin-store`, `serde` + `serde_json`, `tokio`,
  `reqwest` (TLS features), `anyhow`

**Storage**: Local JSON file via `app_data_dir()` (Rust `serde_json`); API key via
`tauri-plugin-store` encrypted store

**Testing**: `cargo test` (Rust unit tests for business logic); `vitest` (optional frontend
unit tests for pure functions like `hashCode`, `computeMemberAbilities`). No E2E test
suite required for this phase.

**Target Platform**: macOS 11+ (arm64 Apple Silicon + x86_64 Intel); universal binary
via `lipo`; delivered as `.dmg` via Tauri bundler

**Project Type**: Desktop app (Tauri 2.x with embedded Vite/React webview)

**Performance Goals**: Cold start to interactive main UI < 3 seconds (SC-006);
JSON state load < 100ms for up to 500 tasks

**Constraints**:
- API key MUST NOT appear in any frontend code, JS variable, localStorage, or network
  response visible to the webview — stored exclusively in `tauri-plugin-store`
- UI MUST match `demo_spec.md` pixel-fidelity: brand colors, spacing, copy, empty/loading
  states, notification messages
- Offline-capable for all non-AI features (tasks, local report generation)
- No streaming AI responses; one-shot request → response

**Scale/Scope**: Single-user app; fixed data set (5 projects, 6 team members); expected
task count < 1000; single JSON state file ~100KB max

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*
*Constitution version: 2.0.0*

| Principle | Gate | Status |
|-----------|------|--------|
| I. Tauri 2.x Desktop Architecture | Delivery is a `.dmg`; frontend built by Vite (no CDN/Babel); backend is Rust `src-tauri` | ✅ PASS |
| II. Rust-Side AI & API Security | `ask_mira`, `ask_wiki`, `polish_report` Rust commands own all API calls; key stored in `tauri-plugin-store`; `get_api_key_set` returns bool only | ✅ PASS |
| III. Demo-Faithful UI Reproduction | `demo_spec.md` declared design authority in spec; all UI tokens, copy, empty/loading states sourced from it | ✅ PASS |
| IV. Rust-Side Data Persistence | `load_state` / `save_state` Tauri commands; JSON file in `app_data_dir()`; no `localStorage` for persistent data | ✅ PASS |
| V. React Context Frontend State | `StoreProvider` + Context pattern; state hydrated from Rust on startup; all mutations via dispatched actions | ✅ PASS |
| VI. Lightweight Dependency Discipline | npm list: React 18, Ant Design 5.20, icons, dayjs, marked, @tauri-apps/api. Cargo list: tauri 2.x, serde, serde_json, tokio, reqwest, tauri-plugin-store, anyhow. All within approved list. | ✅ PASS |

**All gates pass. No complexity justification required.**

## Project Structure

### Documentation (this feature)

```text
specs/001-mira-tauri-desktop/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── tauri-commands.md
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 output (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

```text
src/                          # Frontend (Vite + React 18 + TypeScript)
├── main.tsx                  # Entry point
├── App.tsx                   # Root: ConfigProvider → StoreProvider → BootLoader → MainLayout
├── types/
│   └── index.ts              # AppState, Task, Project, ChatMsg, SourceCard, TeamMember,
│                             #   AppSettings, Priority interfaces
├── constants/
│   └── index.ts              # PROJECTS, PRIORITIES, TEAM_MEMBERS, KEYWORD_DICT, TAG_DIMENSIONS
├── store/
│   ├── context.tsx           # AppContext, StoreProvider, useStore hook
│   └── actions.ts            # Action type definitions + reducer/dispatcher
├── lib/
│   ├── seed.ts               # buildSeed(), generateHistoryTasks(), generateCurrentTasks()
│   ├── report.ts             # generatePersonalReport(), generateTeamReport()
│   └── talent.ts             # hashCode(), assignTasksToMembers(), computeMemberAbilities()
├── hooks/
│   └── useTauri.ts           # Typed wrappers around invoke() for each Rust command
├── components/
│   ├── layout/
│   │   ├── MainLayout.tsx    # Sider + Header + Content shell
│   │   ├── AppSider.tsx      # User info, perspective Segmented, menu items
│   │   └── BootLoader.tsx    # Splash screen with pulse animation
│   └── common/
│       ├── MiraCard.tsx      # Reusable card with gold left-border title
│       ├── ChatBubble.tsx    # User/assistant chat bubble with markdown support
│       └── SourceCard.tsx    # AI response source citation card
├── pages/
│   ├── tasks/
│   │   ├── TasksPage.tsx
│   │   ├── TaskItem.tsx
│   │   └── TaskModal.tsx
│   ├── report/
│   │   ├── ReportPage.tsx
│   │   ├── PersonalTab.tsx
│   │   └── TeamTab.tsx
│   ├── wiki/
│   │   ├── WikiPage.tsx
│   │   ├── ProjectCard.tsx
│   │   ├── ProjectDetail.tsx
│   │   └── WikiChat.tsx
│   ├── ask/
│   │   └── AskMiraPage.tsx
│   ├── talent/
│   │   ├── TalentPoolPage.tsx
│   │   ├── MemberCard.tsx
│   │   └── MemberModal.tsx
│   └── settings/
│       └── SettingsPage.tsx
└── styles/
    ├── global.css            # CSS variables (--mira-primary, --mira-gold, etc.), scrollbar
    └── components.css        # .chat-bubble, .project-card, .mira-card-title, etc.

src-tauri/                    # Rust backend (Tauri 2.x)
├── Cargo.toml
├── tauri.conf.json           # App identifier, window config, bundle config
├── icons/                    # App icons (generated by Tauri tooling)
└── src/
    ├── main.rs               # Tauri app builder, plugin registration, command registration
    ├── models/
    │   └── state.rs          # Rust structs mirroring frontend types (serde Serialize/Deserialize)
    └── commands/
        ├── state.rs          # load_state(app), save_state(app, state)
        ├── ai.rs             # ask_mira(...), ask_wiki(...), polish_report(...)
        └── settings.rs       # get_api_key_set(app), set_api_key(app, key)
```

**Structure Decision**: Tauri 2.x desktop app layout. Frontend under `src/` (Vite root),
Rust under `src-tauri/`. This is the canonical Tauri project structure. Frontend is
page-per-route with shared components and a centralized store. Rust commands are grouped
by domain (state I/O, AI, settings) to keep files focused.

## Complexity Tracking

> No constitution violations — this section intentionally left empty.
