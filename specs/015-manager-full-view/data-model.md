# Data Model: 删除视图切换 & 管理者完整视图

**Feature**: specs/015-manager-full-view
**Date**: 2026-05-26

---

## 变更：LintQuestion

新增 `scope` 字段，区分问题归属。

```
LintQuestion {
  id: String
  question: String
  context: String
  answered: bool
  answer: Option<String>
  dismissed: bool
  scope: Option<String>    // 新增："personal" | "team"；nil 时向后兼容，视为 "personal"
}
```

**约束**：
- 个人 LintSession（成员触发，或管理者个人模式触发）中所有 LintQuestion 的 scope = "personal"
- 团队 LintSession（管理者团队模式触发）中 LintQuestion scope = "personal"（仅管理者自身数据矛盾）或 "team"（跨成员矛盾）
- 旧数据无 scope 字段时，前端默认视为 "personal" 渲染（向后兼容）

---

## 变更：LintSession

新增 `session_type` 字段，区分 Session 来源。

```
LintSession {
  id: String
  createdAt: String               // ISO8601
  status: "open" | "done" | "expired"
  itemsAnalyzed: u32
  timeSpanDays: u32
  issuesFound: u32
  updatedProjects: Vec<String>
  questions: Vec<LintQuestion>
  session_type: Option<String>    // 新增："personal" | "team"；nil 时向后兼容，视为 "personal"
}
```

**约束**：
- 成员触发 Lint → session_type = "personal"
- 管理者触发 Lint → session_type = "team"（新建独立 Session，不覆盖既有 Session）
- Mira问页面展示时，session_type = "team" 的 Session 在列表中加「团队」标签区分

---

## 新增：TeamWikiSchema（返回值结构，非存储结构）

`get_team_wiki_schema` 命令的返回值，聚合所有成员的 wiki schema 并去重合并。

```
TeamWikiSchema {
  projects: Vec<TeamWikiProject>
  entities: Vec<TeamWikiEntity>
  decisions: Vec<TeamWikiDecision>
}

TeamWikiProject {
  name: String
  taskCount: u32
  status: "active" | "paused" | "done"
  members: Vec<String>            // 参与成员名列表，去重后附注
}

TeamWikiEntity {
  name: String
  type: String
  members: Vec<String>            // 参与成员名列表
}

TeamWikiDecision {
  description: String
  date: String
  project: Option<String>
  members: Vec<String>            // 参与成员名列表
}
```

**去重规则**（用户已确认，clarification Q3）：
- Projects：name 相同 → 合并为一条，members 字段包含所有提到该项目的成员；taskCount 取最大值；status 取最新（done > active > paused 优先级）
- Entities：name + type 均相同 → 合并；否则保留各自条目
- Decisions：description 完全相同 → 合并；否则保留各自条目（不做模糊匹配）

---

## 删除：ViewMode 类型

从 `types.ts` 删除：
```
// 删除
export type ViewMode = "personal" | "team";
```

从 `User` 类型删除：
```
// 删除
canViewTeam: boolean;
```

这两个字段由 `session.role` 取代，role 在 session 中始终存在，不需要额外字段判断。
