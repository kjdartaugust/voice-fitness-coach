"""Stateless coaching endpoints.

The client runs the same rules locally for zero-latency offline cues, but this
endpoint lets thin clients (or server-side simulation/tests) get a decision, and
attaches the resolved phrase-bank audio for the chosen cue.
"""
from __future__ import annotations

from fastapi import APIRouter

from app.auth import CurrentUserDep
from app.schemas import EvaluateIn, EvaluateOut
from app.services import phrase_bank
from app.services.coaching_engine import CoachMemory, CueId, RunnerState, evaluate

router = APIRouter(prefix="/coaching", tags=["coaching"])


def _memory_from_blob(blob: dict) -> CoachMemory:
    mem = CoachMemory()
    # keys come back as plain strings; CueId is a str-Enum so they compare equal,
    # but coerce to CueId for consistent hashing across the tick.
    mem.last_fired_s = {CueId(k): v for k, v in blob.get("last_fired_s", {}).items()}
    mem.splits_announced = blob.get("splits_announced", 0)
    mem.halfway_done = blob.get("halfway_done", False)
    return mem


def _memory_to_blob(mem: CoachMemory) -> dict:
    return {
        # use .value so keys round-trip as "speed_up", not "CueId.SPEED_UP"
        "last_fired_s": {
            (k.value if isinstance(k, CueId) else k): v
            for k, v in mem.last_fired_s.items()
        },
        "splits_announced": mem.splits_announced,
        "halfway_done": mem.halfway_done,
    }


@router.post("/evaluate", response_model=EvaluateOut)
async def evaluate_tick(body: EvaluateIn, _user=CurrentUserDep) -> EvaluateOut:
    mem = _memory_from_blob(body.memory)
    state = RunnerState(
        elapsed_s=body.elapsed_s,
        distance_m=body.distance_m,
        pace_s_per_km=body.pace_s_per_km,
        cadence_spm=body.cadence_spm,
        mode=body.mode,
        target_pace_s_per_km=body.target_pace_s_per_km,
        target_distance_m=body.target_distance_m,
        interval_phase=body.interval_phase,
        interval_phase_changed=body.interval_phase_changed,
    )
    cue = evaluate(state, mem)
    audio = None
    if cue is not None:
        audio = phrase_bank.audio_urls(cue.id.value, body.dialect, cue.params)

    return EvaluateOut(
        cue=cue.id.value if cue else None,
        reason=cue.reason if cue else None,
        params=cue.params if cue else {},
        audio=audio,
        memory=_memory_to_blob(mem),
    )
