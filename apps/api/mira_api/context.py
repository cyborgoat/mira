"""Workspace context management using contextvars."""

from contextvars import ContextVar
from typing import Optional

from fastapi import HTTPException


# Context variable for storing the current workspace ID
workspace_context: ContextVar[Optional[str]] = ContextVar("workspace_id", default=None)


def get_workspace_id() -> str:
    """Get the current workspace ID from context.

    Raises:
        HTTPException: If no workspace context is set (400 Bad Request)

    Returns:
        The current workspace ID
    """
    workspace_id = workspace_context.get()
    if not workspace_id:
        raise HTTPException(status_code=400, detail="Workspace context not set")
    return workspace_id


def get_workspace_id_optional() -> Optional[str]:
    """Get the current workspace ID from context, or None if not set.

    Returns:
        The current workspace ID or None
    """
    return workspace_context.get()


def set_workspace_id(workspace_id: str) -> None:
    """Set the workspace ID in the current context.

    Args:
        workspace_id: The workspace ID to set
    """
    workspace_context.set(workspace_id)


def clear_workspace_context() -> None:
    """Clear the workspace context (useful for cleanup)."""
    workspace_context.set(None)
