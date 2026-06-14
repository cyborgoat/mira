# Feature Specification: LLM Wiki 后端能力

**Feature Branch**: `005-llm-wiki-backend`

**Created**: 2026-05-25

**Status**: Draft

**Input**: 实现 LLM Wiki 后端服务——纯 Rust 侧的知识库维护系统。用户每次记录 Tasks 或 Notes
时，系统自动在后台提取知识、更新结构化知识库，定期进行全量整合，并为前端所有 AI 功能提供
统一的查询接口。用户无需感知这套系统的存在。

**Note**: 这是纯后端能力，没有对应的前端页面（遵循 Principle III：LLM Wiki 对用户不可见）。
本 spec 以「系统向前端暴露的能力契约」为主要视角，测试场景面向接口行为。

## User Scenarios & Testing *(mandatory)*

### User Story 1 — 实时知识提取（Task / Note 写入时触发）(Priority: P1)

用户每次创建或修改 Task，或者 Note 自动保存时，系统在后台静默分析这条内容，
将识别出的项目、人物、决策信息合并入知识库，并判断是否需要向用户澄清。
用户感知不到这个过程的存在，但有需要澄清时会在 Todo 或 Notes 页面看到 Copilot 卡片。

**Why this priority**: 这是知识库持续更新的核心途径，也是 Copilot 卡片功能的上游依赖。
前端 Todo 和 Notes 页面均调用此能力，必须首先交付。

**Independent Test**: 调用 `process_task` 传入一条 Task，验证知识库中相应内容被更新；
若内容含矛盾或新实体，验证返回的 `CopilotQuestion` 不为空且内容为中文。

**Acceptance Scenarios**:

1. **Given** 用户新建 Task「项目 A 上线」，**When** `process_task` 被调用，
   **Then** 知识库中「项目 A」的状态被更新，若该项目已有「进行中」记录，
   系统返回一个中文 Copilot 提问（如「项目 A 是否已完成？」），否则返回空。
2. **Given** 用户保存 Note「和小王开了需求会，决定延迟上线」，
   **When** `process_note` 被调用，**Then** 知识库中「小王」作为实体被记录，
   「延迟上线」作为决策被记录，若无矛盾则返回空。
3. **Given** 同一条 Note 在 3 秒内触发第二次保存，**When** `process_note` 被调用，
   **Then** 系统节流，不重复执行 AI 分析，返回与上次相同的结果或空。
4. **Given** 调用 `process_task` 或 `process_note`，**When** AI 分析完成，
   **Then** 所有返回的文字内容（question、context）均为中文。

---

### User Story 2 — 定期知识库整合（Lint 周期）(Priority: P1)

系统在满足触发条件时（累积 10 条新内容，或距上次 Lint 超过 24 小时且有新内容）
自动执行 Lint，对知识库做全量分析，生成矛盾点和待确认问题列表，
封装为 LintSession 推送给 Mira Ask 页面。
用户在 Mira Ask 页面的「Mira 的问题」收到新会话。

**Why this priority**: Lint 是知识库保持一致性的核心机制，也是 Mira Ask 页面内容的唯一来源。

**Independent Test**: 积累 10 条新 Task/Note 后，触发 `run_lint`，验证返回的
`LintSession` 包含至少 1 个中文问题，会话状态为「未处理」，可被 `get_lint_sessions` 查询到。

**Acceptance Scenarios**:

1. **Given** 自上次 Lint 起累积了 10 条新 Tasks/Notes，**When** 系统自动触发 Lint，
   **Then** `run_lint` 执行，返回一个 `LintSession`，包含 AI 生成的问题列表，
   所有问题文字为中文。
2. **Given** 距上次 Lint 已超过 24 小时且有新内容，**When** 系统触发 Lint，
   **Then** 行为同上。
3. **Given** 有两个满足条件的触发点同时出现（10 条 + 24 小时都达到），
   **When** 系统检查触发条件，**Then** 只执行一次 Lint，不重复触发。
4. **Given** `run_lint` 被手动调用（即使未满足自动触发条件），**When** 执行，
   **Then** 正常运行并返回 LintSession，不因条件未满足而拒绝。
5. **Given** `run_lint` 执行完成，**When** 前端调用 `get_lint_sessions`，
   **Then** 新生成的 LintSession 出现在返回列表的未处理区域。

---

### User Story 3 — 用户回答 Lint 问题，知识库同步更新 (Priority: P2)

用户在 Mira Ask 页面回答或跳过 Lint 问题时，系统将回答内容整合进知识库，
或将跳过的问题标记为已忽略。会话内所有问题处理完后，会话状态变为已处理。

