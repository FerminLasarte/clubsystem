"""
Rate limiting por IP para endpoints sensibles (login, registro, reset).
El almacenamiento es en memoria del proceso: con varias réplicas, configurar un
storage compartido (Redis) vía `storage_uri` o limitar en el proxy.
"""

from slowapi import Limiter
from slowapi.util import get_remote_address

from app.core.config import get_settings

limiter = Limiter(key_func=get_remote_address)


def auth_limit() -> str:
    return get_settings().AUTH_RATE_LIMIT
