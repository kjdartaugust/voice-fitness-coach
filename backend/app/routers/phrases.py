"""Phrase-bank API: expose the manifest and resolve cues to audio for a dialect.

Clients pre-fetch the whole manifest at run start and cache it so every cue can be
stitched offline. Redis caches the manifest server-side.
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from app.services import phrase_bank

router = APIRouter(prefix="/phrases", tags=["phrases"])


@router.get("/manifest")
async def get_manifest() -> dict:
    return phrase_bank.load_manifest()


@router.get("/resolve")
async def resolve(
    cue: str,
    dialect: str = Query("twi", pattern="^(twi|ga|ewe)$"),
    meters: int | None = None,
    km: int | None = None,
) -> dict:
    params: dict = {}
    if meters is not None:
        params["meters"] = meters
    if km is not None:
        params["km"] = km
    try:
        return phrase_bank.audio_urls(cue, dialect, params)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
