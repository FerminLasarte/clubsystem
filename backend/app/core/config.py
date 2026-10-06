"""Configuración de la aplicación, leída de variables de entorno (o `.env`)."""

from functools import lru_cache
from pathlib import Path
from typing import Annotated, Literal

from pydantic import Field, SecretStr, field_validator, model_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parents[2]

_KNOWN_WEAK_SECRETS = {"changeme", "secret", "dev-jwt-secret-change-in-production"}


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=BACKEND_DIR / ".env", env_file_encoding="utf-8", extra="ignore"
    )

    # Por defecto producción: docs apagados y validaciones estrictas salvo que se diga lo contrario.
    ENV: Literal["development", "test", "production"] = "production"
    LOG_LEVEL: str = "INFO"
    LOG_JSON: bool = False

    # Base de datos. La app se conecta con un rol sin ownership (sujeto a RLS);
    # las migraciones usan el rol dueño del esquema.
    DATABASE_URL: str
    MIGRATIONS_DATABASE_URL: str
    DB_APP_ROLE: str = "clubsystem_app"
    DB_POOL_SIZE: int = 10
    DB_MAX_OVERFLOW: int = 10
    DB_STATEMENT_TIMEOUT_MS: int = 15_000

    # Auth
    JWT_SECRET_KEY: SecretStr
    ACCESS_TOKEN_TTL_MINUTES: int = 15
    REFRESH_TOKEN_TTL_DAYS: int = 30
    COOKIE_SECURE: bool = True
    COOKIE_DOMAIN: str | None = None

    CORS_ORIGINS: Annotated[list[str], NoDecode] = Field(default_factory=list)

    # Rate limiting de endpoints de autenticación
    AUTH_RATE_LIMIT: str = "10/minute"

    # Emails transaccionales (verificación, reset de contraseña)
    EMAIL_BACKEND: Literal["console", "disabled"] = "console"
    PUBLIC_WEB_URL: str = "http://localhost:3000"

    # IA de anomalías (Anthropic)
    ANTHROPIC_API_KEY: SecretStr | None = None
    ANOMALY_MODEL: str = "claude-opus-5-5"
    ANOMALY_LLM_TIMEOUT_SECONDS: float = 20.0
    ANOMALY_LLM_DAILY_LIMIT_PER_CLUB: int = 200

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def _split_origins(cls, value: object) -> object:
        # Acepta "http://a,http://b" además de una lista.
        if isinstance(value, str):
            return [o.strip() for o in value.split(",") if o.strip()]
        return value

    @field_validator("JWT_SECRET_KEY")
    @classmethod
    def _strong_secret(cls, value: SecretStr) -> SecretStr:
        raw = value.get_secret_value()
        if len(raw) < 32 or raw.lower() in _KNOWN_WEAK_SECRETS:
            raise ValueError("JWT_SECRET_KEY debe tener al menos 32 caracteres aleatorios")
        return value

    @model_validator(mode="after")
    def _safe_for_production(self) -> "Settings":
        if "*" in self.CORS_ORIGINS:
            raise ValueError("CORS_ORIGINS no puede ser '*' (las cookies de sesión van con CORS)")
        if self.ENV == "production" and self.EMAIL_BACKEND == "console":
            raise ValueError(
                "EMAIL_BACKEND=console loguea tokens de acceso: en producción usá un proveedor real"
            )
        return self

    @property
    def is_production(self) -> bool:
        return self.ENV == "production"


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]  # los valores vienen del entorno
