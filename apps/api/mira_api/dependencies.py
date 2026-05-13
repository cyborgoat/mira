from __future__ import annotations

from fastapi import Request, HTTPException, Depends
from sqlalchemy.orm import Session
from jose import JWTError

from .auth_utils import decode_token
from .database import get_db_dependency
from .models import User, UserMember, Member


async def get_current_user_optional(request: Request, db: Session = Depends(get_db_dependency)) -> dict | None:
    """Extract user from access token (optional, for backward compat)"""
    token = request.cookies.get("mira_access_token")
    if not token:
        return None

    try:
        payload = decode_token(token)
        user_id = payload.get("sub")
        if not user_id:
            return None

        user = db.query(User).filter(User.id == user_id).first()
        if not user or not user.is_active:
            return None

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
        return None


async def get_current_user_dependency(request: Request, db: Session = Depends(get_db_dependency)) -> dict:
    """Require authentication"""
    user = await get_current_user_optional(request, db)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user