**Why this priority**: 用户的回答是知识库修正的重要来源，但 Lint 执行本身（US2）
可以先独立交付和验证。

**Independent Test**: 调用 `answer_lint_question` 传入有效回答，验证对应知识库条目被更新；
调用 `skip_lint_question`，验证问题状态变为「已跳过」，知识库不被修改。

**Acceptance Scenarios**:

1. **Given** LintSession 含 3 个问题，**When** 用户回答第一个问题（非空文字），
   调用 `answer_lint_question`，**Then** 知识库中对应矛盾点被更新为用户的回答，
   该问题标记为「已回答」。
2. **Given** 用户调用 `skip_lint_question`，**Then** 该问题标记为「已跳过」，
   知识库中对应条目不变。
3. **Given** 会话内所有问题均已处理（回答或跳过），**When** 最后一个问题处理完，
   **Then** 会话状态自动切换为「已处理」，可被 `get_lint_sessions` 查询到最新状态。

---

### User Story 4 — Ask Mira 问答查询（为前端提供智能回答）(Priority: P2)

前端 Ask Mira 页面调用 `ask_mira`，传入对话历史和时间范围，系统组装知识库上下文
和对应时间段的 Tasks/Notes，调用 AI 生成回答，回答附带来源标注，返回给前端。

**Why this priority**: Ask Mira 的问答能力和 Lint 能力解耦，可独立交付；
但依赖知识库已有内容（US1 先行）。

**Independent Test**: 调用 `ask_mira` 传入一个问题和「today」时间范围，
验证返回字符串为中文，且包含可识别的来源标注（如「来源：XXX」）或「无相关记录」。

**Acceptance Scenarios**:

1. **Given** 用户问「今天做了什么」且时间范围为「today」，**When** `ask_mira` 执行，
   **Then** 系统将今日 Tasks 和 Notes 及知识库 Schema 注入 system prompt，
   返回中文回答，包含对今日内容的摘要。
2. **Given** 知识库中没有匹配时间范围的内容，**When** `ask_mira` 执行，
   **Then** 返回中文说明「该时间段没有相关记录」，不捏造内容。
3. **Given** 回答引用了具体的 Task 或 Note，**Then** 回答中包含来源标注
   （来源信息从 system prompt 中的上下文提取，由 AI 在回答中体现）。
4. **Given** `ask_mira` 接收多轮对话历史，**When** 执行，
   **Then** 对话历史完整传入 AI，AI 回答与上下文连贯，不忽略历史消息。

---

### Edge Cases

- `process_task` 或 `process_note` 调用时 AI 服务不可用（API Key 无效或网络异常），
  MUST 返回错误，知识库不被修改，不崩溃。
- `run_lint` 执行时知识库为空（无任何 Tasks 或 Notes），MUST 返回空问题列表的
  LintSession，不报错。
- 两次 `run_lint` 同时并发触发时，MUST 确保只有一次实际执行（加锁或队列机制）。
- `answer_lint_question` 传入的 session_id 或 question_id 不存在时，MUST 返回错误，
  不静默失败。
- `ask_mira` 的对话历史极长（超过 50 条消息）时，MUST 截断历史以适应 AI 上下文窗口，
  保留最近消息，不崩溃。

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 系统 MUST 暴露 `process_task(task)` 接口：接收一条 Task，
  分析内容并更新知识库，返回 `Option<CopilotQuestion>`（中文内容）或空。
- **FR-002**: 系统 MUST 暴露 `process_note(note)` 接口：接收一条 Note，
  逻辑同上，且对同一 Note 在 3 秒内的重复调用实施节流（不重复执行 AI 分析）。
- **FR-003**: `CopilotQuestion` 返回值 MUST 包含三个字段：问题文字（`question`，中文）、
  触发上下文（`context`，原始内容摘要）、来源 ID（`source_id`，对应 task 或 note 的 ID）。
- **FR-004**: 系统 MUST 维护一个结构化知识库（WikiSchema），包含：识别出的项目列表、
  实体列表（人物/工具/概念）、决策列表、矛盾点列表、待 Lint 问题列表。
- **FR-005**: 系统 MUST 暴露 `run_lint()` 接口：对知识库做全量分析，
  生成矛盾点和澄清问题，返回 `LintSession`（含问题列表，问题文字为中文）。
- **FR-006**: 系统 MUST 在以下任意条件满足时自动触发 `run_lint`：
  （a）自上次 Lint 起累积了 10 条新 Tasks 或 Notes；
  （b）距上次 Lint 超过 24 小时且有新内容。两个条件满足其一即触发，并发触发时只执行一次。
