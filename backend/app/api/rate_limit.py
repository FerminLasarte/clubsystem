"""
IP del cliente, para el rate limit y las sesiones; limitador por IP para endpoints sensibles
(login, registro, reset) y límite por identificador (email o usuario) que se suma al de IP.

De dónde sale la IP, en orden:
  1. Panel: llega a través del proxy de Next en Vercel, así que la conexión es de Vercel y
     la comparten muchos usuarios. El proxy manda la IP real en `CLIENT_IP_HEADER` junto con
     `PROXY_SHARED_SECRET`. Sin el secreto correcto, ese header se ignora.
  2. App mobile (y cualquier acceso directo): el header que fija el proxy de la plataforma
     (`TRUSTED_IP_HEADER`; en Railway, X-Real-IP, que su edge siempre sobrescribe). No se usa
     X-Forwarded-For: la plataforma agrega al final y conserva lo que mandó el cliente.
  3. Sin nada de eso (desarrollo): la IP de la conexión.

Los contadores van en memoria del proceso salvo que RATE_LIMIT_STORAGE_URI apunte a un Redis
compartido (necesario con varias instancias). Ojo: slowapi consulta el storage en forma
sincrónica; con Redis en la red privada de la plataforma es ~1 ms por request limitado.
Si Redis no responde, se sigue con contadores en memoria.

Límite por identificador (`limit_email`, `limit_user`): el de IP no frena a un atacante que
reparte los intentos contra una misma cuenta entre muchas IPs. Va en el handler porque la clave
sale del body. Primero corta el de IP (el decorador): un pedido que este rechaza no consume
intentos del email. Para no revelar si una cuenta existe:
  - se cuenta cada intento antes de buscar al usuario o verificar la contraseña, exista o no la
    cuenta y salga bien o mal; así el 429 sale sin tocar la base ni bcrypt, en el mismo tiempo;
  - el 429 es idéntico al del límite por IP;
  - en el storage queda un hash del email, no el email.
"""

import hashlib
import hmac
import ipaddress
import logging
from uuid import UUID

from limits import parse
from limits.storage import MemoryStorage
from limits.strategies import FixedWindowRateLimiter
from slowapi import Limiter
from slowapi.util import get_remote_address
from starlette.requests import Request

from app.core.config import get_settings
from app.core.errors import TooManyRequests
from app.core.security import normalize_email

logger = logging.getLogger(__name__)

CLIENT_IP_HEADER = "x-clubsystem-client-ip"
PROXY_SECRET_HEADER = "x-clubsystem-proxy-secret"  # noqa: S105 (nombre del header)


def _valid_ip(value: str | None) -> str | None:
    try:
        return str(ipaddress.ip_address((value or "").strip()))
    except ValueError:
        return None


def client_ip(request: Request) -> str:
    settings = get_settings()
    secret = settings.PROXY_SHARED_SECRET
    signed = secret is not None and hmac.compare_digest(
        request.headers.get(PROXY_SECRET_HEADER, "").encode(), secret.get_secret_value().encode()
    )
    if signed and (ip := _valid_ip(request.headers.get(CLIENT_IP_HEADER))):
        return ip
    header = settings.TRUSTED_IP_HEADER
    if header and (ip := _valid_ip(request.headers.get(header))):
        return ip
    return get_remote_address(request)


limiter = Limiter(
    key_func=client_ip,
    storage_uri=get_settings().RATE_LIMIT_STORAGE_URI,
    in_memory_fallback_enabled=True,
)


def auth_limit() -> str:
    return get_settings().AUTH_RATE_LIMIT


RATE_LIMITED_MESSAGE = "Demasiados intentos. Probá de nuevo en unos minutos."

# Respaldo si el storage compartido no responde (slowapi tiene el suyo para el límite por IP).
_fallback = FixedWindowRateLimiter(MemoryStorage())


def _limit_identifier(scope: str, identifier: str, limit: str) -> None:
    item = parse(limit)
    key = hashlib.sha256(identifier.encode()).hexdigest()
    backend = limiter.limiter
    try:
        allowed = backend.hit(item, "identifier", scope, key)
    except backend.storage.base_exceptions:
        logger.warning("Storage del rate limit inaccesible: límite por identificador en memoria")
        allowed = _fallback.hit(item, "identifier", scope, key)
    if not allowed:
        raise TooManyRequests(RATE_LIMITED_MESSAGE)


def limit_email(scope: str, email: str, limit: str) -> None:
    """Cuenta un intento para el email y responde 429 si se pasa de `limit`."""
    _limit_identifier(scope, normalize_email(email), limit)


def limit_user(scope: str, user_id: UUID, limit: str) -> None:
    """Cuenta un intento del usuario autenticado y responde 429 si se pasa de `limit`."""
    _limit_identifier(scope, str(user_id), limit)
