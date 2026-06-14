# Implementation Plan: v2.1 综合修复（统一计划）

**Branch**: `fix/v2-unified` | **Date**: 2026-05-25 | **Spec**: [spec.md](spec.md)

**Input**: Feature specifications from specs/008–011; covers local-auth (009), i18n/UI (010), knowledge-graph split (011), todo/settings fixes (008).

**Note**: This plan is a **unified cross-feature plan** covering all v2.1 repair work.

## Summary

Comprehensive repair of the Mira desktop app covering: (1) local bcrypt authentication gate, (2) Todo completion undo button, (3) Settings AI panel test-connection command, (4) global UI/style standards unification, (5) Chinese copy cleanup, (6) new KnowledgeGraph page split from Stats, (7) Stats page simplification with metric cards.

The primary architectural change is adding a Tauri-native auth gate (separate from the existing web-API sidecar login). All other changes are frontend-only with no new Rust commands except `auth` module and `test_llm_connection`.

## Technical Context

**Language/Version**: Rust 1.75+ (Tauri backend), TypeScript 5.x + React 18 (frontend)

**Primary Dependencies**: Tauri 2.x, Ant Design 5.20, Vite, `bcrypt = "0.15"` (new)

**Storage**: `tauri-plugin-store` (`mira_v2.json`) for persistence; in-memory Mutex fields in AppState for session token

**Testing**: Manual visual verification per feature; no automated tests in scope

**Target Platform**: macOS desktop (Tauri .dmg)

**Project Type**: Desktop application (Tauri + React)

**Performance Goals**: Auth check < 200ms on startup; UI interactions < 300ms

**Constraints**: No new npm packages; no new Rust crates beyond bcrypt; no changes to Node.js sidecar

**Scale/Scope**: Single-user local app; all data local only

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|---|---|---|
| I. macOS Desktop (Tauri 2.x) | ✅ PASS | No platform changes |
| II. Local Authentication (bcrypt, in-memory session) | ✅ PASS | auth.rs implements this |
| III. AI-First + API key gate | ✅ PASS | test_llm_connection enforces key presence |
| IV. Invisible LLM Wiki | ✅ PASS | WikiSection stays in KnowledgeGraph, not labeled as "Wiki" |
| V. Navigation: 6 pages | ✅ PASS | Constitution v3.0.0 amended |
| VI. Chinese-Only Frontend | ✅ PASS | i18n spec (010) covers all pages |
| VII. Consistent UI Design Standards | ✅ PASS | styles.css update covers all pages |
| VIII. API Key Isolation | ✅ PASS | test_llm_connection returns only success/error string |
| IX. AI Feature Availability Gate | ✅ PASS | test_llm_connection checks key before request |
| X. Tauri Command Architecture | ✅ PASS | All new commands via invoke |
| XI. Non-Intrusive Copilot | ✅ PASS | No Copilot changes |
| XII. System-Initiated Mira Ask | ✅ PASS | No MiraAsk changes |
| XIII. Minimal Dependency Discipline | ✅ PASS | Only bcrypt added; justified by auth requirement |

All gates pass. Complexity note: auth gate in App.tsx must fire before existing sidecar login — see Phase 0 R1.

## Project Structure

### Documentation (this feature)

```text
specs/011-knowledge-graph-split/
├── plan.md              ← this file
├── spec.md
└── checklists/requirements.md

specs/008-fix-todo-settings/spec.md
specs/009-local-auth/spec.md
specs/010-i18n-ui-polish/spec.md
```

### Source Code — File Change List

```text
apps/web/src-tauri/
├── Cargo.toml                          [MODIFY] add bcrypt = "0.15"
└── src/
    ├── main.rs                         [MODIFY] extend AppState; register auth + test_llm_connection
    ├── store.rs                        [MODIFY] add LockState; fix StoredLlmConfig defaults; add password hash fns
    └── commands/
        ├── mod.rs                      [MODIFY] pub mod auth
        ├── auth.rs                     [NEW]    6 auth commands
        └── settings.rs                [MODIFY] add test_llm_connection command

apps/web/src/
├── main.tsx                            [NO CHANGE] ConfigProvider zhCN already present ✅
├── styles.css                          [MODIFY] brand colors #1B2A4E/#E8B86D, padding 24px, card 8px radius, nav 200px
└── app/
    ├── types.ts                        [MODIFY] add "knowledge-graph" to Route
    ├── App.tsx                         [MODIFY] add Tauri auth gate; add knowledge-graph nav item
    ├── useTauriApi.ts                  [MODIFY] add tauriAuth; add testLlmConnection to tauriSettings
    └── pages/
        ├── LoginPage.tsx               [NEW]    login page (dark blue full-screen)
        ├── SetupPasswordPage.tsx       [NEW]    first-time setup page (dark blue full-screen)
        ├── TasksPage.tsx               [MODIFY] add undo-complete button to completed section
        ├── SettingsPage.tsx            [MODIFY] add test connection to PersonalAiPanel; update model/URL defaults
        ├── StatsPage.tsx               [MODIFY] remove WikiSection + LintSummarySection; add metric cards
        └── KnowledgeGraphPage.tsx      [NEW]    WikiSection + LintSummarySection + refresh button

Total: 6 Rust files (1 new) + 8 TS/TSX files (3 new)
```

**Structure Decision**: Hybrid Tauri + sidecar app; auth gate layer added above existing sidecar login. KnowledgeGraph page reuses existing components (move, not rebuild).

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| Two-layer auth (Tauri gate + sidecar session) | Sidecar handles all existing data; Tauri auth is the new privacy gate | Replacing sidecar auth would pull in removal of team/workspace features — out of scope |

---

## Phase 0: Research

