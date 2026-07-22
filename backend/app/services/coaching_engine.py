"""Real-time coaching decision engine.

Pure, framework-agnostic logic: given a snapshot of the runner's live state it
decides whether to speak, *what* cue to speak, and why. The same rules run on the
server (for post-run analysis / simulation / tests) and are mirrored in the client
(`frontend/lib/coaching.ts`) so cues fire instantly during a run even offline.

Design goals:
  * Never nag — every cue category has a cooldown.
  * Prioritise safety/urgency (way off pace) over nice-to-haves (encouragement).
  * Emit abstract Cue intents; the phrase bank turns them into dialect audio.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum


class CueId(str, Enum):
    SPEED_UP = "speed_up"
    SLOW_DOWN = "slow_down"
    ON_PACE = "on_pace"
    CADENCE_LOW = "cadence_low"
    OVERSTRIDING = "overstriding"
    DISTANCE_REMAINING = "distance_remaining"  # parametric (meters)
    KM_SPLIT = "km_split"                       # parametric (km number + pace)
    INTERVAL_WORK = "interval_work"
    INTERVAL_REST = "interval_rest"
    HALFWAY = "halfway"
    FINISH = "finish"
    ENCOURAGE = "encourage"


# Priority: higher = more important; wins if two cues are eligible in the same tick.
PRIORITY = {
    CueId.FINISH: 100,
    CueId.INTERVAL_WORK: 90,
    CueId.INTERVAL_REST: 90,
    CueId.SLOW_DOWN: 70,
    CueId.SPEED_UP: 70,
    CueId.CADENCE_LOW: 60,
    CueId.OVERSTRIDING: 55,
    CueId.KM_SPLIT: 50,
    CueId.DISTANCE_REMAINING: 45,
    CueId.HALFWAY: 40,
    CueId.ON_PACE: 30,
    CueId.ENCOURAGE: 10,
}

# Per-cue cooldown (seconds) — don't repeat the same nudge too soon.
COOLDOWN_S = {
    CueId.SPEED_UP: 25,
    CueId.SLOW_DOWN: 25,
    CueId.ON_PACE: 45,
    CueId.CADENCE_LOW: 30,
    CueId.OVERSTRIDING: 40,
    CueId.DISTANCE_REMAINING: 60,
    CueId.KM_SPLIT: 0,       # fires once per km boundary, gated by split index
    CueId.INTERVAL_WORK: 0,
    CueId.INTERVAL_REST: 0,
    CueId.HALFWAY: 9_999,    # once
    CueId.FINISH: 9_999,     # once
    CueId.ENCOURAGE: 120,
}

# How far off target pace (fraction) before we correct. 0.05 = 5%.
PACE_TOLERANCE = 0.05
# Good running cadence is ~170–185 spm; below this we nudge.
MIN_CADENCE_SPM = 165
# Overstriding heuristic: long stride at low cadence for current speed.
OVERSTRIDE_CADENCE_SPM = 155


@dataclass
class RunnerState:
    """A live snapshot emitted by the client roughly once per second."""
    elapsed_s: float
    distance_m: float
    pace_s_per_km: float          # instantaneous / smoothed pace
    cadence_spm: float            # steps per minute
    mode: str = "free"            # free | interval | tempo | long
    activity: str = "run"         # run | walk | hike | ride
    target_pace_s_per_km: float | None = None
    target_distance_m: float | None = None
    # interval mode: current phase + seconds remaining in phase
    interval_phase: str | None = None      # "work" | "rest"
    interval_phase_remaining_s: float | None = None
    interval_phase_changed: bool = False


@dataclass
class Cue:
    id: CueId
    reason: str
    params: dict = field(default_factory=dict)  # e.g. {"meters": 500} or {"km": 3}


@dataclass
class CoachMemory:
    """Carries state between ticks (last time each cue fired, splits announced)."""
    last_fired_s: dict = field(default_factory=dict)
    splits_announced: int = 0
    halfway_done: bool = False

    def can_fire(self, cue: CueId, now_s: float) -> bool:
        last = self.last_fired_s.get(cue)
        if last is None:
            return True
        return (now_s - last) >= COOLDOWN_S[cue]

    def mark(self, cue: CueId, now_s: float) -> None:
        self.last_fired_s[cue] = now_s


def _pace_ratio(state: RunnerState) -> float | None:
    if not state.target_pace_s_per_km or state.pace_s_per_km <= 0:
        return None
    # >1 means slower than target (bigger s/km), <1 means faster.
    return state.pace_s_per_km / state.target_pace_s_per_km


def evaluate(state: RunnerState, mem: CoachMemory) -> Cue | None:
    """Return the single highest-priority eligible cue, or None. Mutates `mem`."""
    now = state.elapsed_s
    candidates: list[Cue] = []

    # ── Finish ──────────────────────────────────────────────────────────────
    if (
        state.target_distance_m
        and state.distance_m >= state.target_distance_m
        and mem.can_fire(CueId.FINISH, now)
    ):
        candidates.append(Cue(CueId.FINISH, "reached target distance"))

    # ── Interval phase changes ──────────────────────────────────────────────
    if state.mode == "interval" and state.interval_phase_changed and state.interval_phase:
        cue = CueId.INTERVAL_WORK if state.interval_phase == "work" else CueId.INTERVAL_REST
        candidates.append(Cue(cue, f"interval phase -> {state.interval_phase}"))

    # ── Pace correction ─────────────────────────────────────────────────────
    ratio = _pace_ratio(state)
    if ratio is not None:
        if ratio > 1 + PACE_TOLERANCE and mem.can_fire(CueId.SPEED_UP, now):
            candidates.append(
                Cue(CueId.SPEED_UP, f"pace {ratio:.2f}x target (too slow)")
            )
        elif ratio < 1 - PACE_TOLERANCE and mem.can_fire(CueId.SLOW_DOWN, now):
            candidates.append(
                Cue(CueId.SLOW_DOWN, f"pace {ratio:.2f}x target (too fast)")
            )
        elif abs(ratio - 1) <= PACE_TOLERANCE and mem.can_fire(CueId.ON_PACE, now):
            candidates.append(Cue(CueId.ON_PACE, "holding target pace"))

    # ── Form: cadence / overstriding (running only) ─────────────────────────
    if state.activity == "run":
        if 0 < state.cadence_spm < OVERSTRIDE_CADENCE_SPM and state.pace_s_per_km < 360:
            # moving reasonably fast but with a very low cadence => long strides
            if mem.can_fire(CueId.OVERSTRIDING, now):
                candidates.append(
                    Cue(CueId.OVERSTRIDING, f"cadence {state.cadence_spm:.0f} spm w/ speed")
                )
        elif 0 < state.cadence_spm < MIN_CADENCE_SPM and mem.can_fire(CueId.CADENCE_LOW, now):
            candidates.append(
                Cue(CueId.CADENCE_LOW, f"cadence {state.cadence_spm:.0f} spm below target")
            )

    # ── Km split announcements ──────────────────────────────────────────────
    completed_km = int(state.distance_m // 1000)
    if completed_km > mem.splits_announced:
        mem.splits_announced = completed_km
        candidates.append(
            Cue(CueId.KM_SPLIT, f"km {completed_km} complete", {"km": completed_km})
        )

    # ── Distance remaining milestones ───────────────────────────────────────
    if state.target_distance_m:
        remaining = state.target_distance_m - state.distance_m
        # announce at the 1km, 500m and 200m-to-go marks
        for mark in (1000, 500, 200):
            if 0 < remaining <= mark and mem.can_fire(CueId.DISTANCE_REMAINING, now):
                # snap to a clean spoken number
                spoken = 1000 if remaining > 700 else (500 if remaining > 350 else 200)
                candidates.append(
                    Cue(
                        CueId.DISTANCE_REMAINING,
                        f"{remaining:.0f}m remaining",
                        {"meters": spoken},
                    )
                )
                break

        # halfway
        if (
            not mem.halfway_done
            and state.distance_m >= state.target_distance_m / 2
        ):
            mem.halfway_done = True
            candidates.append(Cue(CueId.HALFWAY, "halfway point"))

    if not candidates:
        return None

    winner = max(candidates, key=lambda c: PRIORITY[c.id])
    mem.mark(winner.id, now)
    return winner


def summarise(route: list[dict], target_pace_s_per_km: float | None = None) -> dict:
    """Post-run summary from the recorded route time series."""
    if not route:
        return {"distance_m": 0, "duration_s": 0, "avg_pace_s_per_km": 0,
                "avg_cadence_spm": 0, "splits": []}

    distance_m = route[-1].get("distance_m", 0.0)
    duration_s = route[-1].get("t", 0.0) - route[0].get("t", 0.0)
    cadences = [p["cad"] for p in route if p.get("cad")]
    avg_cadence = sum(cadences) / len(cadences) if cadences else 0.0
    avg_pace = (duration_s / (distance_m / 1000)) if distance_m > 0 else 0.0

    # per-km splits
    splits = []
    km = 1
    last_t = route[0].get("t", 0.0)
    for p in route:
        if p.get("distance_m", 0) >= km * 1000:
            split_s = p["t"] - last_t
            splits.append({"km": km, "duration_s": round(split_s, 1),
                           "pace_s_per_km": round(split_s, 1)})
            last_t = p["t"]
            km += 1

    return {
        "distance_m": round(distance_m, 1),
        "duration_s": round(duration_s, 1),
        "avg_pace_s_per_km": round(avg_pace, 1),
        "avg_cadence_spm": round(avg_cadence, 1),
        "splits": splits,
        "on_target": (
            None if not target_pace_s_per_km
            else abs(avg_pace - target_pace_s_per_km) / target_pace_s_per_km <= PACE_TOLERANCE
        ),
    }
