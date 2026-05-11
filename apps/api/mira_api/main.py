from __future__ import annotations

import hashlib
import json
import uuid
from typing import Literal

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from .config import settings
from .storage import (
    WORKSPACE_DIR,
    classify_note_line,
    connect,
    current_week_key,
    extract_keywords,
    init_db,
    row_to_dict,
    rows_to_dicts,
    utc_now,
    write_report_markdown,
    write_team_summary_markdown,
)

app = FastAPI(title="Mira API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=list(settings.cors_origins),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class TodoCreate(BaseModel):
    member_id: str = "m1"
    content: str = Field(min_length=1)
    summary: str | None = None
    category: str = "Other"
    priority: Literal["low", "normal", "high"] = "normal"
    week_key: str | None = None


class TodoPatch(BaseModel):
    content: str | None = None
    summary: str | None = None
    category: str | None = None
    priority: Literal["low", "normal", "high"] | None = None
    done: bool | None = None


class GenerateReportRequest(BaseModel):
    member_id: str = "m1"
    week_key: str | None = None
    weekly_note: str = ""


class ReportPatch(BaseModel):
    completed: list[str] | None = None
    in_progress: list[str] | None = None
    next_week: list[str] | None = None
    risks: list[str] | None = None


class ArchiveReportRequest(BaseModel):
    report_id: str


class ImportTextRequest(BaseModel):
    member_id: str
    filename: str = "historical-report.md"
    content: str = Field(min_length=1)
    week_key: str | None = None
    archive: bool = True
    language: Literal["en", "zh"] | None = None


class SearchRequest(BaseModel):
    member_id: str = "m1"
    query: str = ""


class TeamSummaryRequest(BaseModel):
    member_ids: list[str]
    weeks: int = Field(default=4, ge=1, le=12)
    language: Literal["en", "zh"] | None = None


@app.on_event("startup")
def on_startup() -> None:
    init_db()


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "workspace": str(WORKSPACE_DIR), "default_language": settings.default_language}


@app.get("/state")
def state() -> dict[str, object]:
    init_db()
    with connect() as conn:
        return {
            "members": rows_to_dicts(conn.execute("SELECT * FROM members ORDER BY is_manager, name").fetchall()),
            "todos": rows_to_dicts(conn.execute("SELECT * FROM todos ORDER BY created_at DESC").fetchall()),
            "reports": rows_to_dicts(conn.execute("SELECT * FROM weekly_reports ORDER BY week_key DESC, updated_at DESC").fetchall()),
            "knowledge": rows_to_dicts(conn.execute("SELECT * FROM knowledge_entries ORDER BY created_at DESC").fetchall()),
            "tags": rows_to_dicts(conn.execute("SELECT * FROM tags ORDER BY count DESC, name").fetchall()),
            "achievements": rows_to_dicts(conn.execute("SELECT * FROM achievement_events ORDER BY badge_name").fetchall()),
        }


@app.post("/todos")
def create_todo(payload: TodoCreate) -> dict[str, object]:
    todo_id = f"td_{uuid.uuid4().hex[:10]}"
    now = utc_now()
    with connect() as conn:
        member = conn.execute("SELECT id FROM members WHERE id = ?", (payload.member_id,)).fetchone()
        if not member:
            raise HTTPException(status_code=404, detail="Member not found")
        conn.execute(
            """
            INSERT INTO todos (id, member_id, content, summary, category, priority, done, week_key, created_at, finished_at)
            VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, NULL)
            """,
            (todo_id, payload.member_id, payload.content, payload.summary, payload.category, payload.priority, payload.week_key or current_week_key(), now),
        )
        return row_to_dict(conn.execute("SELECT * FROM todos WHERE id = ?", (todo_id,)).fetchone())


