<div align="center">

# 🪞 Mira | See

### *See every step. Shape every you.*

**Every step matters. Small daily work can compound into measurable growth.**

</div>

---

## About Mira

> We believe that every person who works seriously deserves to be seen.
>
> Yet daily noise, weekly-report fatigue, and KPI pressure often bury the moments that truly matter.
>
> Mira keeps things simple:
> quietly collect every step you record,
> then reflect how far you have come,
> and how your team is evolving.

### Naming Notes

| Dimension | Meaning |
|------|------|
| **Etymology** | From Latin *mirari* (to look with wonder), related to mirror / admire / miracle |
| **Brand Theme** | See · Meet · Gain Insight, aligned to Record → Profile → Insight |
| **Brand Personality** | A calm, gentle, insightful mirror |

### Sub-product Naming System

| Product Area | Name | Meaning |
|--------|------|------|
| Team member view | **Mira · Self** | See your own step-by-step growth |
| Manager view | **Mira · Team** | See the full potential of your team |
| Knowledge core | **Mira Wiki** | Member-level LLM-style knowledge base |
| Tag schema engine | **Mira Lens** | See each person through evolving tags |

---

## 1. Product Positioning

**Mira** is a platform for engineering and project teams, focused on **individual growth × team profiling**.

It turns fragmented daily actions (todos, weekly reports, meeting notes) into:

- Individual outcomes: structured reports, visible achievements, quantifiable performance
- Team outcomes: member knowledge base, dynamic tag schema, team capability profile

It transforms "work you did" into "progress people can see", and upgrades management from "asking for status" to "seeing the profile".

---

## 2. Core Ideas and Functional Loop

The platform is built on **two core chains**.

### 🔗 Chain 1: Todo → Structured Weekly Report

```
Quick-capture todos (status + tags)
        │
        ▼
 Optional weekly note upload
        │
        ▼
 AI aggregation + structuring
        │
        ▼
┌──────────────────────────────┐
│  Structured Weekly Report    │
│   · Completed This Week      │
│   · In Progress / Blocked    │
│   · Next Week Plan           │
│   · Risks & Help Needed      │
└──────────────────────────────┘
```

### 🔗 Chain 2: Weekly Report → Knowledge Base → Tag Schema → Derived Capabilities

```
Structured weekly reports (member-level archive)
        │
        ▼
Personal knowledge base (LLM Wiki style)
        │
        ▼
 Auto-extract keywords and behavior patterns
        │
        ▼
Member tag schema (dynamic lint maintenance)
        │
        ├──► Achievement badges
        ├──► Personal performance diagnosis
        ├──► Team profile and capability heatmap
        ├──► Team work summary
        └──► Intelligent matching (find people, team up, learning suggestions)
```

> 📌 Together, these chains create a product flywheel: **more records → richer knowledge base → better tags → stronger derived features → stronger motivation to keep recording**.

---

## 3. Two-Perspective Feature Overview

### 👤 Team Member Perspective

| Module | Core Capability | Chain Position |
|------|---------|---------|
| 📝 Weekly Assistant | Todo capture + weekly note upload + AI-generated structured report | Chain 1 entry |
| 🏅 Achievement Panel | Auto-light badges from knowledge-base tags | Chain 2 derived |
| 📊 Performance Management | Monthly/quarterly/semiannual/annual KPI deviation analysis + health diagnosis + AI suggestions | Chain 2 derived |

### 👥 Manager Perspective

| Module | Core Capability | Chain Position |
|------|---------|---------|
| 📋 Team Summary Assistant | Select members → auto-aggregate reports → generate group-level summary | Chain 2 derived |
| 🌐 Team Portrait | Cold-start from historical reports + dynamic lint tag updates + tag cloud / heatmap visualization | Chain 2 core |

---

## 4. Core Module Details

### Module 1: Weekly Assistant (Chain 1)

#### 1.1 Quick Capture
- Full todo CRUD, classification (meeting / coding / docs / proposal / others), and priority
- Checking completion **auto-syncs** into the current week "Completed" section
- Each todo can include a one-line summary and related file/link

#### 1.2 Weekly Note Upload
- For members who do not use quick capture frequently; supports Friday batch entry
- Supports text, Markdown, and Word uploads
- AI parses into todo-level items and merges/deduplicates with quick-capture data

#### 1.3 Weekly Report Generation
- One-click aggregation of all "completed / in progress / plan / risks"
- Standard output structure: Completed · In Progress · Next Week Plan · Risks & Help Needed
- Users can edit before archiving; archive **automatically writes to personal knowledge base**

---

### Module 2: Personal Knowledge Base (Chain 2 carrier, platform core)

> The knowledge base is the platform memory center. All derived capabilities grow from it.

#### 2.1 Storage Granularity
- **One independent space per team member**
- Data sources: structured reports, quick-capture originals, uploaded weekly notes, meeting notes

