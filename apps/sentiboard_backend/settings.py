from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="SB_", env_file=".env", extra="ignore")

    processors_upstream_url: str = ("https://configuration.copernicus.eu/rest/api/baseline/processors-releases")
    processors_timeout_seconds: float = 20.0
    processors_cache_ttl_seconds: int = 3600

settings = Settings()