@app.patch("/todos/{todo_id}")
def update_todo(todo_id: str, payload: TodoPatch) -> dict[str, object]:
    patch = payload.model_dump(exclude_unset=True)
    if not patch:
        raise HTTPException(status_code=400, detail="Empty patch")
    with connect() as conn:
        existing = conn.execute("SELECT * FROM todos WHERE id = ?", (todo_id,)).fetchone()
        if not existing:
            raise HTTPException(status_code=404, detail="Todo not found")
        fields: list[str] = []
        values: list[object] = []
        for key, value in patch.items():
            column = "done" if key == "done" else key
            fields.append(f"{column} = ?")
            values.append(int(value) if key == "done" else value)
        if payload.done is True and not existing["finished_at"]:
            fields.append("finished_at = ?")
            values.append(utc_now())
        if payload.done is False:
            fields.append("finished_at = NULL")
        values.append(todo_id)
        conn.execute(f"UPDATE todos SET {', '.join(fields)} WHERE id = ?", values)
        return row_to_dict(conn.execute("SELECT * FROM todos WHERE id = ?", (todo_id,)).fetchone())


@app.delete("/todos/{todo_id}")
def delete_todo(todo_id: str) -> dict[str, bool]:
    with connect() as conn:
        conn.execute("DELETE FROM todos WHERE id = ?", (todo_id,))
    return {"ok": True}


@app.post("/reports/generate")
def generate_report(payload: GenerateReportRequest) -> dict[str, object]:
    week_key = payload.week_key or current_week_key()
    with connect() as conn:
        todos = rows_to_dicts(
            conn.execute(
                "SELECT * FROM todos WHERE member_id = ? AND week_key = ? ORDER BY created_at",
                (payload.member_id, week_key),
            ).fetchall()
        )
        completed = [f"{todo['content']} ({todo['summary']})" if todo.get("summary") else todo["content"] for todo in todos if todo["done"]]
        in_progress = [todo["content"] for todo in todos if not todo["done"]]
        next_week: list[str] = []
        risks: list[str] = []
        for raw_line in payload.weekly_note.replace(";", "\n").splitlines():
            line = raw_line.strip("- ").strip()
            if not line:
                continue
            bucket = classify_note_line(line)
            if bucket == "risk":
                risks.append(line)
            elif bucket == "next":
                next_week.append(line)
            elif line not in completed:
                completed.append(line)
        if not next_week:
            labels = backend_labels(settings.default_language)
            next_week = [labels["continue_in_progress"], labels["review_priorities"]]
        if len(in_progress) >= 3:
            risks.append(backend_labels(settings.default_language)["unfinished_risk"].format(count=len(in_progress)))

        report_id = f"rp_{uuid.uuid4().hex[:10]}"
        now = utc_now()
        conn.execute(
            "DELETE FROM weekly_reports WHERE member_id = ? AND week_key = ? AND archived = 0",
            (payload.member_id, week_key),
        )
        conn.execute(
            """
            INSERT INTO weekly_reports
              (id, member_id, week_key, completed, in_progress, next_week, risks, archived, markdown_path, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, 0, NULL, ?, ?)
            """,
            (
                report_id,
                payload.member_id,
                week_key,
                json.dumps(completed),
                json.dumps(in_progress),
                json.dumps(next_week),
                json.dumps(risks),
                now,
                now,
            ),
        )
        return row_to_dict(conn.execute("SELECT * FROM weekly_reports WHERE id = ?", (report_id,)).fetchone())


@app.patch("/reports/{report_id}")
def update_report(report_id: str, payload: ReportPatch) -> dict[str, object]:
    patch = payload.model_dump(exclude_unset=True)
    if not patch:
        raise HTTPException(status_code=400, detail="Empty patch")
    with connect() as conn:
        report = conn.execute("SELECT * FROM weekly_reports WHERE id = ?", (report_id,)).fetchone()
        if not report:
            raise HTTPException(status_code=404, detail="Report not found")
        if report["archived"]:
            raise HTTPException(status_code=409, detail="Archived reports are immutable; generate a new draft")

        fields: list[str] = []
        values: list[object] = []
        for key, value in patch.items():
            fields.append(f"{key} = ?")
            values.append(json.dumps(clean_items(value or [])))
        fields.append("updated_at = ?")
        values.append(utc_now())
        values.append(report_id)
        conn.execute(f"UPDATE weekly_reports SET {', '.join(fields)} WHERE id = ?", values)
        return row_to_dict(conn.execute("SELECT * FROM weekly_reports WHERE id = ?", (report_id,)).fetchone())


