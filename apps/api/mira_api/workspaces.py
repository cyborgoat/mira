"""Workspace management endpoints."""

from __future__ import annotations

import uuid
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from .database import get_db_dependency
from .dependencies import get_current_user_dependency
from .models import Workspace, UserWorkspace, Member, UserMember
from .storage import utc_now

router = APIRouter(prefix="/workspaces", tags=["workspaces"])


class WorkspaceResponse(BaseModel):
    id: str
    name: str
    slug: str
    role: str
    created_at: str


class CreateWorkspaceRequest(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    slug: str = Field(min_length=1, max_length=50, pattern="^[a-z0-9-]+$")


class WorkspaceDetailResponse(BaseModel):
    id: str
    name: str
    slug: str
    member_count: int
    created_at: str


@router.get("/me", response_model=List[WorkspaceResponse])
def get_my_workspaces(
    current_user: dict = Depends(get_current_user_dependency),
    db: Session = Depends(get_db_dependency)
):
    """Get all workspaces the current user belongs to."""
    user_workspaces = db.query(UserWorkspace).filter(
        UserWorkspace.user_id == current_user["id"]
    ).all()

    results = []
    for uw in user_workspaces:
        workspace = db.query(Workspace).filter(Workspace.id == uw.workspace_id).first()
        if workspace:
            results.append({
                "id": workspace.id,
                "name": workspace.name,
                "slug": workspace.slug,
                "role": uw.role,
                "created_at": workspace.created_at
            })

    return results


@router.post("", response_model=WorkspaceResponse)
def create_workspace(
    payload: CreateWorkspaceRequest,
    current_user: dict = Depends(get_current_user_dependency),
    db: Session = Depends(get_db_dependency)
):
    """Create a new workspace."""
    # Check if slug already exists
    existing = db.query(Workspace).filter(Workspace.slug == payload.slug).first()
    if existing:
        raise HTTPException(status_code=409, detail="Workspace slug already exists")

    now = utc_now()

    # Create workspace
    workspace = Workspace(
        id=f"ws_{uuid.uuid4().hex[:10]}",
        name=payload.name,
        slug=payload.slug,
        created_at=now,
        updated_at=now
    )
    db.add(workspace)

    # Link user as workspace admin
    user_workspace = UserWorkspace(
        id=f"uw_{uuid.uuid4().hex[:10]}",
        user_id=current_user["id"],
        workspace_id=workspace.id,
        role="workspace_admin",
        created_at=now
    )
    db.add(user_workspace)

    # Create a member for the user in this workspace
    member = Member(
        id=f"m_{uuid.uuid4().hex[:10]}",
        workspace_id=workspace.id,
        name=current_user.get("email", "Admin"),  # Get name from current_user if available
        role="Admin",
        department="Management",
        is_manager=1,
        created_at=now
    )
    db.add(member)

    # Link user to this member
    user_member = UserMember(
        id=f"um_{uuid.uuid4().hex[:10]}",
        user_id=current_user["id"],
        member_id=member.id,
        role="workspace_admin",
        created_at=now
    )
    db.add(user_member)

    db.commit()
    db.refresh(workspace)

    return {
        "id": workspace.id,
        "name": workspace.name,
        "slug": workspace.slug,
        "role": "workspace_admin",
        "created_at": workspace.created_at
    }


@router.get("/{workspace_id}", response_model=WorkspaceDetailResponse)
def get_workspace_detail(
    workspace_id: str,
    current_user: dict = Depends(get_current_user_dependency),
    db: Session = Depends(get_db_dependency)
):
    """Get workspace details."""
    # Verify user has access to this workspace
    user_workspace = db.query(UserWorkspace).filter(
        UserWorkspace.user_id == current_user["id"],
        UserWorkspace.workspace_id == workspace_id
    ).first()

    if not user_workspace:
        raise HTTPException(status_code=403, detail="Access denied to this workspace")

    workspace = db.query(Workspace).filter(Workspace.id == workspace_id).first()
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")

    # Count members
    member_count = db.query(Member).filter(Member.workspace_id == workspace_id).count()

    return {
        "id": workspace.id,
        "name": workspace.name,
        "slug": workspace.slug,
        "member_count": member_count,
        "created_at": workspace.created_at
    }
