from __future__ import annotations

from datetime import datetime, timedelta, timezone

import bcrypt
import uuid
from jose import JWTError, jwt

from .config import settings


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())


def create_access_token(user_id: str, email: str) -> str:
    """Create a JWT access token"""
    expires = datetime.now(timezone.utc) + timedelta(seconds=settings.jwt_access_expiry)
    payload = {
        "sub": user_id,
        "email": email,
        "exp": expires,
        "type": "access"
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm="HS256")


def create_refresh_token(user_id: str) -> str:
    """Create a JWT refresh token"""
    expires = datetime.now(timezone.utc) + timedelta(seconds=settings.jwt_refresh_expiry)
    payload = {
        "sub": user_id,
        "exp": expires,
        "type": "refresh",
        "jti": uuid.uuid4().hex,
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm="HS256")


def decode_token(token: str) -> dict:
    """Decode and verify a JWT token"""
    return jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])