@app.post("/reports/archive")
def archive_report(payload: ArchiveReportRequest) -> dict[str, object]:
    with connect() as conn:
        report = row_to_dict(conn.execute("SELECT * FROM weekly_reports WHERE id = ?", (payload.report_id,)).fetchone())
        if not report:
            raise HTTPException(status_code=404, detail="Report not found")
        markdown_path, entry_count = archive_report_record(conn, report)
        return {
            "report": row_to_dict(conn.execute("SELECT * FROM weekly_reports WHERE id = ?", (report["id"],)).fetchone()),
            "knowledge_entries": entry_count,
            "markdown_path": markdown_path,
        }


@app.post("/imports/text")
def import_text(payload: ImportTextRequest) -> dict[str, object]:
    return import_content(
        member_id=payload.member_id,
        filename=payload.filename,
        content=payload.content,
        week_key=payload.week_key,
        archive=payload.archive,
        language=payload.language or settings.default_language,
    )


@app.post("/imports/file")
async def import_file(
    member_id: str = Form(...),
    week_key: str | None = Form(default=None),
    archive: bool = Form(default=True),
    language: Literal["en", "zh"] | None = Form(default=None),
    file: UploadFile = File(...),
) -> dict[str, object]:
    filename = safe_filename(file.filename or "upload.md")
    if not filename.lower().endswith((".md", ".txt")):
        raise HTTPException(status_code=415, detail="Only .md and .txt uploads are supported in this slice")
    raw = await file.read(settings.max_upload_bytes + 1)
    if len(raw) > settings.max_upload_bytes:
        raise HTTPException(status_code=413, detail=f"Upload exceeds {settings.max_upload_bytes} bytes")
    try:
        content = raw.decode("utf-8")
    except UnicodeDecodeError as exc:
        raise HTTPException(status_code=400, detail="Upload must be UTF-8 text") from exc
    return import_content(
        member_id=member_id,
        filename=filename,
        content=content,
        week_key=week_key,
        archive=archive,
        language=language or settings.default_language,
    )


def import_content(member_id: str, filename: str, content: str, week_key: str | None, archive: bool, language: str) -> dict[str, object]:
    report_id = f"rp_{uuid.uuid4().hex[:10]}"
    import_id = f"imp_{uuid.uuid4().hex[:10]}"
    now = utc_now()
    content_hash = hashlib.sha256(content.encode("utf-8")).hexdigest()
    normalized_filename = safe_filename(filename)
    with connect() as conn:
        member = conn.execute("SELECT id FROM members WHERE id = ?", (member_id,)).fetchone()
        if not member:
            raise HTTPException(status_code=404, detail="Member not found")
        existing = conn.execute(
            "SELECT * FROM import_batches WHERE member_id = ? AND filename = ? AND content_hash = ?",
            (member_id, normalized_filename, content_hash),
        ).fetchone()
        if existing:
            raise HTTPException(status_code=409, detail="This file content has already been imported for the member")
        report_sections = parse_report_text(content, language)
        target_week = week_key or current_week_key()
        conn.execute(
            "DELETE FROM weekly_reports WHERE member_id = ? AND week_key = ? AND archived = 0",
            (member_id, target_week),
        )
        conn.execute(
            """
            INSERT INTO weekly_reports
              (id, member_id, week_key, completed, in_progress, next_week, risks, archived, markdown_path, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, 0, NULL, ?, ?)
            """,
            (
                report_id,
                member_id,
                target_week,
                json.dumps(report_sections["completed"]),
                json.dumps(report_sections["in_progress"]),
                json.dumps(report_sections["next_week"]),
                json.dumps(report_sections["risks"]),
                now,
                now,
            ),
        )
        report = row_to_dict(conn.execute("SELECT * FROM weekly_reports WHERE id = ?", (report_id,)).fetchone())
        if not report:
            raise HTTPException(status_code=500, detail="Import failed")
        if archive:
            markdown_path, entry_count = archive_report_record(conn, report)
        else:
            markdown_path, entry_count = "", 0
        conn.execute(
            "INSERT INTO import_batches (id, member_id, filename, content_hash, report_id, markdown_path, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (import_id, member_id, normalized_filename, content_hash, report_id, markdown_path, now),
        )
        return {
            "id": import_id,
            "report": row_to_dict(conn.execute("SELECT * FROM weekly_reports WHERE id = ?", (report_id,)).fetchone()),
            "knowledge_entries": entry_count,
            "markdown_path": markdown_path,
        }


