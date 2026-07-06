from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_env: str = "development"
    log_level: str = "info"
    cors_origins: str = "http://localhost:3000"

    # Database — defaults to a local sqlite file so the API boots with zero config
    # for tests/dev; docker-compose overrides with async Postgres.
    database_url: str = "sqlite+aiosqlite:///./runtwi.db"
    redis_url: str = "redis://localhost:6379/0"

    # Supabase auth
    supabase_url: str = ""
    supabase_jwt_secret: str = "dev-insecure-secret-change-me"
    supabase_service_role_key: str = ""

    # Phrase bank
    phrasebank_bucket: str = "phrasebank"
    phrasebank_base_url: str = "http://localhost:8000/static/phrasebank"

    @property
    def cors_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
