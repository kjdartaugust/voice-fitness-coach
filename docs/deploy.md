# Deploy guide

Three pieces: **Supabase** (DB/Auth/Storage), **backend** (FastAPI container), and
**frontend** (Next.js PWA).

## 1. Supabase
1. Create a project at supabase.com. Note the URL, anon key, service-role key and (in
   Settings → API → JWT) the JWT secret.
2. SQL Editor → run `backend/supabase/migrations/0001_init.sql`, then optionally
   `backend/supabase/seed.sql`.
3. Storage → create a **public** bucket named `phrasebank`.
4. Auth → enable Email (and/or phone — phone OTP suits the Ghana market).

## 2. Phrase bank
```bash
cd phrasebank
python pipeline/generate_placeholders.py          # or record real audio (see voice guide)
export SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=...
python pipeline/upload.py --dialect twi
python pipeline/upload.py --dialect ga
python pipeline/upload.py --dialect ewe
```

## 3. Backend (container)
Any container host — Render, Fly.io, Railway, Cloud Run. Set env from `.env.example`
(`DATABASE_URL` → the Supabase Postgres connection string with `+asyncpg`,
`SUPABASE_JWT_SECRET`, `REDIS_URL`, `APP_ENV=production`, `CORS_ORIGINS` → your app URL,
`PHRASEBANK_BASE_URL` → the Supabase public bucket URL).
```bash
docker build -t runtwi-api backend/
docker run -p 8000:8000 --env-file .env runtwi-api
```
Health check: `GET /health`. API docs: `/docs`.

## 4. Frontend (Vercel)
```bash
cd frontend
vercel --prod
```
Set env in the Vercel dashboard: `NEXT_PUBLIC_API_URL` (your backend URL),
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`NEXT_PUBLIC_PHRASEBANK_BASE_URL`. Vercel serves it over HTTPS, which the PWA (service
worker, geolocation, motion sensors, wake lock) requires.

## Notes
- **HTTPS is mandatory** for the sensor APIs — test on a phone over https, not http.
- Redis: use the host's managed Redis or Upstash; set `REDIS_URL`.
- The CI workflow (`.github/workflows/ci.yml`) runs tests + build on every push; wire the
  deploy job's secrets (`VERCEL_TOKEN`, container-host token) to auto-deploy `main`.
