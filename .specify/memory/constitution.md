<!--
SYNC IMPACT REPORT
==================
Version change: 1.0.0 → 2.0.0
Bump rationale: MAJOR — Principles I (CDN-Native Architecture) and IV (localStorage-Only Persistence)
  are backward-incompatibly replaced. The entire delivery model shifts from a browser web app to a
  Tauri 2.x macOS desktop app with a Rust backend. Two new principles added (II, IV rewritten, VI new).
Modified principles:
  I.  CDN-Native Architecture          → Tauri 2.x Desktop Architecture
  IV. localStorage-Only Persistence    → Rust-Side Data Persistence
Added principles:
  II. Rust-Side AI & API Security      (new — API key security mandate)
  VI. Lightweight Dependency Discipline (new — explicit dep governance)
Removed principles: none (V Route-Based Feature Isolation preserved; III Ant Design preserved)
Added sections: none
Removed sections: none
Templates requiring updates:
  ✅ plan-template.md — Constitution Check gate is derived at plan time; no structural edit needed.
                        Platform field should now default to "macOS (Tauri 2.x)" when filled in.
  ✅ spec-template.md — Generic; no constitution-specific mandatory sections to add.
  ✅ tasks-template.md — Generic; Rust/frontend task split aligns naturally with Phase structure.
Follow-up TODOs: None — all placeholders resolved.
-->

# Mira App Constitution

## Core Principles

### I. Tauri 2.x Desktop Architecture

Mira is a macOS desktop application built with Tauri 2.x. The final deliverable MUST be a
`.dmg` package. The frontend is a standard Vite-bundled React web app rendered inside the
Tauri webview; it MUST NOT rely on CDN/UMD script tags or in-browser Babel compilation.
The backend is a Rust binary (`src-tauri`) that handles all privileged operations.

- Frontend tech: React 18, Ant Design 5.x, dayjs, marked — installed via npm, bundled by Vite.
- Backend tech: Rust via Tauri 2.x `src-tauri`; manages AI calls, file I/O, and secrets.
- All frontend-to-backend communication MUST use Tauri `invoke()`. Direct HTTP calls from
  the webview to external APIs are prohibited.
- The app MUST function as a standalone offline macOS application except for the AI features
  that require network access.

### II. Rust-Side AI & API Security

API keys and all secrets MUST reside exclusively in the Rust side (`src-tauri`). They MUST
NOT appear in any frontend source file, environment variable accessible to the webview,
`localStorage`, or any other browser-accessible storage.

- All AI API calls (to any LLM provider) MUST be made from Rust Tauri command handlers.
- Rust is responsible for: assembling the full prompt, calling the external AI API, and
  returning only the sanitized result to the frontend via the `invoke()` response.
- The three AI-integrated modules are:
  - **问Mira** (AskMiraPage) — conversational Q&A.
  - **工作库** (WikiPage) — chat-driven knowledge insights.
  - **写总结** (ReportPage) — AI-assisted report polishing.
- Frontend components MUST pass user input and context data to Rust; they MUST NOT construct
  or inspect raw API request/response payloads.

### III. Demo-Faithful UI Reproduction

Phase 1 goal is a 1:1 faithful replica of the existing React web demo as specified in
`demo_spec.md`. UI, interaction behavior, brand colors, Ant Design theme tokens, empty
states, loading states, and all notification/placeholder text MUST match `demo_spec.md`
exactly.

- `demo_spec.md` is the authoritative design source for Phase 1. Any deviation MUST be
  explicitly documented and approved before implementation.
- The Ant Design `ConfigProvider` MUST apply the brand theme as defined in `demo_spec.md`;
  no ad-hoc color or typography overrides are permitted outside the theme config.
- Custom components are only permitted where Ant Design has no equivalent OR where the demo
  uses a custom component. All icons MUST come from `@ant-design/icons`.
- Phase 2+ feature additions are out of scope until Phase 1 is declared complete.

### IV. Rust-Side Data Persistence

All user data MUST be persisted on the Rust side using local file storage (JSON) or SQLite
via `src-tauri`. `localStorage` and browser-side IndexedDB MUST NOT be used for any
persistent application data. The previous `mira_app_state_v4` localStorage schema is
deprecated and MUST be migrated away in Phase 1.

- Frontend state is the in-memory working copy; the Rust layer holds the on-disk source of
  truth.
- All data read/write operations MUST go through Tauri `invoke()` commands exposed by
  `src-tauri`. Direct file-system access from the webview is prohibited.
