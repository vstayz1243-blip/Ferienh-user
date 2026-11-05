from pathlib import Path
from functools import lru_cache

from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict

PROJECT_ROOT = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    hp_ical_141_url: SecretStr | None = None
    hp_ical_136_url: SecretStr | None = None
    cache_ttl_seconds: int = 60
    fetch_timeout_seconds: float = 12.0
    availability_range_months: int = 18
    max_ical_bytes: int = 5_000_000

    model_config = SettingsConfigDict(
        env_file=PROJECT_ROOT / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    def feed_url(self, house: str) -> str | None:
        secret = self.hp_ical_141_url if house == "141" else self.hp_ical_136_url
        return secret.get_secret_value() if secret else None


@lru_cache
def get_settings() -> Settings:
    return Settings()
