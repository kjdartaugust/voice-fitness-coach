"""Unit tests for the coaching decision engine + phrase-bank stitching."""
from app.services.coaching_engine import (
    CoachMemory,
    CueId,
    RunnerState,
    evaluate,
    summarise,
)
from app.services import phrase_bank


def _state(**kw) -> RunnerState:
    base = dict(elapsed_s=100, distance_m=500, pace_s_per_km=330,
                cadence_spm=175, mode="free")
    base.update(kw)
    return RunnerState(**base)


def test_speed_up_when_too_slow():
    mem = CoachMemory()
    cue = evaluate(_state(pace_s_per_km=380, target_pace_s_per_km=330), mem)
    assert cue and cue.id == CueId.SPEED_UP


def test_slow_down_when_too_fast():
    mem = CoachMemory()
    cue = evaluate(_state(pace_s_per_km=290, target_pace_s_per_km=330), mem)
    assert cue and cue.id == CueId.SLOW_DOWN


def test_on_pace_when_within_tolerance():
    mem = CoachMemory()
    cue = evaluate(_state(pace_s_per_km=332, target_pace_s_per_km=330), mem)
    assert cue and cue.id == CueId.ON_PACE


def test_cooldown_suppresses_repeat():
    mem = CoachMemory()
    s = _state(pace_s_per_km=380, target_pace_s_per_km=330)
    first = evaluate(s, mem)
    # one second later — still within cooldown
    second = evaluate(_state(elapsed_s=101, pace_s_per_km=380,
                             target_pace_s_per_km=330), mem)
    assert first.id == CueId.SPEED_UP
    assert second is None


def test_cadence_low_cue():
    mem = CoachMemory()
    cue = evaluate(_state(cadence_spm=150, pace_s_per_km=500), mem)
    assert cue and cue.id == CueId.CADENCE_LOW


def test_km_split_fires_once_per_km():
    mem = CoachMemory()
    c1 = evaluate(_state(distance_m=1000), mem)
    c2 = evaluate(_state(elapsed_s=110, distance_m=1050), mem)
    assert c1 and c1.id == CueId.KM_SPLIT and c1.params["km"] == 1
    assert c2 is None or c2.id != CueId.KM_SPLIT


def test_finish_has_priority():
    mem = CoachMemory()
    cue = evaluate(
        _state(distance_m=5000, target_distance_m=5000,
               pace_s_per_km=400, target_pace_s_per_km=330),
        mem,
    )
    assert cue and cue.id == CueId.FINISH


def test_distance_remaining_params():
    mem = CoachMemory()
    mem.splits_announced = 4  # km 4 already announced, isolate the distance cue
    cue = evaluate(_state(distance_m=4600, target_distance_m=5000), mem)
    assert cue and cue.id == CueId.DISTANCE_REMAINING
    assert cue.params["meters"] in (200, 500, 1000)


def test_phrase_bank_resolves_static_cue():
    out = phrase_bank.audio_urls("speed_up", "twi", {})
    assert out["segments"] == ["speed_up"]
    assert out["urls"][0].endswith("/twi/speed_up.webm")
    assert out["caption"]


def test_phrase_bank_resolves_parametric_number():
    out = phrase_bank.audio_urls("distance_remaining", "ewe", {"meters": 500})
    assert "500" in out["segments"]
    assert out["segments"][-1] == "remaining"
    assert any("/ewe/500." in u for u in out["urls"])


def test_summarise_computes_splits():
    route = [
        {"t": 0, "distance_m": 0, "cad": 170},
        {"t": 300, "distance_m": 1000, "cad": 172},
        {"t": 600, "distance_m": 2000, "cad": 174},
    ]
    s = summarise(route, target_pace_s_per_km=300)
    assert s["distance_m"] == 2000
    assert len(s["splits"]) == 2
    assert s["avg_cadence_spm"] > 0
