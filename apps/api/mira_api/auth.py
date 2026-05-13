from __future__ import annotations

import hashlib
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, HTTPException, Response, Request, Depends
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session
from jose import JWTError

from .database import get_db_dependency
from .models import User, Member, UserMember, RefreshToken, UserWorkspace
from .auth_utils import hash_password, verify_password, create_access_token, create_refresh_token, decode_token
from .storage import utc_now

router = APIRouter(prefix="/auth", tags=["auth"])


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    name: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class AuthResponse(BaseModel):
    user: dict
    member: dict


@router.post("/register", response_model=AuthResponse)
def register(payload: RegisterRequest, response: Response, db: Session = Depends(get_db_dependency)):
    """Register a new user"""
    # Check if email exists
    existing_user = db.query(User).filter(User.email == payload.email).first()
    if existing_user:
        raise HTTPException(status_code=409, detail="Email already registered")

    # Create user
    now = utc_now()
    user = User(
        id=f"usr_{uuid.uuid4().hex[:10]}",
        email=payload.email,
        password_hash=hash_password(payload.password),
        created_at=now,
        updated_at=now
    )
    db.add(user)

    # Get current workspace context (defaults to ws_default for unauthenticated requests)
    from .context import get_workspace_id
    workspace_id = get_workspace_id()

    # Create member in current workspace
    member = Member(
        id=f"m_{uuid.uuid4().hex[:10]}",
        workspace_id=workspace_id,
        name=payload.name,
        role="Member",
        department="General",
        is_manager=0,
        created_at=now
    )
    db.add(member)

    # Link user to member
    user_member = UserMember(
        id=f"um_{uuid.uuid4().hex[:10]}",
        user_id=user.id,
        member_id=member.id,
        role="member",
        created_at=now
    )
    db.add(user_member)

    # Link user to current workspace
    user_workspace = UserWorkspace(
        id=f"uw_{uuid.uuid4().hex[:10]}",
        user_id=user.id,
        workspace_id=workspace_id,
        role="member",
        created_at=now
    )
    db.add(user_workspace)

    db.commit()
    db.refresh(user)
    db.refresh(member)

    # Generate tokens
    access_token = create_access_token(user.id, user.email)
    refresh_token_str = create_refresh_token(user.id)

    # Store refresh token in DB
    from .config import settings
    refresh_token = RefreshToken(
        id=f"rt_{uuid.uuid4().hex[:10]}",
        user_id=user.id,
        token_hash=hashlib.sha256(refresh_token_str.encode()).hexdigest(),
        expires_at=(datetime.now(timezone.utc) + timedelta(seconds=settings.jwt_refresh_expiry)).isoformat(timespec="seconds"),
        created_at=now
    )
    db.add(refresh_token)
    db.commit()

    # Set httpOnly cookies
    from .config import settings
    response.set_cookie(
        key="mira_access_token",
        value=access_token,
        httponly=True,
        samesite="lax",
        max_age=settings.jwt_access_expiry
    )
    response.set_cookie(
        key="mira_refresh_token",
        value=refresh_token_str,
        httponly=True,
        samesite="lax",
        max_age=settings.jwt_refresh_expiry
    )

    return {
        "user": {"id": user.id, "email": user.email, "created_at": user.created_at},
        "member": {"id": member.id, "name": member.name, "role": member.role}
    }


@router.post("/login", response_model=AuthResponse)
def login(payload: LoginRequest, response: Response, db: Session = Depends(get_db_dependency)):
    """Login an existing user"""
    # Find user
    user = db.query(User).filter(User.email == payload.email).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if not user.is_active:
        raise HTTPException(status_code=403, detail="User account is disabled")

    # Get first linked member
    user_member = db.query(UserMember).filter(UserMember.user_id == user.id).first()
    if not user_member:
        raise HTTPException(status_code=404, detail="No member linked to user")

    member = db.query(Member).filter(Member.id == user_member.member_id).first()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    # Generate and set tokens
    access_token = create_access_token(user.id, user.email)
    refresh_token_str = create_refresh_token(user.id)

    now = utc_now()
    from .config import settings
    refresh_token = RefreshToken(
        id=f"rt_{uuid.uuid4().hex[:10]}",
        user_id=user.id,
        token_hash=hashlib.sha256(refresh_token_str.encode()).hexdigest(),
        expires_at=(datetime.now(timezone.utc) + timedelta(seconds=settings.jwt_refresh_expiry)).isoformat(timespec="seconds"),
        created_at=now
    )
    db.add(refresh_token)
    db.commit()

    response.set_cookie("mira_access_token", access_token, httponly=True, samesite="lax", max_age=settings.jwt_access_expiry)
    response.set_cookie("mira_refresh_token", refresh_token_str, httponly=True, samesite="lax", max_age=settings.jwt_refresh_expiry)

    return {
        "user": {"id": user.id, "email": user.email, "created_at": user.created_at},
        "member": {"id": member.id, "name": member.name, "role": member.role, "department": member.department}
    }


@router.post("/logout")
def logout(request: Request, response: Response, db: Session = Depends(get_db_dependency)):
    """Logout the current user"""
    refresh_token = request.cookies.get("mira_refresh_token")
    if refresh_token:
        try:
            payload = decode_token(refresh_token)
            # Mark all user's refresh tokens as revoked
            db.query(RefreshToken).filter(RefreshToken.user_id == payload["sub"]).update({"revoked": True})
            db.commit()
        except JWTError:
            pass

    response.delete_cookie("mira_access_token")
    response.delete_cookie("mira_refresh_token")
    return {"ok": True}


@router.get("/me")
def get_current_user_endpoint(request: Request, db: Session = Depends(get_db_dependency)):
    """Get current user info"""
    token = request.cookies.get("mira_access_token")
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    try:
        payload = decode_token(token)
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")

        user = db.query(User).filter(User.id == user_id).first()
        if not user or not user.is_active:
            raise HTTPException(status_code=401, detail="User not found or inactive")

        # Get linked members
        user_members = db.query(UserMember).filter(UserMember.user_id == user_id).all()
        members = []
        for um in user_members:
            member = db.query(Member).filter(Member.id == um.member_id).first()
            if member:
                members.append({"id": member.id, "name": member.name, "role": member.role, "department": member.department})

        return {
            "id": user.id,
            "email": user.email,
            "members": members
        }
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
