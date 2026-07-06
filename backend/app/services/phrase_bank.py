"""Phrase-bank resolver.

Turns an abstract Cue (from the coaching engine) into an ordered list of audio
*segments* for a given dialect. The client plays these back-to-back to "stitch" a
spoken sentence out of pre-recorded native voice-actor snippets — no neural TTS
required, which is the only reliable way to get quality Twi/Ga/Ewe today.

A segment resolves to a URL:  {base}/{dialect}/{segment}.{ext}
Parametric cues (km split, distance remaining) expand a "_num" placeholder into
number segments spoken in-dialect (e.g. 500 -> ["500"], or composed digits).
"""
from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

from app.config import get_settings

settings = get_settings()

MANIFEST_PATH = Path(__file__).resolve().parents[3] / "phrasebank" / "manifest.json"


@lru_cache
def load_manifest() -> dict:
    with open(MANIFEST_PATH, encoding="utf-8") as fh:
        return json.load(fh)


def _number_segments(value: int, manifest: dict) -> list[str]:
    """Resolve a number to segment ids, preferring whole-number recordings."""
    numbers = manifest["numbers"]
    key = str(value)
    if key in numbers:
        return [key]
    # compose from available atoms (hundreds + tens + units) — fallback path
    segs: list[str] = []
    remaining = value
    for atom in (1000, 500, 200, 10):
        while remaining >= atom and str(atom) in numbers:
            segs.append(str(atom))
            remaining -= atom
    for unit in range(remaining, 0, -1):
        if str(unit) in numbers:
            segs.append(str(unit))
            remaining -= unit
            break
    return segs or ["1"]


def resolve_segments(cue_id: str, params: dict, manifest: dict | None = None) -> list[str]:
    """Return the ordered segment ids for a cue in dialect-agnostic form."""
    manifest = manifest or load_manifest()
    phrases = manifest["phrases"]
    if cue_id not in phrases:
        raise KeyError(f"Unknown cue '{cue_id}'")

    entry = phrases[cue_id]
    segments: list[str] = []
    for seg in entry["segments"]:
        if seg == "_num":
            param_key = entry.get("parametric")
            value = int(params.get(param_key, 1))
            segments.extend(_number_segments(value, manifest))
        else:
            segments.append(seg)
    return segments


def dialect_text(cue_id: str, dialect: str, params: dict, manifest: dict | None = None) -> str:
    """Human-readable caption for the cue in the given dialect (subtitles/UI)."""
    manifest = manifest or load_manifest()
    entry = manifest["phrases"][cue_id]
    text = entry.get(dialect, cue_id)
    if entry.get("parametric") == "meters":
        return f"{params.get('meters', '')} {text}".strip()
    if entry.get("parametric") == "km":
        return f"{params.get('km', '')} {text}".strip()
    return text


def audio_urls(cue_id: str, dialect: str, params: dict) -> dict:
    """Full resolution for the client: ordered playable URLs + caption."""
    manifest = load_manifest()
    ext = manifest.get("audio_ext", "webm")
    segments = resolve_segments(cue_id, params, manifest)
    base = settings.phrasebank_base_url.rstrip("/")
    urls = [f"{base}/{dialect}/{seg}.{ext}" for seg in segments]
    return {
        "cue": cue_id,
        "dialect": dialect,
        "segments": segments,
        "urls": urls,
        "caption": dialect_text(cue_id, dialect, params, manifest),
    }
