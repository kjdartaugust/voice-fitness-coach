"""RunTwi FastAPI application entrypoint."""
from __future__ import annotations

from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import get_settings
from app.database import init_models
from app.routers import coaching, phrases, plans, profiles, runs

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # create_all is idempotent (never drops), so it's safe to run on every boot.
    # This bootstraps the schema on a fresh Neon/Postgres DB with no manual step.
    # (Supabase deployments can instead run supabase/migrations/*.sql for RLS.)
    if settings.app_env != "test":
        try:
            await init_models()
        except Exception as exc:  # don't crash the app if the DB is briefly asleep
            import logging

            logging.getLogger("uvicorn.error").warning("init_models skipped: %s", exc)
    yield


app = FastAPI(
    title="RunTwi API",
    version="1.0.0",
    description="Local-language voice fitness coach — coaching engine, phrase bank, "
    "runs, plans. Cues are spoken in Twi, Ga and Ewe.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(profiles.router)
app.include_router(plans.router)
app.include_router(runs.router)
app.include_router(coaching.router)
app.include_router(phrases.router)

# Serve the built phrase-bank locally in dev (in prod this lives in Supabase Storage).
_phrasebank_build = Path(__file__).resolve().parents[2] / "phrasebank" / "build"
_phrasebank_build.mkdir(parents=True, exist_ok=True)
app.mount(
    "/static/phrasebank",
    StaticFiles(directory=str(_phrasebank_build)),
    name="phrasebank",
)


@app.get("/health", tags=["meta"])
async def health() -> dict:
    return {"status": "ok", "env": settings.app_env}


@app.get("/", tags=["meta"])
async def root() -> dict:
    return {"service": "RunTwi API", "docs": "/docs"}
