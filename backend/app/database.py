from collections.abc import AsyncGenerator
from urllib.parse import urlsplit, urlunsplit, parse_qsl, urlencode

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from app.config import get_settings

settings = get_settings()


def _normalise_db_url(url: str) -> tuple[str, dict]:
    """Make a Postgres URL work with the asyncpg driver.

    Neon (and most managed Postgres) hand out libpq-style URLs like
    `postgresql://…?sslmode=require&channel_binding=require`. asyncpg does not
    understand those query params, so strip them and translate to connect_args.
    Also coerce the driver to `postgresql+asyncpg`.
    """
    connect_args: dict = {}
    if url.startswith("sqlite"):
        return url, connect_args

    if url.startswith("postgres://"):
        url = "postgresql://" + url[len("postgres://"):]
    if url.startswith("postgresql://"):
        url = "postgresql+asyncpg://" + url[len("postgresql://"):]

    parts = urlsplit(url)
    query = dict(parse_qsl(parts.query))
    sslmode = query.pop("sslmode", None)
    query.pop("channel_binding", None)  # libpq-only, asyncpg rejects it
    if sslmode and sslmode != "disable":
        connect_args["ssl"] = True
    url = urlunsplit(parts._replace(query=urlencode(query)))
    return url, connect_args


_db_url, _connect_args = _normalise_db_url(settings.database_url)

engine = create_async_engine(
    _db_url,
    echo=False,
    future=True,
    pool_pre_ping=True,   # survives Neon's idle-connection drops
    connect_args=_connect_args,
)

SessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with SessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


async def init_models() -> None:
    """Create tables for local sqlite/dev. Production uses SQL migrations."""
    from app import models  # noqa: F401 — register mappers

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
