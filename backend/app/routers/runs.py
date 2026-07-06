"""Runs API: offline-first sync of completed runs + history + summaries."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import Depends

from app.auth import CurrentUserDep, CurrentUser
from app.database import get_db
from app.models import Profile, Run
from app.schemas import RunIn, RunOut
from app.services.coaching_engine import summarise

router = APIRouter(prefix="/runs", tags=["runs"])


async def _ensure_profile(db: AsyncSession, user_id: str) -> None:
    """Runs FK -> profiles; on Postgres a missing profile would 500 the insert."""
    if not await db.get(Profile, user_id):
        db.add(Profile(id=user_id))
        await db.flush()


@router.post("", response_model=RunOut, status_code=201)
async def sync_run(
    body: RunIn,
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = CurrentUserDep,
) -> RunOut:
    """Idempotent upsert keyed on client_id so retried offline syncs are safe."""
    existing = await db.scalar(select(Run).where(Run.client_id == body.client_id))
    if existing:
        return existing  # already synced — return the stored version

    await _ensure_profile(db, user.id)
    route = [p.model_dump() for p in body.route]
    summary = summarise(route, body.target_pace_s_per_km)
    duration_s = (
        (body.ended_at - body.started_at).total_seconds()
        if body.ended_at else summary["duration_s"]
    )

    run = Run(
        profile_id=user.id,
        plan_id=body.plan_id,
        mode=body.mode,
        dialect=body.dialect,
        started_at=body.started_at,
        ended_at=body.ended_at,
        distance_m=summary["distance_m"],
        duration_s=duration_s,
        avg_pace_s_per_km=summary["avg_pace_s_per_km"],
        avg_cadence_spm=summary["avg_cadence_spm"],
        target_pace_s_per_km=body.target_pace_s_per_km,
        route=route,
        splits=summary["splits"],
        cues=body.cues,
        client_id=body.client_id,
        synced=True,
    )
    db.add(run)
    await db.flush()
    return run


@router.get("", response_model=list[RunOut])
async def list_runs(
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = CurrentUserDep,
) -> list[Run]:
    rows = await db.scalars(
        select(Run)
        .where(Run.profile_id == user.id)
        .order_by(Run.started_at.desc())
        .limit(limit)
    )
    return list(rows)


@router.get("/stats")
async def stats(
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = CurrentUserDep,
) -> dict:
    rows = list(await db.scalars(select(Run).where(Run.profile_id == user.id)))
    total_km = sum(r.distance_m for r in rows) / 1000
    total_runs = len(rows)
    total_time_s = sum(r.duration_s for r in rows)
    best_pace = min((r.avg_pace_s_per_km for r in rows if r.avg_pace_s_per_km > 0),
                    default=0)
    return {
        "total_runs": total_runs,
        "total_km": round(total_km, 2),
        "total_time_s": round(total_time_s, 1),
        "best_pace_s_per_km": round(best_pace, 1),
        "avg_cadence_spm": round(
            sum(r.avg_cadence_spm for r in rows) / total_runs, 1
        ) if total_runs else 0,
    }


@router.get("/{run_id}", response_model=RunOut)
async def get_run(
    run_id: str,
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = CurrentUserDep,
) -> Run:
    run = await db.get(Run, run_id)
    if not run or run.profile_id != user.id:
        raise HTTPException(status_code=404, detail="Run not found")
    return run
