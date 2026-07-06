"""SQLAlchemy ORM models. Mirrors backend/supabase/migrations/0001_init.sql."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def _uuid() -> str:
    return str(uuid.uuid4())


def _now() -> datetime:
    return datetime.now(timezone.utc)


class Profile(Base):
    __tablename__ = "profiles"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    # matches Supabase auth.users.id when deployed
    display_name: Mapped[str] = mapped_column(String, default="Runner")
    dialect: Mapped[str] = mapped_column(String, default="twi")  # twi | ga | ewe
    weekly_target_km: Mapped[float] = mapped_column(Float, default=20.0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)

    runs: Mapped[list[Run]] = relationship(back_populates="profile")
    plans: Mapped[list[Plan]] = relationship(back_populates="profile")


class Plan(Base):
    __tablename__ = "plans"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    profile_id: Mapped[str] = mapped_column(ForeignKey("profiles.id"))
    name: Mapped[str] = mapped_column(String)
    goal: Mapped[str] = mapped_column(String, default="5k")  # 5k | 10k | half | base
    # ordered list of session dicts: {day, type, target_pace_s_per_km, distance_km, ...}
    sessions: Mapped[list] = mapped_column(JSON, default=list)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)

    profile: Mapped[Profile] = relationship(back_populates="plans")


class Run(Base):
    __tablename__ = "runs"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    profile_id: Mapped[str] = mapped_column(ForeignKey("profiles.id"))
    plan_id: Mapped[str | None] = mapped_column(ForeignKey("plans.id"), nullable=True)
    mode: Mapped[str] = mapped_column(String, default="free")  # free|interval|tempo|long
    dialect: Mapped[str] = mapped_column(String, default="twi")

    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    distance_m: Mapped[float] = mapped_column(Float, default=0.0)
    duration_s: Mapped[float] = mapped_column(Float, default=0.0)
    avg_pace_s_per_km: Mapped[float] = mapped_column(Float, default=0.0)
    avg_cadence_spm: Mapped[float] = mapped_column(Float, default=0.0)

    target_pace_s_per_km: Mapped[float | None] = mapped_column(Float, nullable=True)

    # denormalised time series + splits, stored as JSON for offline sync simplicity
    route: Mapped[list] = mapped_column(JSON, default=list)   # [{lat,lon,t,pace,cad}]
    splits: Mapped[list] = mapped_column(JSON, default=list)  # [{km,duration_s,pace}]
    cues: Mapped[list] = mapped_column(JSON, default=list)    # [{t, phrase_id, reason}]

    # client-generated id so retried offline syncs are idempotent
    client_id: Mapped[str | None] = mapped_column(String, unique=True, nullable=True)
    synced: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)

    profile: Mapped[Profile] = relationship(back_populates="runs")
