"""Contraseñas (bcrypt), access tokens (JWT HS256) y tokens opacos (refresh, un solo uso)."""

import hashlib
import secrets
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Literal
from uuid import UUID

import bcrypt
import jwt
from starlette.concurrency import run_in_threadpool

from app.core.config import get_settings

BCRYPT_ROUNDS = 12
MAX_PASSWORD_BYTES = 72  # límite de bcrypt
_JWT_ALGORITHM = "HS256"

# Hash de una contraseña aleatoria: se verifica contra él cuando el usuario no existe,
# para que el tiempo de respuesta no revele si el email está registrado.
_DUMMY_HASH = bcrypt.hashpw(secrets.token_bytes(16), bcrypt.gensalt(BCRYPT_ROUNDS)).decode()


async def hash_password(plain: str) -> str:
    # bcrypt es CPU-bound (~250 ms): fuera del event loop.
    hashed = await run_in_threadpool(bcrypt.hashpw, plain.encode(), bcrypt.gensalt(BCRYPT_ROUNDS))
    return hashed.decode()


async def verify_password(plain: str, hashed: str | None) -> bool:
    target = (hashed or _DUMMY_HASH).encode()
    encoded = plain.encode()
    if len(encoded) > MAX_PASSWORD_BYTES:
        return False
    ok = await run_in_threadpool(bcrypt.checkpw, encoded, target)
    return ok and hashed is not None


ClientKind = Literal["web", "mobile"]


@dataclass(frozen=True)
class AccessClaims:
    user_id: UUID
    token_version: int
    session_id: UUID
    client: ClientKind
    club_id: UUID | None


def create_access_token(claims: AccessClaims) -> str:
    settings = get_settings()
    now = datetime.now(UTC)
    payload: dict[str, object] = {
        "sub": str(claims.user_id),
        "ver": claims.token_version,
        "sid": str(claims.session_id),
        "cli": claims.client,
        "typ": "access",
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=settings.ACCESS_TOKEN_TTL_MINUTES)).timestamp()),
    }
    if claims.club_id:
        payload["club"] = str(claims.club_id)
    return jwt.encode(payload, settings.JWT_SECRET_KEY.get_secret_value(), _JWT_ALGORITHM)


def decode_access_token(token: str) -> AccessClaims | None:
    """Devuelve None si el token es inválido, expiró o no es un access token."""
    settings = get_settings()
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY.get_secret_value(),
            algorithms=[_JWT_ALGORITHM],
            options={"require": ["sub", "exp", "ver", "sid", "typ"]},
        )
        if payload["typ"] != "access" or payload.get("cli") not in ("web", "mobile"):
            return None
        return AccessClaims(
            user_id=UUID(payload["sub"]),
            token_version=int(payload["ver"]),
            session_id=UUID(payload["sid"]),
            client=payload["cli"],
            club_id=UUID(payload["club"]) if payload.get("club") else None,
        )
    except (jwt.PyJWTError, ValueError, KeyError):
        return None


def new_opaque_token() -> tuple[str, str]:
    """Token aleatorio para el cliente y su hash (lo único que se guarda)."""
    raw = secrets.token_urlsafe(32)
    return raw, hash_opaque_token(raw)


def hash_opaque_token(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()