@app.post("/kb/search")
def search_kb(payload: SearchRequest) -> list[dict[str, object]]:
    query = f"%{payload.query.lower()}%"
    with connect() as conn:
        if payload.query:
            rows = conn.execute(
                "SELECT * FROM knowledge_entries WHERE member_id = ? AND lower(text) LIKE ? ORDER BY week_key DESC, created_at DESC",
                (payload.member_id, query),
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT * FROM knowledge_entries WHERE member_id = ? ORDER BY week_key DESC, created_at DESC",
                (payload.member_id,),
            ).fetchall()
        return rows_to_dicts(rows)


@app.post("/team-summary/generate")
def generate_team_summary(payload: TeamSummaryRequest) -> dict[str, object]:
    if not payload.member_ids:
        raise HTTPException(status_code=400, detail="Select at least one member")
    placeholders = ",".join("?" for _ in payload.member_ids)
    with connect() as conn:
        entries = rows_to_dicts(
            conn.execute(
                f"SELECT * FROM knowledge_entries WHERE member_id IN ({placeholders}) ORDER BY week_key DESC, created_at DESC",
                payload.member_ids,
            ).fetchall()
        )
        members = rows_to_dicts(conn.execute(f"SELECT * FROM members WHERE id IN ({placeholders})", payload.member_ids).fetchall())
        member_names = {member["id"]: member["name"] for member in members}
        texts = [entry["text"] for entry in entries]
        keyword_counts = extract_keywords(texts)
        language = payload.language or settings.default_language
        labels = backend_labels(language)
        progress_lines = [labels["related_entries"].format(name=name, count=count) for name, count in sorted(keyword_counts.items(), key=lambda item: item[1], reverse=True)[:8]]
        risk_lines = [
            f"- {member_names.get(entry['member_id'], entry['member_id'])}: {entry['text']}"
            for entry in entries
            if any(marker in entry["text"].lower() for marker in ("risk", "blocked", "blocker", "风险", "阻塞"))
        ]
        highlight_counts: dict[str, int] = {}
        for entry in entries:
            highlight_counts[entry["member_id"]] = highlight_counts.get(entry["member_id"], 0) + 1
        highlights = [
            labels["knowledge_entries"].format(name=member_names.get(member_id, member_id), count=count)
            for member_id, count in sorted(highlight_counts.items(), key=lambda item: item[1], reverse=True)[:3]
        ]
        markdown = "\n".join(
            [
                f"## {labels['core_progress']}",
                *(progress_lines or [labels["no_progress"]]),
                "",
                f"## {labels['shared_risks']}",
                *(risk_lines or [labels["no_risks"]]),
                "",
                f"## {labels['highlight_members']}",
                *(highlights or [labels["no_highlights"]]),
                "",
                f"## {labels['manager_recommendations']}",
                labels["review_tags"],
                labels["archive_reminder"],
            ]
        )
        summary_id = f"ts_{uuid.uuid4().hex[:10]}"
        range_label = f"last-{payload.weeks}-weeks"
        markdown_path = write_team_summary_markdown(summary_id, payload.member_ids, range_label, markdown)
        now = utc_now()
        conn.execute(
            "INSERT INTO team_summaries (id, member_ids, range_label, markdown, markdown_path, created_at) VALUES (?, ?, ?, ?, ?, ?)",
            (summary_id, json.dumps(payload.member_ids), range_label, markdown, markdown_path, now),
        )
        return {"id": summary_id, "markdown": markdown, "markdown_path": markdown_path, "created_at": now}


