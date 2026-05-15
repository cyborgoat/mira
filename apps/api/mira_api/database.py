from __future__ import annotations

from contextlib import contextmanager
from pathlib import Path
from typing import Iterator

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import NullPool, QueuePool

from .config import settings


def ensure_sqlite_parent_dir() -> None:
    """Create the parent directory for file-backed SQLite databases."""
    if not settings.database_url.startswith("sqlite"):
        return

    database_path = settings.database_url.removeprefix("sqlite:///")
    if not database_path or database_path == ":memory:":
        return

    Path(database_path).expanduser().parent.mkdir(parents=True, exist_ok=True)


def get_pool_class():
    """Detect driver from URL and return appropriate pool class"""
    if settings.database_url.startswith("sqlite"):
        return NullPool  # SQLite doesn't need pooling
    else:
        return QueuePool  # PostgreSQL uses connection pool


# Create engine based on database URL
def create_db_engine():
    """Create SQLAlchemy engine with appropriate settings"""
    ensure_sqlite_parent_dir()

    base_args = {
        "url": settings.database_url,
        "echo": settings.debug,
        "poolclass": get_pool_class(),
    }

    # Add pool settings only for PostgreSQL
    if "postgresql" in settings.database_url:
        base_args["pool_pre_ping"] = True
        base_args["pool_size"] = 20
        base_args["max_overflow"] = 10
    elif settings.database_url.startswith("sqlite"):
        base_args["connect_args"] = {"check_same_thread": False}

    return create_engine(**base_args)


engine = create_db_engine()

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def initialize_database() -> None:
    """Initialize local database tables and baseline records."""
    from .models import Base, Member, Workspace
    from .storage import SEED_MEMBERS, utc_now

    Base.metadata.create_all(bind=engine)

    with SessionLocal() as db:
        now = utc_now()

        if not db.query(Workspace).filter(Workspace.id == "ws_default").first():
            db.add(
                Workspace(
                    id="ws_default",
                    name="Default Workspace",
                    slug="default",
                    created_at=now,
                    updated_at=now,
                )
            )

        for member_id, name, role, department, is_manager in SEED_MEMBERS:
            if not db.query(Member).filter(Member.id == member_id).first():
                db.add(
                    Member(
                        id=member_id,
                        workspace_id="ws_default",
                        name=name,
                        role=role,
                        department=department,
                        is_manager=is_manager,
                        created_at=now,
                    )
                )

        db.commit()


@contextmanager
def get_db() -> Iterator[Session]:
    """Database session context manager"""
    db = SessionLocal()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def get_db_dependency() -> Iterator[Session]:
    """FastAPI dependency for database sessions"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
