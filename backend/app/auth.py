"""Supabase JWT verification.

In production every request carries a Supabase-issued JWT (HS256, signed with the
project's JWT secret). We verify it locally — no round-trip to Supabase. In dev, if
no Authorization header is present we fall back to a stable demo user so the app is
runnable end-to-end without wiring auth first.
"""
from __future__ import annotations

from dataclasses import dataclass

from fastapi import Depends, Header, HTTPException, status
from jose import JWTError, jwt

from app.config import get_settings

settings = get_settings()

DEMO_USER_ID = "00000000-0000-0000-0000-000000000001"


@dataclass
class CurrentUser:
    id: str
    email: str | None = None


def _decode(token: str) -> dict:
    try:
        return jwt.decode(
            token,
            settings.supabase_jwt_secret,
            algorithms=["HS256"],
            audience="authenticated",
            options={"verify_aud": False},
        )
    except JWTError as exc:  # pragma: no cover - exercised via API tests
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token: {exc}",
        ) from exc


async def get_current_user(
    authorization: str | None = Header(default=None),
) -> CurrentUser:
    if not authorization:
        if settings.app_env == "production":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Missing Authorization header",
            )
        return CurrentUser(id=DEMO_USER_ID, email="demo@runtwi.app")

    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Expected 'Bearer <token>'",
        )

    payload = _decode(token)
    return CurrentUser(id=payload.get("sub", DEMO_USER_ID), email=payload.get("email"))


CurrentUserDep = Depends(get_current_user)
