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
    # Contadores del rate limit. memory:// alcanza con una sola instancia; con varias,
    # un Redis compartido de la plataforma, p. ej. redis://redis.railway.internal:6379.
    RATE_LIMIT_STORAGE_URI: str = "memory://"
    # Header con la IP del cliente que fija el proxy de la plataforma, pisando lo que mande el
    # cliente (Railway: x-real-ip). Sin él se usa la IP de la conexión.
    TRUSTED_IP_HEADER: str | None = None
    # Secreto compartido con el proxy de Next (Vercel), que manda la IP real del usuario
    # del panel (ver api/rate_limit.py). Obligatorio en producción.
    PROXY_SHARED_SECRET: SecretStr | None = None

    # Emails transaccionales (verificación, reset de contraseña, invitaciones).
    # console: solo desarrollo (loguea el cuerpo); disabled: no envía; resend: API de Resend.
    EMAIL_BACKEND: Literal["console", "disabled", "resend"] = "console"
    RESEND_API_KEY: SecretStr | None = None
    # Remitente con un dominio verificado en Resend, p. ej. "ClubSystem <no-reply@mail.club.com>".
    EMAIL_FROM: str | None = None
    EMAIL_TIMEOUT_SECONDS: float = 10.0
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

    @field_validator("RATE_LIMIT_STORAGE_URI")
    @classmethod
    def _known_storage(cls, value: str) -> str:
        if value.split("://", 1)[0] not in {"memory", "redis", "rediss"}:
            raise ValueError("RATE_LIMIT_STORAGE_URI tiene que ser memory://, redis:// o rediss://")
        return value

    @field_validator("TRUSTED_IP_HEADER")
    @classmethod
    def _header_name(cls, value: str | None) -> str | None:
        return value.strip().lower() or None if value else None

    @field_validator("PROXY_SHARED_SECRET")
    @classmethod
    def _strong_proxy_secret(cls, value: SecretStr | None) -> SecretStr | None:
        if value is None or not value.get_secret_value():
            return None  # vacío en el .env equivale a no configurado
        if len(value.get_secret_value()) < 32:
            raise ValueError("PROXY_SHARED_SECRET debe tener al menos 32 caracteres aleatorios")
        return value

    @model_validator(mode="after")
    def _safe_for_production(self) -> "Settings":
        if self.ENV == "production" and self.PROXY_SHARED_SECRET is None:
            # Sin él, todo el panel comparte la IP de Vercel en el rate limit.
            raise ValueError("En producción PROXY_SHARED_SECRET es obligatorio")
        if "*" in self.CORS_ORIGINS:
            raise ValueError("CORS_ORIGINS no puede ser '*' (las cookies de sesión van con CORS)")
        if self.ENV == "production" and self.EMAIL_BACKEND != "resend":
            # console loguea tokens de acceso; disabled deja sin verificación ni reset.
            raise ValueError('En producción EMAIL_BACKEND tiene que ser "resend"')
        if self.EMAIL_BACKEND == "resend":
            missing = [
                name
                for name, value in (
                    (
                        "RESEND_API_KEY",
                        self.RESEND_API_KEY and self.RESEND_API_KEY.get_secret_value(),
                    ),
                    ("EMAIL_FROM", self.EMAIL_FROM and self.EMAIL_FROM.strip()),
                )
                if not value
            ]
            if missing:
                raise ValueError(f"EMAIL_BACKEND=resend requiere {' y '.join(missing)}")
        return self

    @property
    def is_production(self) -> bool:
        return self.ENV == "production"


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]  # los valores vienen del entorno
