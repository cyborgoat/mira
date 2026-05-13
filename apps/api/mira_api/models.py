from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy import Column, String, Integer, Text, ForeignKey, DateTime, Boolean, Index, UniqueConstraint
from sqlalchemy.orm import declarative_base, relationship
from sqlalchemy.sql import func

Base = declarative_base()


class Workspace(Base):
    __tablename__ = "workspaces"

    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    slug = Column(String, unique=True, nullable=False)
    created_at = Column(String, nullable=False)
    updated_at = Column(String, nullable=False)

    members = relationship("Member", back_populates="workspace")


class Member(Base):
    __tablename__ = "members"

    id = Column(String, primary_key=True)
    workspace_id = Column(String, ForeignKey("workspaces.id"), nullable=True)  # Nullable for migration
    name = Column(String, nullable=False)
    role = Column(String, nullable=False)
    department = Column(String, nullable=False)
    is_manager = Column(Integer, nullable=False, default=0)
    created_at = Column(String, nullable=False)

    # Relationships
    workspace = relationship("Workspace", back_populates="members")
    todos = relationship("Todo", back_populates="member", cascade="all, delete-orphan")
    weekly_reports = relationship("WeeklyReport", back_populates="member")
    knowledge_entries = relationship("KnowledgeEntry", back_populates="member")
    tags = relationship("Tag", back_populates="member")
    achievement_events = relationship("AchievementEvent", back_populates="member")
    import_batches = relationship("ImportBatch", back_populates="member")


class Todo(Base):
    __tablename__ = "todos"

    id = Column(String, primary_key=True)
    workspace_id = Column(String, ForeignKey("workspaces.id"), nullable=True)  # Nullable for migration
    member_id = Column(String, ForeignKey("members.id"), nullable=False)
    content = Column(Text, nullable=False)
    summary = Column(Text)
    category = Column(String, default="Other")
    priority = Column(String, default="normal")
    done = Column(Integer, default=0)
    week_key = Column(String, nullable=False)
    created_at = Column(String, nullable=False)
    finished_at = Column(String)

    member = relationship("Member", back_populates="todos")

    __table_args__ = (
        Index("idx_todos_member_week", "member_id", "week_key", "done"),
        Index("idx_todos_workspace", "workspace_id"),
    )


class WeeklyReport(Base):
    __tablename__ = "weekly_reports"

    id = Column(String, primary_key=True)
    workspace_id = Column(String, ForeignKey("workspaces.id"), nullable=True)  # Nullable for migration
    member_id = Column(String, ForeignKey("members.id"), nullable=False)
    week_key = Column(String, nullable=False)
    completed = Column(Text, nullable=False)
    in_progress = Column(Text, nullable=False)
    next_week = Column(Text, nullable=False)
    risks = Column(Text, nullable=False)
    archived = Column(Integer, default=0)
    markdown_path = Column(String)
    created_at = Column(String, nullable=False)
    updated_at = Column(String, nullable=False)

    member = relationship("Member", back_populates="weekly_reports")
    knowledge_entries = relationship("KnowledgeEntry", back_populates="report")

    __table_args__ = (
        Index("idx_reports_member_week", "member_id", "week_key", "archived"),
        Index("idx_reports_workspace", "workspace_id"),
    )


class KnowledgeEntry(Base):
    __tablename__ = "knowledge_entries"

    id = Column(String, primary_key=True)
    workspace_id = Column(String, ForeignKey("workspaces.id"), nullable=True)  # Nullable for migration
    member_id = Column(String, ForeignKey("members.id"), nullable=False)
    report_id = Column(String, ForeignKey("weekly_reports.id"))
    week_key = Column(String, nullable=False)
    text = Column(Text, nullable=False)
    source = Column(String, nullable=False)
    markdown_path = Column(String)
    created_at = Column(String, nullable=False)

    member = relationship("Member", back_populates="knowledge_entries")
    report = relationship("WeeklyReport", back_populates="knowledge_entries")

    __table_args__ = (
        Index("idx_kb_member_week", "member_id", "week_key", "source"),
        Index("idx_kb_workspace", "workspace_id"),
    )


class Tag(Base):
    __tablename__ = "tags"

    id = Column(String, primary_key=True)
    workspace_id = Column(String, ForeignKey("workspaces.id"), nullable=True)  # Nullable for migration
    member_id = Column(String, ForeignKey("members.id"), nullable=False)
    name = Column(String, nullable=False)
    count = Column(Integer, nullable=False)
    last_week = Column(String, nullable=False)
    sleeping = Column(Integer, default=0)
    updated_at = Column(String, nullable=False)

    member = relationship("Member", back_populates="tags")

    __table_args__ = (
        UniqueConstraint("member_id", "name", name="uq_tags_member_name"),
        Index("idx_tags_member_count", "member_id", "count"),
        Index("idx_tags_workspace", "workspace_id"),
    )


