from __future__ import annotations

import hashlib
import json
import uuid
from contextlib import asynccontextmanager
from typing import Literal

from fastapi import FastAPI, File, Form, HTTPException, UploadFile, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.orm import Session
from starlette.middleware.base import BaseHTTPMiddleware

from .config import settings
from .context import set_workspace_id, get_workspace_id
from .dependencies import get_current_user_optional
from .database import get_db_dependency, initialize_database
from .models import (
    Workspace, Member, Todo, WeeklyReport, KnowledgeEntry, Tag,
    AchievementEvent, TeamSummary, ImportBatch, UserWorkspace,
    model_to_dict
)
from .storage import (
    WORKSPACE_DIR,
    classify_note_line,
    current_week_key,
    extract_keywords,
    utc_now,
    write_report_markdown,
    write_team_summary_markdown,
)
from .auth import router as auth_router
from .workspaces import router as workspaces_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    initialize_database()
    yield


app = FastAPI(title="Mira API", version="0.1.0", lifespan=lifespan)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=list(settings.cors_origins),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Workspace context middleware
class WorkspaceMiddleware(BaseHTTPMiddleware):
    """Middleware to set workspace context for each request."""

    async def dispatch(self, request: Request, call_next):
        # Get current user (if authenticated)
        db = next(get_db_dependency())
        try:
            user = await get_current_user_optional(request, db)

            if user:
                # Get user's first workspace (in future: allow selection via header)
                user_workspace = db.query(UserWorkspace).filter(
                    UserWorkspace.user_id == user["id"]
                ).first()

                if user_workspace:
                    set_workspace_id(user_workspace.workspace_id)
                else:
                    # User has no workspace - use default
                    set_workspace_id("ws_default")
            else:
                # Unauthenticated request - use default workspace for backward compat
                set_workspace_id("ws_default")

            response = await call_next(request)
            return response
        finally:
            db.close()


app.add_middleware(WorkspaceMiddleware)


# Include routers
app.include_router(auth_router)
app.include_router(workspaces_router)


# Pydantic models
class TodoCreate(BaseModel):
    member_id: str = "m1"
    content: str = Field(min_length=1)
    summary: str | None = None
    category: str = "Other"
    priority: Literal["low", "normal", "high", "urgent"] = "normal"
    week_key: str | None = None


class TodoPatch(BaseModel):
    content: str | None = None
    summary: str | None = None
    category: str | None = None
    priority: Literal["low", "normal", "high", "urgent"] | None = None
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


# Health endpoint
@app.get("/health")
def health(db: Session = Depends(get_db_dependency)) -> dict[str, str]:
    try:
        # Test database connection
        db.execute(text("SELECT 1"))
        db_status = "ok"
    except Exception:
        db_status = "error"

    return {
        "status": "ok" if db_status == "ok" else "degraded",
        "database": db_status,
        "workspace": str(WORKSPACE_DIR),
        "default_language": settings.default_language,
        "version": "0.1.0"
    }


# State endpoint
@app.get("/state")
def state(db: Session = Depends(get_db_dependency)) -> dict[str, object]:
    workspace_id = get_workspace_id()

    # Query all entities with workspace filtering
    members = db.query(Member).filter(
        (Member.workspace_id == workspace_id) | (Member.workspace_id == None)
    ).order_by(Member.is_manager, Member.name).all()

    todos = db.query(Todo).filter(
        (Todo.workspace_id == workspace_id) | (Todo.workspace_id == None)
    ).order_by(Todo.created_at.desc()).all()

    reports = db.query(WeeklyReport).filter(
        (WeeklyReport.workspace_id == workspace_id) | (WeeklyReport.workspace_id == None)
    ).order_by(WeeklyReport.week_key.desc(), WeeklyReport.updated_at.desc()).all()

    knowledge = db.query(KnowledgeEntry).filter(
        (KnowledgeEntry.workspace_id == workspace_id) | (KnowledgeEntry.workspace_id == None)
    ).order_by(KnowledgeEntry.created_at.desc()).all()

    tags = db.query(Tag).filter(
        (Tag.workspace_id == workspace_id) | (Tag.workspace_id == None)
    ).order_by(Tag.count.desc(), Tag.name).all()

    achievements = db.query(AchievementEvent).filter(
        (AchievementEvent.workspace_id == workspace_id) | (AchievementEvent.workspace_id == None)
    ).order_by(AchievementEvent.badge_name).all()

    return {
        "members": [model_to_dict(m) for m in members],
        "todos": [model_to_dict(t) for t in todos],
        "reports": [model_to_dict(r) for r in reports],
        "weekly_reports": [model_to_dict(r) for r in reports],
        "knowledge": [model_to_dict(k) for k in knowledge],
        "tags": [model_to_dict(t) for t in tags],
        "achievements": [model_to_dict(a) for a in achievements],
    }


