from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="SB_", env_file=".env", extra="ignore")

    processors_upstream_url: str = ("https://configuration.copernicus.eu/rest/api/baseline/processors-releases")
    processors_timeout_seconds: float = 20.0
    processors_cache_ttl_seconds: int = 3600

    # Proxy-first default: keep CORS disabled when frontend uses Next.js rewrites.
    enable_cors: bool = False
    cors_allow_origins: str = ""
    cors_allow_methods: str = "GET,OPTIONS"
    cors_allow_headers: str = "*"
    cors_allow_credentials: bool = False

    @staticmethod
    def _parse_csv(value: str) -> list[str]:
        return [item.strip() for item in value.split(",") if item.strip()]

    @property
    def cors_allow_origins_list(self) -> list[str]:
        return self._parse_csv(self.cors_allow_origins)

    @property
    def cors_allow_methods_list(self) -> list[str]:
        return self._parse_csv(self.cors_allow_methods)

    @property
    def cors_allow_headers_list(self) -> list[str]:
        return self._parse_csv(self.cors_allow_headers)

settings = Settings()