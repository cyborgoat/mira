from __future__ import annotations

import json
import re
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from typing import Any, Iterable

from .config import settings
from .context import get_workspace_id

ROOT = settings.repo_root
WORKSPACE_DIR = settings.workspace_dir
DB_PATH = WORKSPACE_DIR / "mira.sqlite3"

KEYWORDS = [
    "Meeting Notes",
    "Requirement Review",
    "Code Review",
    "Proposal",
    "Prototype Design",
    "API Integration",
    "Unit Testing",
    "Performance Optimization",
    "Architecture Design",
    "Client Communication",
    "Tech Sharing",
    "Interviewing",
    "Bug Fix",
    "Documentation Writing",
    "Production Release",
    "Data Analysis",
    "User Research",
    "Competitive Analysis",
    "Solution Design",
]

SEED_MEMBERS = [
    ("m1", "Alex", "Frontend Engineer", "Engineering", 0),
    ("m2", "Blake", "Team Lead", "Engineering", 1),
    ("m3", "Casey", "Backend Engineer", "Engineering", 0),
    ("m4", "Devon", "Product Manager", "Product", 0),
]


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def current_week_key() -> str:
    year, week, _ = datetime.now().isocalendar()
    return f"{year}-W{week:02d}"


@contextmanager
def connect() -> Iterable[sqlite3.Connection]:
    WORKSPACE_DIR.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def row_to_dict(row: sqlite3.Row | None) -> dict[str, Any] | None:
    if row is None:
        return None
    out = dict(row)
    for key in ("completed", "in_progress", "next_week", "risks"):
        if key in out and isinstance(out[key], str):
            out[key] = json.loads(out[key])
    return out


def rows_to_dicts(rows: Iterable[sqlite3.Row]) -> list[dict[str, Any]]:
    return [row_to_dict(row) for row in rows if row is not None]


