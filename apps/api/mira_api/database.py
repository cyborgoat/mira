from __future__ import annotations

from contextlib import contextmanager
from typing import Iterator

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import NullPool, QueuePool

from .config import settings


def get_pool_class():
    """Detect driver from URL and return appropriate pool class"""
    if settings.database_url.startswith("sqlite"):
        return NullPool  # SQLite doesn't need pooling
    else:
        return QueuePool  # PostgreSQL uses connection pool


# Create engine based on database URL
def create_db_engine():
    """Create SQLAlchemy engine with appropriate settings"""
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