- The storage format (JSON file vs. SQLite) MUST be decided in the plan for each feature;
  once chosen it MUST NOT be changed without a MAJOR constitution amendment.
- Data schema changes that break existing persisted files constitute a MAJOR version bump.

### V. React Context Frontend State

In-memory application state on the frontend MUST be managed via React Context + Provider
pattern (`StoreProvider`). No third-party state management library (Redux, Zustand, MobX,
etc.) may be introduced.

- All state mutations MUST go through the defined Actions dispatched to the context.
- Components MUST NOT manage shared state locally with `useState`; local ephemeral UI state
  (modal open/close, input draft) is the only permitted exception.
- On app start, the frontend MUST load persisted state from Rust via `invoke()` and
  hydrate the context store before rendering.
- On state change that requires persistence, the frontend MUST call the corresponding Rust
  `invoke()` command. Fire-and-forget is acceptable for non-critical writes; critical writes
  MUST await the Rust response before reporting success to the user.

### VI. Lightweight Dependency Discipline

No dependency — frontend (npm) or backend (Cargo) — beyond those enumerated in `demo_spec.md`
and this constitution may be introduced without explicit approval and a constitution PATCH
amendment documenting the rationale.

- Frontend: React 18, Ant Design 5.x, `@ant-design/icons`, dayjs (with plugins), marked,
  ECharts 5.x (reserved, opt-in). Tauri JS bindings (`@tauri-apps/api`) are always permitted.
- Backend (Cargo): Tauri 2.x, `serde`/`serde_json`, `tokio`, an HTTP client for AI calls
  (e.g., `reqwest`), and optionally `rusqlite`. No ORM, no additional async runtimes.
- "Heavy" is defined as: > 10k lines of compiled Rust code added, or > 500 KB to the final
  `.dmg` size, or pulling in a new async executor. Any such addition requires justification.

## Technology Constraints

- **Target platform**: macOS (arm64 + x86_64 universal binary preferred); no Windows/Linux
  target in Phase 1.
- **Tauri version**: 2.x (not 1.x); Tauri APIs used MUST be stable, not experimental.
- **Rust edition**: 2021; `stable` toolchain only.
- **Frontend build**: Vite; TypeScript is optional but type annotations in `.tsx` files are
  encouraged for Tauri `invoke()` payloads.
- **Date handling**: All date logic on the frontend MUST use dayjs with the loaded plugins
  (weekOfYear, isoWeek, customParseFormat, zh-cn locale). Rust side uses `chrono`.
- **AI provider**: Provider is not mandated by this constitution; it MUST be configurable in
  `src-tauri` without frontend changes.

## Development Workflow

- **Specification first**: Every new feature or significant change MUST have a `spec.md`
  before implementation begins. Use `/speckit-specify` to create it.
- **Branch per feature**: All work MUST occur on a feature branch created by
  `/speckit-git-feature`. Direct commits to `main` are prohibited except for
  constitution/governance amendments.
- **Phase 1 fidelity gate**: Before a Phase 1 feature is considered done, a manual side-by-
  side comparison with `demo_spec.md` MUST be performed and documented in the PR description.
- **Incremental delivery**: Features MUST be broken into independently testable user stories
  (P1 → P2 → P3). Each P1 story MUST deliver a usable MVP on its own.
- **No dead code**: Removed routes, Tauri commands, or state fields MUST be deleted entirely.
  Commented-out code is not permitted in merged branches.

## Governance

This constitution supersedes all other written or verbal development guidelines for Mira App.
In case of conflict between this document and any plan, spec, or task list, this constitution
takes precedence.

**Amendment procedure**:
1. Author proposes change via a constitution branch (`constitution/vX.Y.Z-description`).
2. Change is documented in the Sync Impact Report comment at the top of this file.
3. Affected templates and docs are updated in the same PR.
4. Version is bumped per semantic versioning rules below.

**Versioning policy**:
- MAJOR bump: backward-incompatible removal or redefinition of a principle; storage schema
  key changes that break existing persisted data; platform target changes.
- MINOR bump: new principle or section added, or materially expanded guidance.
- PATCH bump: clarifications, wording, typo fixes, non-semantic refinements, adding a
  permitted dependency to the approved list.

**Compliance review**: The Constitution Check gate in every `plan.md` MUST reference the
current version and confirm all six core principles are addressed before Phase 0 research
begins. Any plan that introduces a Rust dependency not on the approved list, or that stores
data on the frontend, MUST include a Complexity Tracking justification.

**Version**: 2.0.0 | **Ratified**: 2026-05-22 | **Last Amended**: 2026-05-22
