"""
IP del cliente, para el rate limit y las sesiones, y limitador por IP para endpoints sensibles
(login, registro, reset).

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
"""

import hmac
import ipaddress

from slowapi import Limiter
from slowapi.util import get_remote_address
from starlette.requests import Request

from app.core.config import get_settings

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
