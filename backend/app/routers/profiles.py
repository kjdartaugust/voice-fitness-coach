"""Profile API: create/read the runner profile (dialect preference lives here)."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import CurrentUser, CurrentUserDep
from app.database import get_db
from app.models import Profile
from app.schemas import ProfileIn, ProfileOut

router = APIRouter(prefix="/profiles", tags=["profiles"])


async def _get_or_create(db: AsyncSession, user: CurrentUser) -> Profile:
    profile = await db.get(Profile, user.id)
    if not profile:
        profile = Profile(id=user.id)
        db.add(profile)
        await db.flush()
    return profile


@router.get("/me", response_model=ProfileOut)
async def me(
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = CurrentUserDep,
) -> Profile:
    return await _get_or_create(db, user)


@router.put("/me", response_model=ProfileOut)
async def update_me(
    body: ProfileIn,
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = CurrentUserDep,
) -> Profile:
    profile = await _get_or_create(db, user)
    profile.display_name = body.display_name
    profile.dialect = body.dialect
    profile.weekly_target_km = body.weekly_target_km
    await db.flush()
    return profile
