"""Audit logging utilities."""

from __future__ import annotations

import json
import uuid
from typing import Optional, Dict, Any

from sqlalchemy.orm import Session

from .models import AuditLog
from .context import get_workspace_id
from .storage import utc_now


def log_audit(
    db: Session,
    action: str,
    entity_type: str,
    entity_id: str,
    user_id: Optional[str] = None,
    details: Optional[Dict[str, Any]] = None
) -> None:
    """Log an audit event.

    Args:
        db: Database session
        action: Action performed (e.g., 'todo.create', 'report.archive')
        entity_type: Type of entity (e.g., 'todo', 'report', 'workspace')
        entity_id: ID of the entity affected
        user_id: Optional user ID who performed the action
        details: Optional additional metadata as dict (will be JSON serialized)
    """
    workspace_id = get_workspace_id()

    audit = AuditLog(
        id=f"al_{uuid.uuid4().hex[:10]}",
        workspace_id=workspace_id,
        user_id=user_id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        details=json.dumps(details or {}),
        created_at=utc_now()
    )
    db.add(audit)
    # Note: Caller is responsible for db.commit()