def init_db() -> None:
    with connect() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS members (
              id TEXT PRIMARY KEY,
              name TEXT NOT NULL,
              role TEXT NOT NULL,
              department TEXT NOT NULL,
              is_manager INTEGER NOT NULL DEFAULT 0,
              created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS todos (
              id TEXT PRIMARY KEY,
              member_id TEXT NOT NULL REFERENCES members(id),
              content TEXT NOT NULL,
              summary TEXT,
              category TEXT NOT NULL DEFAULT 'Other',
              priority TEXT NOT NULL DEFAULT 'normal',
              done INTEGER NOT NULL DEFAULT 0,
              week_key TEXT NOT NULL,
              created_at TEXT NOT NULL,
              finished_at TEXT
            );

            CREATE TABLE IF NOT EXISTS weekly_reports (
              id TEXT PRIMARY KEY,
              member_id TEXT NOT NULL REFERENCES members(id),
              week_key TEXT NOT NULL,
              completed TEXT NOT NULL,
              in_progress TEXT NOT NULL,
              next_week TEXT NOT NULL,
              risks TEXT NOT NULL,
              archived INTEGER NOT NULL DEFAULT 0,
              markdown_path TEXT,
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS knowledge_entries (
              id TEXT PRIMARY KEY,
              member_id TEXT NOT NULL REFERENCES members(id),
              report_id TEXT REFERENCES weekly_reports(id),
              week_key TEXT NOT NULL,
              text TEXT NOT NULL,
              source TEXT NOT NULL,
              markdown_path TEXT,
              created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS tags (
              id TEXT PRIMARY KEY,
              member_id TEXT NOT NULL REFERENCES members(id),
              name TEXT NOT NULL,
              count INTEGER NOT NULL,
              last_week TEXT NOT NULL,
              sleeping INTEGER NOT NULL DEFAULT 0,
              updated_at TEXT NOT NULL,
              UNIQUE(member_id, name)
            );

            CREATE TABLE IF NOT EXISTS achievement_events (
              id TEXT PRIMARY KEY,
              member_id TEXT NOT NULL REFERENCES members(id),
              badge_id TEXT NOT NULL,
              badge_name TEXT NOT NULL,
              progress INTEGER NOT NULL,
              threshold INTEGER NOT NULL,
              unlocked INTEGER NOT NULL,
              trace TEXT NOT NULL,
              updated_at TEXT NOT NULL,
              UNIQUE(member_id, badge_id)
            );

            CREATE TABLE IF NOT EXISTS team_summaries (
              id TEXT PRIMARY KEY,
              member_ids TEXT NOT NULL,
              range_label TEXT NOT NULL,
              markdown TEXT NOT NULL,
              markdown_path TEXT NOT NULL,
              created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS import_batches (
              id TEXT PRIMARY KEY,
              member_id TEXT NOT NULL REFERENCES members(id),
              filename TEXT NOT NULL,
              content_hash TEXT NOT NULL DEFAULT '',
              report_id TEXT NOT NULL REFERENCES weekly_reports(id),
              markdown_path TEXT NOT NULL,
              created_at TEXT NOT NULL
            );

            """
        )
        columns = {row["name"] for row in conn.execute("PRAGMA table_info(import_batches)").fetchall()}
        if "content_hash" not in columns:
            conn.execute("ALTER TABLE import_batches ADD COLUMN content_hash TEXT NOT NULL DEFAULT ''")
        conn.executescript(
            """
            CREATE UNIQUE INDEX IF NOT EXISTS idx_import_batches_dedupe
              ON import_batches(member_id, filename, content_hash);
            CREATE INDEX IF NOT EXISTS idx_todos_member_week
              ON todos(member_id, week_key, done);
            CREATE INDEX IF NOT EXISTS idx_reports_member_week
              ON weekly_reports(member_id, week_key, archived);
            CREATE INDEX IF NOT EXISTS idx_kb_member_week
              ON knowledge_entries(member_id, week_key, source);
            CREATE INDEX IF NOT EXISTS idx_tags_member_count
              ON tags(member_id, count DESC);
            CREATE INDEX IF NOT EXISTS idx_achievements_member
              ON achievement_events(member_id, unlocked);
            """
        )
        count = conn.execute("SELECT COUNT(*) FROM members").fetchone()[0]
        if count == 0:
            conn.executemany(
                "INSERT INTO members (id, name, role, department, is_manager, created_at) VALUES (?, ?, ?, ?, ?, ?)",
                [(member_id, name, role, dept, is_manager, utc_now()) for member_id, name, role, dept, is_manager in SEED_MEMBERS],
            )
            conn.executemany(
                """
                INSERT INTO todos (id, member_id, content, summary, category, priority, done, week_key, created_at, finished_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                [
                    ("td1", "m1", "Requirement Review", "Discussed Q4 flagship features", "Meeting", "high", 1, current_week_key(), utc_now(), utc_now()),
                    ("td2", "m1", "Code Review", "Proposed three optimization suggestions", "Coding", "high", 1, current_week_key(), utc_now(), utc_now()),
                    ("td3", "m1", "Advanced first proposal draft", None, "Proposal", "normal", 0, current_week_key(), utc_now(), None),
                ],
            )


def slug(value: str) -> str:
    cleaned = re.sub(r"[^a-zA-Z0-9]+", "-", value.strip().lower()).strip("-")
    return cleaned or "item"


def markdown_doc(frontmatter: dict[str, Any], title: str, sections: dict[str, list[str] | str]) -> str:
    lines = ["---"]
    for key, value in frontmatter.items():
        if isinstance(value, list):
            lines.append(f"{key}: [{', '.join(json.dumps(v) for v in value)}]")
        else:
            lines.append(f"{key}: {json.dumps(value)}")
    lines.extend(["---", "", f"# {title}", ""])
    for heading, body in sections.items():
        lines.append(f"## {heading}")
        if isinstance(body, list):
            if body:
                lines.extend([f"- {item}" for item in body])
            else:
                lines.append("- None")
        else:
            lines.append(body or "None")
        lines.append("")
    return "\n".join(lines).rstrip() + "\n"


def write_report_markdown(member: dict[str, Any], report: dict[str, Any]) -> str:
    member_dir = WORKSPACE_DIR / "members" / slug(member["name"]) / "reports"
    member_dir.mkdir(parents=True, exist_ok=True)
    path = member_dir / f"{report['week_key']}.md"
    doc = markdown_doc(
        {
            "id": report["id"],
            "member_id": report["member_id"],
            "member_name": member["name"],
            "week": report["week_key"],
            "source_type": "weekly_report",
            "archived": True,
            "updated_at": utc_now(),
        },
        f"{member['name']} Weekly Report {report['week_key']}",
        {
            "Completed This Week": report["completed"],
            "In Progress / Blocked": report["in_progress"],
            "Next Week Plan": report["next_week"],
            "Risks & Help Needed": report["risks"],
        },
    )
    path.write_text(doc, encoding="utf-8")
    return str(path.relative_to(WORKSPACE_DIR))


def write_team_summary_markdown(summary_id: str, member_ids: list[str], range_label: str, markdown: str) -> str:
    summary_dir = WORKSPACE_DIR / "team" / "summaries"
    summary_dir.mkdir(parents=True, exist_ok=True)
    path = summary_dir / f"{summary_id}.md"
    doc = markdown_doc(
        {
            "id": summary_id,
            "member_ids": member_ids,
            "range": range_label,
            "source_type": "team_summary",
            "created_at": utc_now(),
        },
        f"Mira Team Summary {range_label}",
        {"Summary": markdown},
    )
    path.write_text(doc, encoding="utf-8")
    return str(path.relative_to(WORKSPACE_DIR))


def classify_note_line(line: str) -> str:
    lower = line.lower()
    if any(token in lower for token in ("risk", "blocked", "blocker", "help needed")):
        return "risk"
    if any(token in lower for token in ("next week", "plan", "prepare", "will ")):
        return "next"
    return "completed"


def extract_keywords(texts: list[str]) -> dict[str, int]:
    joined = "\n".join(texts).lower()
    counts: dict[str, int] = {}
    for keyword in KEYWORDS:
        count = joined.count(keyword.lower())
        if count:
            counts[keyword] = count
    return counts
