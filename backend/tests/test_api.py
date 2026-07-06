"""API smoke tests against the FastAPI app using an in-memory sqlite DB."""
from datetime import datetime, timezone

import pytest
from httpx import ASGITransport, AsyncClient

from app.database import init_models
from app.main import app


_DB_READY = False


async def _client() -> AsyncClient:
    global _DB_READY
    if not _DB_READY:
        await init_models()
        _DB_READY = True
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


@pytest.mark.asyncio
async def test_health():
    async with await _client() as c:
        r = await c.get("/health")
        assert r.status_code == 200 and r.json()["status"] == "ok"


@pytest.mark.asyncio
async def test_manifest_and_resolve():
    async with await _client() as c:
        r = await c.get("/phrases/manifest")
        assert r.status_code == 200 and "phrases" in r.json()
        r = await c.get("/phrases/resolve", params={"cue": "on_pace", "dialect": "ga"})
        assert r.status_code == 200 and r.json()["dialect"] == "ga"


@pytest.mark.asyncio
async def test_evaluate_endpoint_roundtrips_memory():
    async with await _client() as c:
        body = {
            "elapsed_s": 60, "distance_m": 300, "pace_s_per_km": 400,
            "cadence_spm": 175, "dialect": "twi",
            "target_pace_s_per_km": 330, "memory": {},
        }
        r = await c.post("/coaching/evaluate", json=body)
        assert r.status_code == 200
        data = r.json()
        assert data["cue"] == "speed_up"
        assert data["audio"]["urls"]
        # feeding memory back should suppress the repeat within cooldown
        body["elapsed_s"] = 61
        body["memory"] = data["memory"]
        r2 = await c.post("/coaching/evaluate", json=body)
        assert r2.json()["cue"] is None


@pytest.mark.asyncio
async def test_run_sync_is_idempotent():
    async with await _client() as c:
        run = {
            "client_id": "test-run-xyz",
            "mode": "tempo", "dialect": "twi",
            "target_pace_s_per_km": 330,
            "started_at": datetime.now(timezone.utc).isoformat(),
            "route": [
                {"t": 0, "distance_m": 0, "cad": 170},
                {"t": 300, "distance_m": 1000, "cad": 174},
            ],
            "cues": [],
        }
        r1 = await c.post("/runs", json=run)
        r2 = await c.post("/runs", json=run)
        assert r1.status_code == 201
        assert r1.json()["id"] == r2.json()["id"]  # same row, not a duplicate
