from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


# ── Profiles ─────────────────────────────────────────────────────────────────
class ProfileIn(BaseModel):
    display_name: str = "Runner"
    dialect: str = Field("twi", pattern="^(twi|ga|ewe)$")
    weekly_target_km: float = 20.0


class ProfileOut(ProfileIn):
    id: str
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Plans ────────────────────────────────────────────────────────────────────
class PlanSession(BaseModel):
    day: int
    type: str = Field("easy", pattern="^(easy|interval|tempo|long|rest)$")
    distance_km: float = 0
    target_pace_s_per_km: float | None = None
    notes: str | None = None


class PlanIn(BaseModel):
    name: str
    goal: str = Field("5k", pattern="^(5k|10k|half|base)$")
    sessions: list[PlanSession] = []


class PlanOut(PlanIn):
    id: str
    active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Runs ─────────────────────────────────────────────────────────────────────
class RoutePoint(BaseModel):
    t: float                 # seconds since run start
    lat: float | None = None
    lon: float | None = None
    distance_m: float = 0
    pace: float | None = None      # s/km, smoothed
    cad: float | None = None       # cadence spm


class RunIn(BaseModel):
    client_id: str                 # idempotency key from the device
    mode: str = Field("free", pattern="^(free|interval|tempo|long)$")
    dialect: str = Field("twi", pattern="^(twi|ga|ewe)$")
    plan_id: str | None = None
    target_pace_s_per_km: float | None = None
    started_at: datetime
    ended_at: datetime | None = None
    route: list[RoutePoint] = []
    cues: list[dict] = []


class RunOut(BaseModel):
    id: str
    mode: str
    dialect: str
    distance_m: float
    duration_s: float
    avg_pace_s_per_km: float
    avg_cadence_spm: float
    splits: list[dict]
    started_at: datetime
    ended_at: datetime | None

    model_config = {"from_attributes": True}


# ── Coaching / phrases ───────────────────────────────────────────────────────
class EvaluateIn(BaseModel):
    elapsed_s: float
    distance_m: float
    pace_s_per_km: float
    cadence_spm: float
    mode: str = "free"
    dialect: str = "twi"
    target_pace_s_per_km: float | None = None
    target_distance_m: float | None = None
    interval_phase: str | None = None
    interval_phase_changed: bool = False
    # opaque memory blob the client round-trips so the server stays stateless
    memory: dict = {}


class EvaluateOut(BaseModel):
    cue: str | None
    reason: str | None
    params: dict = {}
    audio: dict | None = None
    memory: dict