# Todo endpoints
@app.post("/todos")
def create_todo(payload: TodoCreate, db: Session = Depends(get_db_dependency)) -> dict[str, object]:
    workspace_id = get_workspace_id()

    # Verify member exists
    member = db.query(Member).filter(
        Member.id == payload.member_id,
        (Member.workspace_id == workspace_id) | (Member.workspace_id == None)
    ).first()

    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    # Create todo
    todo = Todo(
        id=f"t_{uuid.uuid4().hex[:10]}",
        workspace_id=workspace_id,
        member_id=payload.member_id,
        content=payload.content,
        summary=payload.summary,
        category=payload.category,
        priority=payload.priority,
        done=0,
        week_key=payload.week_key or current_week_key(),
        created_at=utc_now(),
        finished_at=None
    )

    db.add(todo)
    db.commit()
    db.refresh(todo)

    return model_to_dict(todo)


@app.patch("/todos/{todo_id}")
def update_todo(todo_id: str, payload: TodoPatch, db: Session = Depends(get_db_dependency)) -> dict[str, object]:
    workspace_id = get_workspace_id()

    # Find todo
    todo = db.query(Todo).filter(
        Todo.id == todo_id,
        (Todo.workspace_id == workspace_id) | (Todo.workspace_id == None)
    ).first()

    if not todo:
        raise HTTPException(status_code=404, detail="Todo not found")

    # Apply patch
    patch = payload.model_dump(exclude_unset=True)
    if not patch:
        raise HTTPException(status_code=400, detail="Empty patch")

    for key, value in patch.items():
        if key == "done":
            todo.done = 1 if value else 0
            if value and not todo.finished_at:
                todo.finished_at = utc_now()
            elif not value:
                todo.finished_at = None
        else:
            setattr(todo, key, value)

    db.commit()
    db.refresh(todo)

    return model_to_dict(todo)


@app.delete("/todos/{todo_id}")
def delete_todo(todo_id: str, db: Session = Depends(get_db_dependency)) -> dict[str, bool]:
    workspace_id = get_workspace_id()

    # Find and delete todo
    todo = db.query(Todo).filter(
        Todo.id == todo_id,
        (Todo.workspace_id == workspace_id) | (Todo.workspace_id == None)
    ).first()

    if not todo:
        raise HTTPException(status_code=404, detail="Todo not found")

    db.delete(todo)
    db.commit()

    return {"ok": True}


# Report endpoints
@app.post("/reports/generate")
def generate_report(payload: GenerateReportRequest, db: Session = Depends(get_db_dependency)) -> dict[str, object]:
    workspace_id = get_workspace_id()
    week_key = payload.week_key or current_week_key()

    # Get todos for the week
    todos = db.query(Todo).filter(
        Todo.member_id == payload.member_id,
        Todo.week_key == week_key,
        (Todo.workspace_id == workspace_id) | (Todo.workspace_id == None)
    ).order_by(Todo.created_at).all()

    # Build report sections
    completed = []
    in_progress = []

    for todo in todos:
        if todo.done:
            text = f"{todo.content} ({todo.summary})" if todo.summary else todo.content
            completed.append(text)
        else:
            in_progress.append(todo.content)

    # Process weekly note
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

    # Add defaults
    if not next_week:
        labels = backend_labels(settings.default_language)
        next_week = [labels["continue_in_progress"], labels["review_priorities"]]

    if len(in_progress) >= 3:
        risks.append(
            backend_labels(settings.default_language)["unfinished_risk"].format(count=len(in_progress))
        )

    # Delete existing draft report for this member/week
    db.query(WeeklyReport).filter(
        WeeklyReport.member_id == payload.member_id,
        WeeklyReport.week_key == week_key,
        WeeklyReport.archived == 0,
        (WeeklyReport.workspace_id == workspace_id) | (WeeklyReport.workspace_id == None)
    ).delete()

    # Create new report
    report = WeeklyReport(
        id=f"rp_{uuid.uuid4().hex[:10]}",
        workspace_id=workspace_id,
        member_id=payload.member_id,
        week_key=week_key,
        completed=json.dumps(completed),
        in_progress=json.dumps(in_progress),
        next_week=json.dumps(next_week),
        risks=json.dumps(risks),
        archived=0,
        markdown_path=None,
        created_at=utc_now(),
        updated_at=utc_now()
    )

    db.add(report)
    db.commit()
    db.refresh(report)

    return model_to_dict(report)


