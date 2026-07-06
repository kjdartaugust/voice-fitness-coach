# RunTwi — Local-Language Voice Fitness Coach for Ghana 🇬🇭🏃🏾

Real-time running coach that tracks pace, distance, cadence and splits, and speaks
coaching cues in **Twi, Ga, and Ewe** — not English TTS. Runs offline; syncs when back online.

> "Yɛ ntɛm" (speed up) · "Wo so bɔ yie" (you're on pace) · "500m aka" (500m left)

---

## Why this stack

| Concern | Choice | Justification |
|---|---|---|
| Mobile app | **Next.js 15 PWA** (installable) | Deployable to any browser instantly, no app-store gate, works on the low/mid Android phones common in Ghana. Uses the Geolocation, DeviceMotion, Wake Lock, Web Audio and Background Sync APIs. |
| True background GPS | **Expo/React Native** (documented migration path in `/docs/native-migration.md`) | Browsers throttle GPS when the screen is off. For a v2 with screen-off tracking, the tracking/coaching engine (`lib/`) is written framework-agnostic so it ports to Expo `expo-location` + `expo-sensors` with no logic changes. |
| Backend | **FastAPI** (Dockerized) | Async, OpenAPI out of the box, ideal for the phrase-bank + coaching endpoints. |
| Data/Auth/Storage | **Supabase** (Postgres + Auth + Storage) | Managed Postgres with RLS, JWT auth reused by FastAPI, Storage buckets host the voice phrase-bank audio. |
| Sessions/cache | **Redis** | Live-run session state + phrase-manifest caching + rate limits. |
| Voice | **Native phrase-bank** pipeline + Coqui TTS eval | No production-grade Twi/Ga/Ewe neural TTS exists yet, so we record native voice-actor phrases and **stitch** them dynamically. Coqui is evaluated as a future path (`/docs/tts-eval.md`). |

**Recommendation:** ship the PWA now (this repo), and use it to validate coaching UX + the
phrase bank with real runners; graduate to the Expo native shell for screen-off battery-efficient
GPS once product-market fit is shown. The domain logic does not change.

---

## Monorepo layout

```
voice-fitness-coach/
├── backend/            FastAPI service (coaching engine, phrase bank, runs, plans)
│   ├── app/
│   │   ├── routers/    auth, runs, plans, phrases, coaching
│   │   ├── services/   coaching_engine, phrase_bank
│   │   └── ...
│   ├── supabase/       SQL migrations + seed data
│   └── tests/
├── frontend/           Next.js 15 PWA (install, track, coach, offline sync)
│   ├── app/            App Router pages
│   ├── lib/            framework-agnostic tracking + coaching + audio + sync
│   └── public/         manifest, service worker, phrase-bank fallback audio
├── phrasebank/         recording scripts, manifest schema, segmentation pipeline
├── docs/               native migration, TTS eval, voice-recording guide
├── docker-compose.yml  postgres + redis + backend + frontend
└── .github/workflows/  CI (lint, test, build) + CD (deploy)
```

## Quick start (local, Docker)

```bash
cp .env.example .env          # fill in Supabase keys (or use the bundled Postgres)
docker compose up --build     # backend :8000, frontend :3000, postgres :5432, redis :6379
# API docs:  http://localhost:8000/docs
# App:       http://localhost:3000
```

## Quick start (without Docker)

```bash
# backend
cd backend && python -m venv .venv && . .venv/Scripts/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
alembic upgrade head   # or: psql < supabase/migrations/0001_init.sql
uvicorn app.main:app --reload

# frontend
cd frontend && npm install && npm run dev
```

## Deploy

The whole stack runs on **free tiers**: Neon (Postgres), Render (FastAPI), Vercel (Next.js).

### Live URLs

| Layer | URL |
|---|---|
| Frontend (Vercel) | _pending first deploy_ |
| Backend (Render) | _pending first deploy_ |
| Database (Neon)   | _pending — host `ep-xxxx-pooler.<region>.aws.neon.tech`_ |

> These are filled in once the three services are live. `NEXT_PUBLIC_API_URL` (frontend)
> must equal the backend URL, and `CORS_ORIGINS` (backend) must include the frontend URL.

### First-time deploy (reproducible from this repo + `.env.example`)

**1 — Database (Neon, free):** create a project at [neon.tech](https://neon.tech) → copy the
**pooled** connection string (`...-pooler...`, `?sslmode=require`). The backend auto-translates
libpq params for asyncpg, so paste it verbatim as `DATABASE_URL`.

**2 — Backend (Render, free):** New → **Blueprint** → connect this GitHub repo. Render reads
[`render.yaml`](render.yaml) and provisions `runtwi-api` (Docker, Frankfurt). Set the `sync: false`
env vars in the dashboard:
- `DATABASE_URL` = the Neon pooled string from step 1
- `CORS_ORIGINS` = your Vercel URL (from step 3; a Render env change restarts the service, no rebuild)
- `SUPABASE_JWT_SECRET`, `PHRASEBANK_BASE_URL` = optional

The app creates its tables on boot (`init_models`) and survives a cold DB. Verify: `GET /health`.

**3 — Frontend (Vercel, free):**
```bash
cd frontend
vercel link                                          # once, to create the project
vercel env add NEXT_PUBLIC_API_URL production        # paste the Render backend URL
vercel --prod                                        # build bakes the API URL in
```
Then set `CORS_ORIGINS` on Render to the resulting Vercel URL.

### How to redeploy

- **Frontend:** `cd frontend && vercel --prod` (or push to `main` if Git integration is on).
  Changed an env var? `vercel env rm NEXT_PUBLIC_API_URL production` then re-add, then redeploy —
  `NEXT_PUBLIC_*` values are baked at build time.
- **Backend:** push to `main` (Render auto-deploys the Blueprint) or hit **Manual Deploy** in Render.
  Env-var-only changes just restart the service.
- **Database:** schema changes ship via `backend/supabase/migrations/*.sql`; the ORM auto-creates
  tables on boot for dev/first-run.

See [`docs/voice-recording-guide.md`](docs/voice-recording-guide.md) to record a new dialect.

## Tests

```bash
cd backend && pytest              # coaching engine + phrase stitching + API
cd frontend && npm test           # tracking math + cue scheduler
```

## License

MIT