def clean_items(items: list[str]) -> list[str]:
    return [item.strip() for item in items if item and item.strip()]


def parse_report_text(content: str, language: str = "en") -> dict[str, list[str]]:
    sections = {"completed": [], "in_progress": [], "next_week": [], "risks": []}
    current: str | None = None
    heading_map = {
        "completed": "completed",
        "done": "completed",
        "progress": "completed",
        "本周完成": "completed",
        "完成": "completed",
        "进展": "completed",
        "in progress": "in_progress",
        "blocked": "in_progress",
        "blocker": "in_progress",
        "进行中": "in_progress",
        "阻塞": "in_progress",
        "next": "next_week",
        "plan": "next_week",
        "下周": "next_week",
        "计划": "next_week",
        "risk": "risks",
        "help": "risks",
        "风险": "risks",
        "求助": "risks",
    }
    for raw_line in content.splitlines():
        line = raw_line.strip()
        if not line or line in {"---", "```"} or line.startswith(("id:", "member_id:", "source_type:", "created_at:", "updated_at:")):
            continue
        if line.startswith("#"):
            normalized = line.strip("# ").lower()
            current = next((target for marker, target in heading_map.items() if marker in normalized), current)
            continue
        item = line.lstrip("-*0123456789. ").strip()
        if not item:
            continue
        bucket = current or classify_note_line(item)
        if bucket == "risk":
            bucket = "risks"
        if bucket == "next":
            bucket = "next_week"
        if bucket not in sections:
            bucket = "completed"
        sections[bucket].append(item)
    if not any(sections.values()):
        sections["completed"] = clean_items(content.splitlines())
    if not sections["next_week"]:
        sections["next_week"] = [backend_labels(language)["import_next_week"]]
    return {key: clean_items(value) for key, value in sections.items()}


def safe_filename(filename: str) -> str:
    cleaned = filename.replace("\\", "/").split("/")[-1].strip()
    cleaned = "".join(char for char in cleaned if char.isalnum() or char in {".", "-", "_", " "}).strip()
    return cleaned or "upload.md"


def backend_labels(language: str) -> dict[str, str]:
    if language == "zh":
        return {
            "import_next_week": "回顾导入历史并制定下一周计划",
            "related_entries": "- {name}：{count} 条相关记录",
            "knowledge_entries": "- {name}：{count} 条知识记录",
            "core_progress": "核心进展",
            "shared_risks": "共同风险与求助",
            "highlight_members": "高亮成员",
            "manager_recommendations": "管理建议",
            "no_progress": "- 暂无已归档进展",
            "no_risks": "- 未检测到共同风险",
            "no_highlights": "- 暂无成员亮点",
            "review_tags": "- 下次同步前检查沉睡或稀疏标签。",
            "archive_reminder": "- 生成正式总结前，请提醒成员先归档周报。",
            "continue_in_progress": "继续推进进行中的任务",
            "review_priorities": "复盘下周任务优先级",
            "unfinished_risk": "{count} 个未完成事项需要优先级复盘。",
        }
    return {
        "import_next_week": "Review imported history and set the next weekly plan",
        "related_entries": "- {name}: {count} related entries",
        "knowledge_entries": "- {name}: {count} knowledge entries",
        "core_progress": "Core Progress",
        "shared_risks": "Shared Risks & Help Requests",
        "highlight_members": "Highlight Members",
        "manager_recommendations": "Manager Recommendations",
        "no_progress": "- No archived progress yet",
        "no_risks": "- No shared risks detected",
        "no_highlights": "- No member highlights yet",
        "review_tags": "- Review sleeping or sparse tags before the next sync.",
        "archive_reminder": "- Ask members to archive weekly reports before generating formal summaries.",
        "continue_in_progress": "Continue advancing in-progress tasks",
        "review_priorities": "Review priorities for next week",
        "unfinished_risk": "{count} unfinished items need priority review.",
    }