@app.patch("/reports/{report_id}")
def update_report(report_id: str, payload: ReportPatch, db: Session = Depends(get_db_dependency)) -> dict[str, object]:
    workspace_id = get_workspace_id()

    # Find report
    report = db.query(WeeklyReport).filter(
        WeeklyReport.id == report_id,
        (WeeklyReport.workspace_id == workspace_id) | (WeeklyReport.workspace_id == None)
    ).first()

    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    if report.archived:
        raise HTTPException(status_code=409, detail="Archived reports are immutable; generate a new draft")

    # Apply patch
    patch = payload.model_dump(exclude_unset=True)
    if not patch:
        raise HTTPException(status_code=400, detail="Empty patch")

    for key, value in patch.items():
        setattr(report, key, json.dumps(clean_items(value or [])))

    report.updated_at = utc_now()

    db.commit()
    db.refresh(report)

    return model_to_dict(report)


@app.post("/reports/archive")
def archive_report(payload: ArchiveReportRequest, db: Session = Depends(get_db_dependency)) -> dict[str, object]:
    workspace_id = get_workspace_id()

    # Find report
    report = db.query(WeeklyReport).filter(
        WeeklyReport.id == payload.report_id,
        (WeeklyReport.workspace_id == workspace_id) | (WeeklyReport.workspace_id == None)
    ).first()

    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    # Archive the report
    markdown_path, entry_count = archive_report_record(db, report)

    return {
        "report": model_to_dict(report),
        "knowledge_entries": entry_count,
        "markdown_path": markdown_path,
    }


# Import endpoints
@app.post("/imports/text")
def import_text(payload: ImportTextRequest, db: Session = Depends(get_db_dependency)) -> dict[str, object]:
    return import_content(
        db=db,
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
    db: Session = Depends(get_db_dependency),
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
        db=db,
        member_id=member_id,
        filename=filename,
        content=content,
        week_key=week_key,
        archive=archive,
        language=language or settings.default_language,
    )


# Knowledge base search
@app.post("/kb/search")
def search_kb(payload: SearchRequest, db: Session = Depends(get_db_dependency)) -> list[dict[str, object]]:
    workspace_id = get_workspace_id()

    query = db.query(KnowledgeEntry).filter(
        KnowledgeEntry.member_id == payload.member_id,
        (KnowledgeEntry.workspace_id == workspace_id) | (KnowledgeEntry.workspace_id == None)
    )

    if payload.query:
        query = query.filter(KnowledgeEntry.text.ilike(f"%{payload.query}%"))

    entries = query.order_by(
        KnowledgeEntry.week_key.desc(),
        KnowledgeEntry.created_at.desc()
    ).all()

    return [model_to_dict(e) for e in entries]


# Team summary
@app.post("/team-summary/generate")
def generate_team_summary(payload: TeamSummaryRequest, db: Session = Depends(get_db_dependency)) -> dict[str, object]:
    workspace_id = get_workspace_id()

    if not payload.member_ids:
        raise HTTPException(status_code=400, detail="Select at least one member")

    # Get knowledge entries for selected members
    entries = db.query(KnowledgeEntry).filter(
        KnowledgeEntry.member_id.in_(payload.member_ids),
        (KnowledgeEntry.workspace_id == workspace_id) | (KnowledgeEntry.workspace_id == None)
    ).order_by(
        KnowledgeEntry.week_key.desc(),
        KnowledgeEntry.created_at.desc()
    ).all()

    # Get member names
    members = db.query(Member).filter(
        Member.id.in_(payload.member_ids),
        (Member.workspace_id == workspace_id) | (Member.workspace_id == None)
    ).all()
    member_names = {m.id: m.name for m in members}

    # Extract keywords
    texts = [e.text for e in entries]
    keyword_counts = extract_keywords(texts)

    # Build summary
    language = payload.language or settings.default_language
    labels = backend_labels(language)

    progress_lines = [
        labels["related_entries"].format(name=name, count=count)
        for name, count in sorted(keyword_counts.items(), key=lambda item: item[1], reverse=True)[:8]
    ]

    risk_lines = [
        f"- {member_names.get(e.member_id, e.member_id)}: {e.text}"
        for e in entries
        if any(marker in e.text.lower() for marker in ("risk", "blocked", "blocker", "风险", "阻塞"))
    ]

    highlight_counts: dict[str, int] = {}
    for e in entries:
        highlight_counts[e.member_id] = highlight_counts.get(e.member_id, 0) + 1

    highlights = [
        labels["knowledge_entries"].format(name=member_names.get(member_id, member_id), count=count)
        for member_id, count in sorted(highlight_counts.items(), key=lambda item: item[1], reverse=True)[:3]
    ]

    markdown = "\n".join([
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
    ])

    # Save team summary
    summary_id = f"ts_{uuid.uuid4().hex[:10]}",
    range_label = f"last-{payload.weeks}-weeks"
    markdown_path = write_team_summary_markdown(summary_id, payload.member_ids, range_label, markdown)

    summary = TeamSummary(
        id=summary_id,
        workspace_id=workspace_id,
        member_ids=json.dumps(payload.member_ids),
        range_label=range_label,
        markdown=markdown,
        markdown_path=markdown_path,
        created_at=utc_now()
    )

    db.add(summary)
    db.commit()

    return {
        "id": summary_id,
        "markdown": markdown,
        "markdown_path": markdown_path,
        "created_at": summary.created_at
    }