class AchievementEvent(Base):
    __tablename__ = "achievement_events"

    id = Column(String, primary_key=True)
    workspace_id = Column(String, ForeignKey("workspaces.id"), nullable=True)  # Nullable for migration
    member_id = Column(String, ForeignKey("members.id"), nullable=False)
    badge_id = Column(String, nullable=False)
    badge_name = Column(String, nullable=False)
    progress = Column(Integer, nullable=False)
    threshold = Column(Integer, nullable=False)
    unlocked = Column(Integer, nullable=False)
    trace = Column(Text, nullable=False)
    updated_at = Column(String, nullable=False)

    member = relationship("Member", back_populates="achievement_events")

    __table_args__ = (
        UniqueConstraint("member_id", "badge_id", name="uq_achievements_member_badge"),
        Index("idx_achievements_member", "member_id", "unlocked"),
        Index("idx_achievements_workspace", "workspace_id"),
    )


class TeamSummary(Base):
    __tablename__ = "team_summaries"

    id = Column(String, primary_key=True)
    workspace_id = Column(String, ForeignKey("workspaces.id"), nullable=True)  # Nullable for migration
    member_ids = Column(Text, nullable=False)
    range_label = Column(String, nullable=False)
    markdown = Column(Text, nullable=False)
    markdown_path = Column(String, nullable=False)
    created_at = Column(String, nullable=False)

    __table_args__ = (
        Index("idx_team_summaries_workspace", "workspace_id"),
    )


class ImportBatch(Base):
    __tablename__ = "import_batches"

    id = Column(String, primary_key=True)
    workspace_id = Column(String, ForeignKey("workspaces.id"), nullable=True)  # Nullable for migration
    member_id = Column(String, ForeignKey("members.id"), nullable=False)
    filename = Column(String, nullable=False)
    content_hash = Column(String, nullable=False, default="")
    report_id = Column(String, ForeignKey("weekly_reports.id"), nullable=False)
    markdown_path = Column(String, nullable=False)
    created_at = Column(String, nullable=False)

    member = relationship("Member", back_populates="import_batches")

    __table_args__ = (
        UniqueConstraint("member_id", "filename", "content_hash", name="idx_import_batches_dedupe"),
        Index("idx_import_batches_workspace", "workspace_id"),
    )


# Auth models
class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True)
    email = Column(String, unique=True, nullable=False)
    password_hash = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(String, nullable=False)
    updated_at = Column(String, nullable=False)

    refresh_tokens = relationship("RefreshToken", back_populates="user", cascade="all, delete-orphan")
    user_members = relationship("UserMember", back_populates="user", cascade="all, delete-orphan")

    __table_args__ = (
        Index("idx_users_email", "email"),
    )


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    id = Column(String, primary_key=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    token_hash = Column(String, unique=True, nullable=False)
    expires_at = Column(String, nullable=False)
    revoked = Column(Boolean, default=False)
    created_at = Column(String, nullable=False)

    user = relationship("User", back_populates="refresh_tokens")

    __table_args__ = (
        Index("idx_refresh_tokens_user", "user_id", "expires_at"),
    )


class UserMember(Base):
    __tablename__ = "user_members"

    id = Column(String, primary_key=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    member_id = Column(String, ForeignKey("members.id", ondelete="CASCADE"), nullable=False)
    role = Column(String, default="member")  # member, manager, workspace_admin
    created_at = Column(String, nullable=False)

    user = relationship("User", back_populates="user_members")
    member = relationship("Member")

    __table_args__ = (
        Index("idx_user_members_user", "user_id"),
        Index("idx_user_members_member", "member_id"),
    )


class UserWorkspace(Base):
    __tablename__ = "user_workspaces"

    id = Column(String, primary_key=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    workspace_id = Column(String, ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False)
    role = Column(String, default="member")  # member, manager, workspace_admin
    created_at = Column(String, nullable=False)

    user = relationship("User")
    workspace = relationship("Workspace")

    __table_args__ = (
        Index("idx_user_workspaces_user", "user_id"),
        Index("idx_user_workspaces_workspace", "workspace_id"),
    )


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(String, primary_key=True)
    workspace_id = Column(String, ForeignKey("workspaces.id"), nullable=False)
    user_id = Column(String, ForeignKey("users.id"), nullable=True)
    action = Column(String, nullable=False)  # 'todo.create', 'report.archive'
    entity_type = Column(String, nullable=False)
    entity_id = Column(String, nullable=False)
    details = Column(Text)  # JSON metadata
    created_at = Column(String, nullable=False)

    __table_args__ = (
        Index("idx_audit_logs_workspace", "workspace_id", "created_at"),
        Index("idx_audit_logs_user", "user_id", "created_at"),
    )


def model_to_dict(obj: Any) -> dict[str, Any]:
    """Convert SQLAlchemy model instance to dictionary"""
    if obj is None:
        return None

    result = {}
    for column in obj.__table__.columns:
        value = getattr(obj, column.name)
        result[column.name] = value

    # Parse JSON fields
    import json
    for key in ("completed", "in_progress", "next_week", "risks"):
        if key in result and isinstance(result[key], str):
            try:
                result[key] = json.loads(result[key])
            except (json.JSONDecodeError, TypeError):
                pass

    # Parse member_ids for team_summaries
    if "member_ids" in result and isinstance(result["member_ids"], str):
        try:
            result["member_ids"] = json.loads(result["member_ids"])
        except (json.JSONDecodeError, TypeError):
            pass

    # Parse trace for achievement_events
    if "trace" in result and isinstance(result["trace"], str):
        try:
            result["trace"] = json.loads(result["trace"])
        except (json.JSONDecodeError, TypeError):
            pass

    return result