def archive_report_record(conn, report: dict[str, object]) -> tuple[str, int]:
    member = row_to_dict(conn.execute("SELECT * FROM members WHERE id = ?", (report["member_id"],)).fetchone())
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    markdown_path = write_report_markdown(member, report)
    conn.execute("UPDATE weekly_reports SET archived = 1, markdown_path = ?, updated_at = ? WHERE id = ?", (markdown_path, utc_now(), report["id"]))
    conn.execute("DELETE FROM knowledge_entries WHERE report_id = ?", (report["id"],))
    entries: list[tuple[object, ...]] = []
    for source, values in (
        ("completed", report["completed"]),
        ("in_progress", report["in_progress"]),
        ("next_week", report["next_week"]),
        ("risks", report["risks"]),
    ):
        for text in values:
            entries.append((f"kb_{uuid.uuid4().hex[:10]}", report["member_id"], report["id"], report["week_key"], text, source, markdown_path, utc_now()))
    conn.executemany(
        """
        INSERT INTO knowledge_entries (id, member_id, report_id, week_key, text, source, markdown_path, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        entries,
    )
    refresh_tags(conn, str(report["member_id"]))
    refresh_achievements(conn, str(report["member_id"]))
    return markdown_path, len(entries)


def refresh_tags(conn, member_id: str) -> None:
    entries = rows_to_dicts(conn.execute("SELECT * FROM knowledge_entries WHERE member_id = ?", (member_id,)).fetchall())
    counts = extract_keywords([entry["text"] for entry in entries])
    conn.execute("DELETE FROM tags WHERE member_id = ?", (member_id,))
    for name, count in counts.items():
        last_week = max(entry["week_key"] for entry in entries if name.lower() in entry["text"].lower())
        conn.execute(
            """
            INSERT INTO tags (id, member_id, name, count, last_week, sleeping, updated_at)
            VALUES (?, ?, ?, ?, ?, 0, ?)
            """,
            (f"tag_{uuid.uuid4().hex[:10]}", member_id, name, count, last_week, utc_now()),
        )


def refresh_achievements(conn, member_id: str) -> None:
    rules = [
        ("meeting_notes", "Meeting Notes Pro", "Meeting Notes", 5),
        ("proposal_star", "Proposal Star", "Proposal", 3),
        ("code_review", "Code Review Expert", "Code Review", 3),
        ("quality", "Quality Gatekeeper", "Unit Testing", 3),
        ("architect", "Architect Starter", "Architecture Design", 2),
    ]
    entries = rows_to_dicts(conn.execute("SELECT * FROM knowledge_entries WHERE member_id = ?", (member_id,)).fetchall())
    all_text = "\n".join(entry["text"] for entry in entries)
    for badge_id, badge_name, keyword, threshold in rules:
        progress = all_text.lower().count(keyword.lower())
        trace = [entry["text"] for entry in entries if keyword.lower() in entry["text"].lower()][:3]
        conn.execute(
            """
            INSERT INTO achievement_events
              (id, member_id, badge_id, badge_name, progress, threshold, unlocked, trace, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(member_id, badge_id) DO UPDATE SET
              progress = excluded.progress,
              unlocked = excluded.unlocked,
              trace = excluded.trace,
              updated_at = excluded.updated_at
            """,
            (
                f"ach_{uuid.uuid4().hex[:10]}",
                member_id,
                badge_id,
                badge_name,
                progress,
                threshold,
                int(progress >= threshold),
                json.dumps(trace),
                utc_now(),
            ),
        )