# Helper functions
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
        if not line or line in {"---", "```"} or line.startswith((
            "id:", "member_id:", "source_type:", "created_at:", "updated_at:"
        )):
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


def archive_report_record(db: Session, report: WeeklyReport) -> tuple[str, int]:
    # Get member
    member = db.query(Member).filter(Member.id == report.member_id).first()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    # Convert report to dict for markdown generation
    report_dict = model_to_dict(report)
    member_dict = model_to_dict(member)

    # Write markdown
    markdown_path = write_report_markdown(member_dict, report_dict)

    # Update report
    report.archived = 1
    report.markdown_path = markdown_path
    report.updated_at = utc_now()

    # Delete existing knowledge entries for this report
    db.query(KnowledgeEntry).filter(KnowledgeEntry.report_id == report.id).delete()

    # Create knowledge entries
    entries: list[KnowledgeEntry] = []
    workspace_id = get_workspace_id()

    for source, values in [
        ("completed", json.loads(report.completed) if isinstance(report.completed, str) else report.completed),
        ("in_progress", json.loads(report.in_progress) if isinstance(report.in_progress, str) else report.in_progress),
        ("next_week", json.loads(report.next_week) if isinstance(report.next_week, str) else report.next_week),
        ("risks", json.loads(report.risks) if isinstance(report.risks, str) else report.risks),
    ]:
        for text in values:
            entry = KnowledgeEntry(
                id=f"kb_{uuid.uuid4().hex[:10]}",
                workspace_id=workspace_id,
                member_id=report.member_id,
                report_id=report.id,
                week_key=report.week_key,
                text=text,
                source=source,
                markdown_path=markdown_path,
                created_at=utc_now()
            )
            entries.append(entry)

    db.add_all(entries)

    # Refresh tags and achievements
    refresh_tags(db, report.member_id)
    refresh_achievements(db, report.member_id)

    db.commit()

    return markdown_path, len(entries)


def refresh_tags(db: Session, member_id: str) -> None:
    workspace_id = get_workspace_id()

    # Get all knowledge entries for member
    entries = db.query(KnowledgeEntry).filter(
        KnowledgeEntry.member_id == member_id,
        (KnowledgeEntry.workspace_id == workspace_id) | (KnowledgeEntry.workspace_id == None)
    ).all()

    # Extract keywords
    counts = extract_keywords([e.text for e in entries])

    # Delete existing tags
    db.query(Tag).filter(
        Tag.member_id == member_id,
        (Tag.workspace_id == workspace_id) | (Tag.workspace_id == None)
    ).delete()

    # Create new tags
    for name, count in counts.items():
        last_week = max(
            e.week_key for e in entries if name.lower() in e.text.lower()
        )

        tag = Tag(
            id=f"tag_{uuid.uuid4().hex[:10]}",
            workspace_id=workspace_id,
            member_id=member_id,
            name=name,
            count=count,
            last_week=last_week,
            sleeping=0,
            updated_at=utc_now()
        )
        db.add(tag)

    db.commit()


