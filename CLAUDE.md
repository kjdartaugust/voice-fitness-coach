# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

RunTwi — a local-language voice fitness coach for runners in Ghana. It tracks pace/distance/cadence/splits
and speaks coaching cues in **Twi, Ga, and Ewe** by stitching pre-recorded native voice-actor audio
segments (not English TTS). Offline-first PWA + FastAPI backend.

## Commands

Backend (`backend/`):
```bash
python -m venv .venv && source .venv/Scripts/activate   # Windows Git Bash
pip install -r requirements.txt
uvicorn app.main:app --reload                # dev server → http://localhost:8000/docs
pytest                                       # all tests
pytest tests/test_coaching.py::test_speed_up_when_too_slow   # single test
```
Frontend (`frontend/`):
```bash
npm install
npm run dev        # → http://localhost:3000
npm test           # tracking math + cue scheduler
npm run build
```
Full stack: `docker compose up --build` (postgres:5432, redis:6379, backend:8000, frontend:3000).

**TLS gotcha (this machine):** pip/npm hit `CERTIFICATE_VERIFY_FAILED` behind the corporate proxy.
Use `pip install --use-feature=truststore` or set `SSL_CERT_FILE` to the system CA bundle; for npm use
`NODE_OPTIONS=--use-system-ca`.

## Architecture

**The coaching logic is duplicated by design** in two places that must stay in sync:
- `backend/app/services/coaching_engine.py` (Python) — authoritative rules + post-run `summarise()`.
- `frontend/lib/coaching.ts` (TypeScript) — same rules, run client-side so cues fire with zero latency
  even with no signal. If you change cue thresholds/cooldowns/priorities in one, change both.

**Cue → audio flow:** the engine emits an abstract `Cue` (e.g. `SPEED_UP`, or parametric
`DISTANCE_REMAINING {meters:500}`). `services/phrase_bank.py` resolves it against
`phrasebank/manifest.json` into an ordered list of audio *segment* ids, which become URLs
(`{base}/{dialect}/{segment}.webm`). The client plays segments back-to-back to "stitch" a sentence.
Parametric cues expand a `_num` placeholder into number segments spoken in-dialect. `phrasebank/manifest.json`
is the single source of truth for dialect text, number words, and segment composition.

**Statelessness:** `/coaching/evaluate` is stateless — the client round-trips an opaque `memory` blob
(last-fired timestamps, splits announced, halfway flag) so cooldowns work without server session state.
`CoachMemory` (de)serialization lives in `routers/coaching.py`.

**Offline sync:** runs are captured entirely on-device and POSTed to `/runs` with a `client_id`
idempotency key, so retried syncs never duplicate. `models.Run` stores route/splits/cues as JSON.

**Auth:** `app/auth.py` verifies Supabase HS256 JWTs locally (no round-trip). With no `Authorization`
header in dev it falls back to `DEMO_USER_ID` so the app is runnable without wiring auth; in
`APP_ENV=production` a missing/invalid token is rejected.

**DB:** SQLAlchemy models in `app/models.py` mirror `backend/supabase/migrations/0001_init.sql` (Postgres +
RLS keyed on `auth.uid()`). Dev/tests use `sqlite+aiosqlite` and auto-create tables via `init_models()`;
production uses the SQL migrations. Keep the ORM models and the SQL migration in sync when schema changes.

## Voice / dialect changes

To add or fix a dialect phrase, edit `phrasebank/manifest.json` AND record the matching audio segment
per `docs/voice-recording-guide.md`. The manifest `segments` array defines how a cue is assembled;
`numbers`/`units` provide the reusable atoms for parametric cues.