### R1 — Auth architecture decision

**Decision**: Two-layer auth.
- **Layer 1 (Tauri)**: `check_auth_status()` fires on App mount. Controls `LoginPage` / `SetupPasswordPage` gate.
- **Layer 2 (Sidecar)**: Existing `useMiraApi` session logic preserved as-is.
- React auth state: `"loading" | "needs-setup" | "needs-login" | "authenticated"`.
- After Tauri auth = "authenticated", the existing `!api.user` → `<LoginScreen>` remains in place.

**Rationale**: Additive — does not disturb existing sidecar session management.

### R2 — bcrypt implementation

**Decision**: `bcrypt::hash(password, 12)` on setup/change; `bcrypt::verify(password, hash)` on login. Cost 12 is fast enough for local use. Hash stored in store under key `"password_hash"`.

### R3 — LockState persistence

**Decision**: `LockState { fail_count: u32, locked_at: Option<DateTime<Utc>> }` persisted under key `"lock_state"`. On startup, `check_auth_status()` computes `lock_remaining_seconds` from `locked_at + 30s - now`.

### R4 — Stats trend chart

**Decision**: No new chart library. Use Ant Design `Statistic` cards for all counters. 7-day trend implemented as a simple CSS bar chart using existing styles. If too complex, render as a table of 7 rows — functional over decorative.

### R5 — KnowledgeGraph page

**Decision**: `KnowledgeGraphPage.tsx` wraps existing `WikiSection` + `LintSummarySection` components directly. Adds a `Button` that re-invokes `tauriWiki.getSchema()` + `tauriWiki.getLintSessions()`. No schema data cached at App level — page manages its own state.

---

## Phase 1: Data Model

### New Rust Data Structures

```rust
// 1. main.rs — AppState (add session_token field)
pub struct AppState {
    pub api_key: Mutex<Option<String>>,
    pub lint_state: Mutex<LintState>,
    pub note_throttle: Mutex<HashMap<String, Instant>>,
    pub session_token: Mutex<Option<String>>,   // NEW — in-memory only; None on exit
}

// 2. store.rs — LockState (persisted; survives app restarts)
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct LockState {
    pub fail_count: u32,
    pub locked_at: Option<DateTime<Utc>>,   // timestamp when lock began
}

// 3. commands/auth.rs — AuthStatus return type
#[derive(Debug, Serialize)]
pub struct AuthStatus {
    pub is_setup: bool,
    pub is_locked: bool,
    pub lock_remaining_seconds: u32,
}
```

### StoredLlmConfig Default Update

```rust
// store.rs — switch from OpenAI to Anthropic defaults
impl Default for StoredLlmConfig {
    fn default() -> Self {
        Self {
            base_url: "https://api.anthropic.com".to_string(),
            model: "claude-haiku-4-5".to_string(),
        }
    }
}
```

### New store.rs Functions

```rust
pub fn get_password_hash(app: &AppHandle) -> String    // returns "" if not set
pub fn save_password_hash(app: &AppHandle, hash: &str)
pub fn clear_password_hash(app: &AppHandle)

pub fn get_lock_state(app: &AppHandle) -> LockState
pub fn save_lock_state(app: &AppHandle, state: &LockState)
```

### Tauri Command Interface

| Command | Input | Output (Ok) | Error Codes |
|---|---|---|---|
| `check_auth_status` | — | `AuthStatus` | — |
| `setup_password` | `password: String` | `()` | `"password_too_short"` |
| `login` | `password: String` | `String` (session token) | `"wrong_password"`, `"locked"` |
| `change_password` | `old_password, new_password: String` | `()` | `"wrong_password"`, `"password_too_short"` |
| `logout` | — | `()` | — |
| `reset_all_data` | — | `()` | — |
| `test_llm_connection` | — | `String` (first sentence) | `"api_key_not_set"`, `"connection_failed: <msg>"` |

### Frontend Type Changes

```typescript
// types.ts
type Route = "tasks" | "notes" | "stats" | "knowledge-graph" | "ask-mira" | "mira-ask" | "settings";

// useTauriApi.ts additions
export const tauriAuth = {
  checkStatus: () => invoke<AuthStatus>("check_auth_status"),
  setup:       (password: string) => invoke<void>("setup_password", { password }),
  login:       (password: string) => invoke<string>("login", { password }),
  changePassword: (oldPassword: string, newPassword: string) =>
                  invoke<void>("change_password", { oldPassword, newPassword }),
  logout:      () => invoke<void>("logout"),
  resetAllData:() => invoke<void>("reset_all_data"),
};

// tauriSettings addition
testLlmConnection: () => invoke<string>("test_llm_connection"),
```

---

## Quickstart: Validation Steps

Validate each area independently after implementation:

1. **Auth — first-time**: Delete `password_hash` from store → relaunch → setup password page appears
2. **Auth — returning**: Set password → relaunch → login page appears; correct password enters app
3. **Auth — lockout**: Enter wrong password 5× → locked 30s; auto-unlocks after 30s
4. **Auth — logout**: Settings → 账户与安全 → 退出登录 → returns to login page
5. **Todo undo**: Complete a task → expand 已完成 section → click undo → task returns to open list
6. **Test connection**: Settings → 个人 AI → valid key → 测试连接 → green 连接成功 + first response sentence
7. **KnowledgeGraph page**: Navigate → see 知识图谱 items → click 刷新 → data reloads
8. **Stats page**: Navigate → no WikiSection or LintSummarySection → 4 metric cards visible
9. **Chinese copy**: Navigate all 6 pages — no English text user-visible
10. **Brand colors**: Buttons deep navy `#1B2A4E`; nav selected item same; stats numbers in gold `#E8B86D`