def refresh_achievements(db: Session, member_id: str) -> None:
    workspace_id = get_workspace_id()

    rules = [
        ("meeting_notes", "Meeting Notes Pro", "Meeting Notes", 5),
        ("proposal_star", "Proposal Star", "Proposal", 3),
        ("code_review", "Code Review Expert", "Code Review", 3),
        ("quality", "Quality Gatekeeper", "Unit Testing", 3),
        ("architect", "Architect Starter", "Architecture Design", 2),
    ]

    # Get all knowledge entries for member
    entries = db.query(KnowledgeEntry).filter(
        KnowledgeEntry.member_id == member_id,
        (KnowledgeEntry.workspace_id == workspace_id) | (KnowledgeEntry.workspace_id == None)
    ).all()

    all_text = "\n".join(e.text for e in entries)

    for badge_id, badge_name, keyword, threshold in rules:
        progress = all_text.lower().count(keyword.lower())
        trace = [e.text for e in entries if keyword.lower() in e.text.lower()][:3]

        # Check if achievement exists
        achievement = db.query(AchievementEvent).filter(
            AchievementEvent.member_id == member_id,
            AchievementEvent.badge_id == badge_id,
            (AchievementEvent.workspace_id == workspace_id) | (AchievementEvent.workspace_id == None)
        ).first()

        if achievement:
            achievement.progress = progress
            achievement.unlocked = 1 if progress >= threshold else 0
            achievement.trace = json.dumps(trace)
            achievement.updated_at = utc_now()
        else:
            achievement = AchievementEvent(
                id=f"ach_{uuid.uuid4().hex[:10]}",
                workspace_id=workspace_id,
                member_id=member_id,
                badge_id=badge_id,
                badge_name=badge_name,
                progress=progress,
                threshold=threshold,
                unlocked=1 if progress >= threshold else 0,
                trace=json.dumps(trace),
                updated_at=utc_now()
            )
            db.add(achievement)

    db.commit()


def import_content(
    db: Session,
    member_id: str,
    filename: str,
    content: str,
    week_key: str | None,
    archive: bool,
    language: str
) -> dict[str, object]:
    workspace_id = get_workspace_id()

    # Verify member exists
    member = db.query(Member).filter(
        Member.id == member_id,
        (Member.workspace_id == workspace_id) | (Member.workspace_id == None)
    ).first()

    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    # Check for duplicate import
    content_hash = hashlib.sha256(content.encode("utf-8")).hexdigest()
    normalized_filename = safe_filename(filename)

    existing = db.query(ImportBatch).filter(
        ImportBatch.member_id == member_id,
        ImportBatch.filename == normalized_filename,
        ImportBatch.content_hash == content_hash,
        (ImportBatch.workspace_id == workspace_id) | (ImportBatch.workspace_id == None)
    ).first()

    if existing:
        raise HTTPException(status_code=409, detail="This file content has already been imported for the member")

    # Parse report text
    report_sections = parse_report_text(content, language)
    target_week = week_key or current_week_key()

    # Delete existing draft report
    db.query(WeeklyReport).filter(
        WeeklyReport.member_id == member_id,
        WeeklyReport.week_key == target_week,
        WeeklyReport.archived == 0,
        (WeeklyReport.workspace_id == workspace_id) | (WeeklyReport.workspace_id == None)
    ).delete()

    # Create report
    report = WeeklyReport(
        id=f"rp_{uuid.uuid4().hex[:10]}",
        workspace_id=workspace_id,
        member_id=member_id,
        week_key=target_week,
        completed=json.dumps(report_sections["completed"]),
        in_progress=json.dumps(report_sections["in_progress"]),
        next_week=json.dumps(report_sections["next_week"]),
        risks=json.dumps(report_sections["risks"]),
        archived=0,
        markdown_path=None,
        created_at=utc_now(),
        updated_at=utc_now()
    )

    db.add(report)
    db.commit()
    db.refresh(report)

    # Archive if requested
    if archive:
        markdown_path, entry_count = archive_report_record(db, report)
    else:
        markdown_path, entry_count = "", 0

    # Create import batch record
    import_batch = ImportBatch(
        id=f"imp_{uuid.uuid4().hex[:10]}",
        workspace_id=workspace_id,
        member_id=member_id,
        filename=normalized_filename,
        content_hash=content_hash,
        report_id=report.id,
        markdown_path=markdown_path,
        created_at=utc_now()
    )

    db.add(import_batch)
    db.commit()

    return {
        "id": import_batch.id,
        "report": model_to_dict(report),
        "knowledge_entries": entry_count,
        "markdown_path": markdown_path,
    }