#### 2.2 LLM Wiki Management
- Every new archived report triggers LLM incremental updates
- Automatically maintains:
  - **Workstream focus** (what the member is doing lately and for how long)
  - **Capability keywords** (frequent technical/business terms)
  - **Collaboration map** (frequent co-occurring teammates)
  - **Trend shifts** (moving areas of focus)
- Supports natural-language retrieval and Q&A

#### 2.3 Tag Schema Generation
- Continuous candidate-tag generation during knowledge-base updates
- Candidates are promoted through frequency/time/diversity lint checks
- Long-inactive tags are marked as sleeping to avoid profile drift

---

### Module 3: Achievement Panel (Chain 2 derived)
- Badge rules trigger automatic badge unlocks
- Sample rules:
  - ≥ 5 meeting notes → 🏅 Meeting Notes Pro
  - ≥ 3 proposal contributions → 🏅 Proposal Star
  - ≥ 4 consecutive weekly submissions → 🏅 Consistency Star
  - Mentioned in reports of ≥ 3 teammates → 🏅 Team Glue
- Clicking a badge shows the unlock trace (source snippets from the knowledge base)

---

### Module 4: Personal Performance Management (Chain 2 derived)
- Supports monthly / quarterly / semiannual / annual periods
- Auto-extracts output data from knowledge base and aligns with KPI targets
- Three-state health: 🟢 Healthy / 🟡 Attention Needed / 🔴 Off Track
- Multi-dimensional radar: output · quality · collaboration · innovation
- AI diagnostic suggestions based on member-specific context

---

### Module 5: Team Summary Assistant (Chain 2 derived)
- Select members + time range
- Aggregate selected members' report and knowledge-base snippets
- Output group-level summary:
  - Core progress by theme
  - Shared risks and blockers
  - Highlight members and events
  - Manager recommendations

---

### Module 6: Team Portrait (Chain 2 core display)

#### 6.1 Cold Start
- Supports **batch upload of historical reports** (zip / multiple files)
- System ingests each report, extracts keywords, initializes member tag schema

#### 6.2 Dynamic Lint Update Mechanism
| Lint Rule | Trigger Action |
|----------|---------|
| New keyword frequency ≥ threshold | Auto-add new tag |
| Existing tag not triggered for N weeks | Mark as sleeping tag |
| Semantic overlap between tags | Auto-merge |
| Match with KPI/achievement rules | Auto-link and unlock |

#### 6.3 Visualization
- Member tag cloud
- Team capability distribution heatmap
- Tag evolution timeline (how a member's capability grows)

---

## 5. Data and Information Architecture

```
┌─────────────────────────────────────────────────┐
│                    User Layer                   │
│        Member Perspective   │ Manager Perspective │
└──────┬──────────────────────────┬───────────────┘
       │                          │
┌──────▼──────────────────────────▼───────────────┐
│             Capability Layer (Derived)          │
│ Weekly Report │ Achievement │ KPI │ Team Summary │ Team Portrait │
└──────┬───────────────────────────────────────────┘
       │
┌──────▼───────────────────────────────────────────┐
│          Tag Schema (Dynamic Lint Engine)       │
│ keyword extraction · frequency stats · merge · sleep · linkage │
└──────┬───────────────────────────────────────────┘
       │
┌──────▼───────────────────────────────────────────┐
│      Personal Knowledge Base (LLM Wiki, member-level) │
│ archive reports · incremental updates · natural-language Q&A │
└──────┬───────────────────────────────────────────┘
       │
┌──────▼───────────────────────────────────────────┐
│      Raw Data: quick capture + weekly note + uploads │
└──────────────────────────────────────────────────┘
```

---

## 6. Technology Stack (Demo Phase)

| Layer | Stack |
|------|------|
| Frontend framework | React 18 + Vite + TypeScript |
| UI components | Ant Design 5.x |
| Charts | ECharts / Recharts |
| State management | Zustand |
| Routing | React Router v6 |
| Mock data | Mock.js + LocalStorage |
| LLM capability | Rule/template simulation in demo, reserved OpenAI/local model adapters |

---

## 7. Typical User Flows

**Member side**
1. Capture todos from Monday to Thursday; check when complete.
2. Generate weekly report on Friday → review and edit → archive.
3. System auto-updates knowledge base → unlocks achievements → refreshes performance health.

**Manager side**
1. Cold start: batch import historical reports to initialize team portrait.
2. Before weekly sync: select members and generate team summary in one click.
3. Quarterly review: inspect tag evolution timeline and capability heatmap.

---

## 8. Product Value Summary

- For **team members**: less manual writing, more visible return. One quick record becomes a trackable growth trail.
- For **managers**: shift from status chasing to profile-based management, from intuition-driven to data-informed.
- For **organizations**: build a self-evolving team memory asset with long-term strategic value.

> **See every step. Shape every you.**
>
> That is Mira.