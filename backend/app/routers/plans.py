"""Plans API: adaptive training-plan generation + retrieval.

The generator builds a simple, sane multi-week block from a goal + current weekly
volume. It adapts week-to-week volume via progressive overload and pulls target
paces from a goal-race pace table. This is deliberately transparent (not a black
box) so a coach can inspect and tweak it.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import CurrentUser, CurrentUserDep
from app.database import get_db
from app.models import Plan, Profile
from app.schemas import PlanIn, PlanOut

router = APIRouter(prefix="/plans", tags=["plans"])


async def _ensure_profile(db: AsyncSession, user_id: str) -> None:
    if not await db.get(Profile, user_id):
        db.add(Profile(id=user_id))
        await db.flush()

# Rough goal-race target paces (s/km) used to derive session paces.
GOAL_PACE = {"5k": 330, "10k": 350, "half": 370, "base": 400}


def generate_plan(goal: str, weekly_km: float, weeks: int = 6) -> list[dict]:
    """Return a week-by-week session list with progressive overload."""
    race_pace = GOAL_PACE.get(goal, 360)
    sessions: list[dict] = []
    volume = max(weekly_km, 10.0)
    for week in range(1, weeks + 1):
        # deload every 4th week
        factor = 0.7 if week % 4 == 0 else 1.0 + (week - 1) * 0.08
        wk = volume * factor
        sessions.extend([
            {"day": (week - 1) * 7 + 2, "type": "interval",
             "distance_km": round(wk * 0.20, 1),
             "target_pace_s_per_km": race_pace - 20,
             "notes": f"W{week}: 6x400m @ 5k pace, jog recoveries"},
            {"day": (week - 1) * 7 + 4, "type": "tempo",
             "distance_km": round(wk * 0.25, 1),
             "target_pace_s_per_km": race_pace + 15,
             "notes": f"W{week}: steady tempo, comfortably hard"},
            {"day": (week - 1) * 7 + 6, "type": "long",
             "distance_km": round(wk * 0.40, 1),
             "target_pace_s_per_km": race_pace + 60,
             "notes": f"W{week}: easy conversational long run"},
        ])
    return sessions


@router.post("/generate", response_model=PlanOut, status_code=201)
async def create_generated_plan(
    goal: str = "5k",
    weekly_km: float = 20.0,
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = CurrentUserDep,
) -> Plan:
    if goal not in GOAL_PACE:
        raise HTTPException(status_code=422, detail=f"goal must be one of {list(GOAL_PACE)}")
    await _ensure_profile(db, user.id)
    # deactivate previous plans
    await db.execute(
        update(Plan).where(Plan.profile_id == user.id).values(active=False)
    )
    plan = Plan(
        profile_id=user.id,
        name=f"{goal.upper()} plan",
        goal=goal,
        sessions=generate_plan(goal, weekly_km),
        active=True,
    )
    db.add(plan)
    await db.flush()
    return plan


@router.post("", response_model=PlanOut, status_code=201)
async def create_plan(
    body: PlanIn,
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = CurrentUserDep,
) -> Plan:
    await _ensure_profile(db, user.id)
    plan = Plan(
        profile_id=user.id,
        name=body.name,
        goal=body.goal,
        sessions=[s.model_dump() for s in body.sessions],
        active=True,
    )
    db.add(plan)
    await db.flush()
    return plan


@router.get("", response_model=list[PlanOut])
async def list_plans(
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = CurrentUserDep,
) -> list[Plan]:
    rows = await db.scalars(
        select(Plan).where(Plan.profile_id == user.id).order_by(Plan.created_at.desc())
    )
    return list(rows)