- **FR-007**: 系统 MUST 暴露 `get_lint_sessions()` 接口：返回所有 LintSession 列表，
  含状态（未处理 / 已处理）和各问题的处理状态。
- **FR-008**: 系统 MUST 暴露 `answer_lint_question(session_id, question_id, answer)` 接口：
  将用户回答整合入知识库，将对应问题标记为「已回答」。
  传入不存在的 ID 时 MUST 返回明确错误。
- **FR-009**: 系统 MUST 暴露 `skip_lint_question(session_id, question_id)` 接口：
  将对应问题标记为「已跳过」，不修改知识库内容。
  传入不存在的 ID 时 MUST 返回明确错误。
- **FR-010**: 当 LintSession 内所有问题均已回答或跳过时，系统 MUST 自动将该会话
  状态切换为「已处理」。
- **FR-011**: 系统 MUST 暴露 `get_wiki_schema()` 接口：返回当前 WikiSchema 的完整快照，
  供前端 Stats 页面使用。
- **FR-012**: 系统 MUST 暴露 `ask_mira(messages, time_range)` 接口：
  接收对话历史和时间范围（`today` / `this_week` / `this_month` / `all`），
  组装包含知识库 Schema 和对应时段 Tasks/Notes 的 system prompt，
  调用 AI 生成回答并返回。
- **FR-013**: 所有 AI 生成的输出（Copilot 提问、Lint 问题、ask_mira 回答）
  MUST 使用中文；system prompt 中 MUST 包含「请用中文回答」的明确指令。
- **FR-014**: 任何接口调用时若 AI 服务不可用，MUST 返回结构化错误，
  不修改知识库，不崩溃。
- **FR-015**: 知识库数据 MUST 持久化到本地存储，应用重启后数据完整恢复。

### Key Entities

- **WikiSchema（知识库 Schema）**: 知识库的根结构，包含 projects、entities、
  decisions、contradictions、pending_lint 五类列表。
- **Project（项目）**: 识别出的工作项目，包含名称、当前状态和相关 Task/Note 引用。
- **Entity（实体）**: 识别出的人物、工具或概念，包含名称、类型和出现次数。
- **Decision（决策）**: 识别出的结论或决定，包含内容摘要、来源引用和记录时间。
- **LintSession（Lint 会话）**: 一次 Lint 产生的问题批次，包含会话 ID、创建时间、
  状态（未处理 / 已处理）和问题列表。
- **LintItem / Question（Lint 问题）**: Lint 会话内的单条 AI 提问，包含问题文字、
  处理状态（待处理 / 已回答 / 已跳过）和用户回答（已回答时有值）。
- **CopilotQuestion（Copilot 提问）**: 实时处理时产生的单次澄清请求，
  包含问题文字、触发上下文和来源 ID。

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: `process_task` 和 `process_note` 的响应时间（含 AI 调用）对用户写入体验
  无感知影响——前端调用为异步非阻塞，用户保存操作即刻返回。
- **SC-002**: `run_lint` 在知识库有内容时 MUST 返回至少 1 条中文问题（如知识库确实
  无矛盾或待确认项，则允许返回 0 条，但不得因代码错误返回空）。
- **SC-003**: 知识库数据在应用重启后 100% 完整恢复，不出现数据丢失。
- **SC-004**: 所有 AI 生成的文本内容中，中文比例达到 100%（不出现英文回答）。
- **SC-005**: Lint 自动触发不出现重复执行——在并发触发场景下，每个触发周期内
  只有一次 `run_lint` 实际完成执行。

## Assumptions

- API Key 由 Rust 侧统一管理，`ask_mira`、`process_task`、`process_note`、`run_lint`
  等接口均从安全存储中读取，不接受前端传入（遵循 Principle VI）。
- 知识库存储格式为结构化 JSON 持久化到本地磁盘，不使用向量存储，
  关键词匹配和结构化查询已足够满足 v1 需求。
- 所有接口均以 Tauri Command 形式暴露给前端，前端通过 `invoke` 调用，
  不存在 HTTP 或其他网络接口（遵循 Principle VII）。
- process_note 的「3 秒节流」以「同一 note_id」为键计时，
  节流期内直接返回上次结果或空，不重新调用 AI。
- `ask_mira` 中当对话历史超出 AI 上下文窗口时，保留最新的消息（从最近向前裁剪），
  具体裁剪阈值在实现阶段根据所用模型确定。
- Lint 自动触发由后台定时器或写入事件计数器驱动，不依赖前端轮询。
- 多用户支持和知识库导出不在本期范围内。
