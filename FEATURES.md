<div align="center">

# 🪞 Mira | Feature View

### *See every step. Shape every you.*

</div>

---

## 📑 Contents

- [🪞 Mira | Feature View](#-mira--feature-view)
    - [*See every step. Shape every you.*](#see-every-step-shape-every-you)
  - [📑 Contents](#-contents)
  - [Overall Architecture](#overall-architecture)
  - [Perspective Model](#perspective-model)
  - [Module 01 · Workspace (Default Entry)](#module-01--workspace-default-entry)
    - [Functional View](#functional-view)
    - [Core Capabilities](#core-capabilities)
  - [Module 02 · Weekly Assistant](#module-02--weekly-assistant)
    - [Four Tabs](#four-tabs)
    - [Four Standard Report Sections](#four-standard-report-sections)
    - [Archive Trigger Chain](#archive-trigger-chain)
  - [Module 03 · My Knowledge Base (Mira Wiki)](#module-03--my-knowledge-base-mira-wiki)
    - [Page Structure (left profile + right retrieval)](#page-structure-left-profile--right-retrieval)
    - [Member Profile (auto-generated)](#member-profile-auto-generated)
    - [Tag Schema Display](#tag-schema-display)
  - [Module 04 · Achievement Panel](#module-04--achievement-panel)
    - [Built-in Rules (8)](#built-in-rules-8)
    - [Interaction Details](#interaction-details)
  - [Module 05 · Personal Performance Management](#module-05--personal-performance-management)
    - [Period Switch](#period-switch)
    - [4-D KPI Model](#4-d-kpi-model)
    - [Three Health States](#three-health-states)
    - [Visual Components](#visual-components)
  - [Module 06 · Team Portrait (Mira Lens)](#module-06--team-portrait-mira-lens)
    - [Core Metrics](#core-metrics)
    - [Dual Visualization](#dual-visualization)
    - [Member Tag Snapshot + Evolution Drawer](#member-tag-snapshot--evolution-drawer)
  - [Module 07 · Team Summary Assistant](#module-07--team-summary-assistant)
    - [Configuration](#configuration)
    - [Aggregate Output](#aggregate-output)
    - [One-click Export](#one-click-export)
  - [Module 08 · Cold-Start Batch Import](#module-08--cold-start-batch-import)
    - [Workflow](#workflow)
    - [Demo Helper](#demo-helper)
  - [Core Mechanisms](#core-mechanisms)
    - [1️⃣ Tag Lint Schema Maintenance](#1️⃣-tag-lint-schema-maintenance)
    - [2️⃣ Data Persistence](#2️⃣-data-persistence)
    - [3️⃣ Visual System (Brand Tokens)](#3️⃣-visual-system-brand-tokens)
    - [4️⃣ Technical Composition](#4️⃣-technical-composition)

---

## Overall Architecture

```
Quick Capture / Weekly Notes / Historical Weekly Report Upload
                    │
                    ▼
      One-click Structured Weekly Report Generation
                    │
                    ▼
   Archive → Personal Knowledge Base (member-level)
                    │
                    ▼
      Lint → Automatic Tag Schema Maintenance
                    │
      ┌────────┼─────────┬──────────┬──────────┐
      ▼        ▼         ▼          ▼          ▼
  Achievements KPI Diagnosis Team Portrait Team Summary Smart Matching
```

**Two core chains drive the product flywheel:**

| Chain | Description |
|------|------|
| **Chain 1** | Todos / Weekly Notes → AI Aggregation → **Structured Weekly Report** |
| **Chain 2** | Weekly Report → **Personal Knowledge Base (LLM Wiki)** → **Tag Schema** → Derived Capabilities |

---

## Perspective Model

Top segmented switcher controls perspective. Left-side drawer menu is grouped by perspective.

| Perspective | Entry | Visible Modules |
|------|------|---------|
| 👤 **Team Member** | Default | Workspace · Weekly Assistant · My Knowledge Base · Achievement Panel · Performance Management |
| 👥 **Team Manager** | Top switcher | All member modules plus: Team Portrait · Team Summary · Cold-Start Import |

**Side Menu**: collapsed by default. Click top ☰ or breadcrumb "☰ Menu" to open a card-style list plus current user info.

---

## Module 01 · Workspace (Default Entry)

> The first screen users see: a clean two-column recording interface.

### Functional View

```
┌──────────────────────────────┬──────────────────────────────┐
│  Hello, Alex 👋              │  This Week Records   3 / 5   │
│  Oct 28 · Capture a step     │  ──────────────────────────   │
│  of what you did today       │  ☐ Draft proposal section…    │
│                              │     10/28 14:22              │
│  ┌ Example: Product review ┐ │  ☑ Completed code review…    │
│  │                        │ │     10/28 11:05              │
│  │ Cursor + ghost text    │ │     🪞 Archived              │
│  └────────────────────────┘ │  ☑ Wrote meeting notes…      │
│                              │     10/27 16:40              │
│  Enter  submit               │     🪞 Archived              │
│  Tab    accept suggestion    │                              │
│  Shift+Enter newline         │                              │
└──────────────────────────────┴──────────────────────────────┘
```

### Core Capabilities

| Feature | Description |
|------|------|
| **Minimal input** | Single input box, no dropdowns/extra fields, auto-resize |
| **Ghost autocompletion** | Real-time light-gray suggestion after cursor, accept with `Tab` |
| **3-source suggestion corpus** | 1) Personal KB phrases 2) Built-in keyword dictionary (19 common terms) 3) Teammate names |
| **Keyboard shortcuts** | `Enter` submit, `Tab` accept suggestion, `Shift+Enter` newline |
| **Status toggle** | Check a todo to mark complete |
| **Archive animation** | Golden pulse for 1.4s + bottom-right toast "🪞 Archived" |
| **Persistence** | All data stored in browser LocalStorage; refresh-safe |

---

## Module 02 · Weekly Assistant

> Automatically aggregate fragmented quick captures and weekly notes into a structured report.

### Four Tabs

| Tab | Function |
|-----|------|
| ✅ **Quick Capture** | Current-week todo list, category/priority/delete/complete |
| 📤 **Weekly Note Upload** | Rich text input + `.txt` / `.md` upload, split by line/sentence |
| 🪄 **Generate Weekly Report** | One-click aggregation to standard sections |
| 📚 **Report History** | Timeline view with archived vs draft status |

### Four Standard Report Sections

- **✅ Completed This Week**: from checked todos and completed items in weekly notes
- **🚧 In Progress / Blocked**: unchecked todos
- **📌 Next Week Plan**: sentence detection using plan-related keywords; auto-fill fallback
- **⚠️ Risks & Help Needed**: automatic prompt when unfinished items are high

### Archive Trigger Chain

```
Click "📚 Archive to Knowledge Base"
   ↓
Write into personal knowledge base (weekKey-based slicing)
   ↓
Run Lint → update member tag schema
   ↓
Run achievement engine → evaluate unlocks
   ↓
Global toast confirmation
```

---

## Module 03 · My Knowledge Base (Mira Wiki)

> Knowledge base = platform memory center. All derived capabilities originate here.

### Page Structure (left profile + right retrieval)

```
┌─────────────────┬────────────────────────────────┐
│ 🪞 Member Profile│ 🔍 Knowledge Retrieval          │
│  AI Summary      │ ┌──────────────────────────┐   │
│ • Workstream     │ │ Search box (highlight)  │   │
│ • Collaborators  │ └──────────────────────────┘   │
│ • Coverage       │ • Timeline entry cards         │
│                  │ • Source tags: done / ongoing  │
│ 🏷️ Tag Schema    │ • Highlighted keyword hits     │
│ • tag · count    │                                │
│ • sleeping 💤    │                                │
└─────────────────┴────────────────────────────────┘
```

### Member Profile (auto-generated)

Summarized from KB content:
- **Workstream**: top 3 most frequent active tags
- **Collaborators**: teammate names extracted from entries
- **Coverage**: entry count + recent-week span

### Tag Schema Display

Each tag appears as: `name · count [· 💤 sleeping]`, clickable for related entries.

---

## Module 04 · Achievement Panel

> Achievements are auto-identified from the knowledge base and unlocked as badges.

### Built-in Rules (8)

| Badge | Unlock Condition | Category |
|------|----------|------|
| 📝 Meeting Notes Pro | Write meeting notes ≥ 5 times | Output |
| 🏆 Proposal Star | Participate in proposal work ≥ 3 times | Output |
| 🔍 Code Review Expert | Participate in code reviews ≥ 3 times | Output |
| 🏗️ Architect Starter | Participate in architecture design ≥ 2 times | Output |
| 🛡️ Quality Gatekeeper | Complete unit-testing work ≥ 3 times | Output |
| 🎙️ Tech Advocate | Deliver tech-sharing sessions ≥ 2 times | Collaboration |
| 🤝 Team Glue | Mentioned in reports of ≥ 3 teammates | Collaboration |
| 🔥 Consistency Star | Submit weekly reports for ≥ 4 consecutive weeks | Consistency |

### Interaction Details

- Unlocked: warm gold gradient + vivid icon
- Locked: grayscale filter + progress counter (`X / N`)
- Click badge: modal shows **unlock trace** with source snippets

---

## Module 05 · Personal Performance Management

> No manual forms. Diagnosis is fully auto-generated from the knowledge base.

### Period Switch

`Monthly · Quarterly · Semiannual · Annual` with week-based slicing of KB subset.

### 4-D KPI Model

| Dimension | Auto-stat Logic |
|------|-------------|
| **Output Volume** | Total KB entries in period |
| **Quality** | 70 + weighted entry count (max 90+) |
| **Collaboration** | Keyword frequencies for meeting/collab/sync/review/communication |
| **Innovation** | Keyword frequencies for optimization/architecture/design/innovation/exploration/sharing |

### Three Health States

| State | Overall Achievement | Visual |
|------|---------|------|
| 🟢 Healthy | ≥ 90% | Green gradient card |
| 🟡 Attention Needed | 70%–89% | Yellow gradient card |
| 🔴 Off Track | < 70% | Red gradient card |

### Visual Components

- **Radar chart**: target (gold dashed) vs actual (deep-blue solid)
- **8-week output trend**: line chart with gradient area
- **AI health diagnosis**: detects weakest dimensions and suggests actions

---

## Module 06 · Team Portrait (Mira Lens)

> Team capability map grown from weekly reports.

### Core Metrics

`Active tags · New tags · Sleeping tags · Tag density (count/person)`

### Dual Visualization

```
┌─────────────────────┬─────────────────────┐
│ ☁️ Team Tag Cloud    │ 🔥 Member × Tag Heatmap │
│                     │                     │
│ Higher freq = larger │ X axis: Top 10 tags │
│ Color: navy/gold     │ Y axis: members     │
│                     │ Color depth = freq   │
└─────────────────────┴─────────────────────┘
```

### Member Tag Snapshot + Evolution Drawer

Each member row shows top 8 tags. Click "View Evolution" to open a drawer with stacked area chart of top tags over recent weeks.

---

## Module 07 · Team Summary Assistant

> Select members + time range to generate a team-level summary from multiple weekly reports.

### Configuration

- **Member multi-select**: checkbox list of non-manager members (all selected by default)
- **Time range**: last 1 / 2 / 4 / 8 weeks

### Aggregate Output

| Section | Content |
|------|------|
| 🎯 **Core Progress** | Grouped by 19 keyword themes with representative items |
| ⚠️ **Shared Risks & Help Requests** | Consolidated risk items from selected members |
| 🌟 **Highlight Members** | Top 3 ranked by completed outputs |
| 🪞 **Manager Recommendations** | Auto summary based on themes and risks |

### One-click Export

- Copy to clipboard as Markdown for direct sharing in chat tools

---

## Module 08 · Cold-Start Batch Import

> For first-time team onboarding to Mira, import historical reports to quickly build team portraits.

### Workflow

```
Drag/drop or select multiple .txt / .md files
        │  (filename recommended: member + week)
        ▼
Parse: detect member, infer week, split into items
        │
        ▼
Preview pending list (member / week / completed count / filename)
        │
        ▼
Click "Confirm Import and Trigger Lint"
        │
        ├─► Batch KB ingestion
        ├─► Team-wide lint and schema initialization
        └─► Team-wide achievement recalculation
```

### Demo Helper

- **🎲 One-click mock report generation**: generate 4 weeks of historical mock reports for each non-manager member

---

## Core Mechanisms

### 1️⃣ Tag Lint Schema Maintenance

| Rule | Trigger Action |
|------|---------|
| Keyword hit frequency ≥ threshold | Promote to formal tag |
| Tag not hit for > 4 weeks | Mark as sleeping 💤 |
| Matches achievement/KPI rules | Auto-link and trigger |

### 2️⃣ Data Persistence

- **Storage**: browser `localStorage`, key `mira_app_state_v1`
- **Persisted entities**: members, todos, reports, knowledge base, tags, achievements
- **Reset entry**: top "Reset" button clears state and refreshes

### 3️⃣ Visual System (Brand Tokens)

| Token | Value | Usage |
|-------|-----|------|
| `--mira-primary` | `#1B2A4E` (navy) | Primary color, text |
| `--mira-gold`    | `#E8B86D` (dawn gold) | Accent, achievements, highlights |
| `--mira-mist`    | `#E7ECF3` (mist gray) | Borders, separators |
| `--mira-bg`      | `#F5F7FB` | Page background |

### 4️⃣ Technical Composition

| Type | Stack |
|------|------|
| Framework | React 18 (CDN UMD) |
| UI | Ant Design 5 |
| Charts | ECharts 5 + echarts-wordcloud |
| Time | Day.js (isoWeek / customParseFormat plugins) |
| JSX compilation | Babel Standalone (in-browser) |
| Deployment | Single HTML file, runnable by double-click |

---

> 🪞 **Every step matters.**
>
> Keep modules focused: recording is the entry, the knowledge base is the center, tags are the engine, and portraits are the mirror.