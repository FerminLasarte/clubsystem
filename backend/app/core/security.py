"""
ClubSync — Security Utilities
==============================
Centraliza todas las operaciones criptográficas de la aplicación:
  - Hashing y verificación de contraseñas con bcrypt (via passlib).
  - Generación de JWT firmados con HS256.

Por qué passlib sobre bcrypt directo:
  - CryptContext abstrae el esquema de hashing → migración futura sin tocar código.
  - `deprecated="auto"` re-hashea contraseñas antiguas en el próximo login.
  - API idéntica independientemente del backend (bcrypt, argon2, scrypt).
"""

from datetime import datetime, timedelta, timezone
from uuid import UUID

from jose import jwt
from passlib.context import CryptContext

from app.core.config import settings

# ── Password Hashing ──────────────────────────────────────────
# bcrypt como único esquema activo.
# `deprecated="auto"` permite agregar argon2/scrypt en el futuro sin
# romper contraseñas existentes: las migra silenciosamente en el login.
_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(plain: str) -> str:
    """
    Hashea una contraseña en texto plano con bcrypt (12 rondas).
    Devuelve el hash listo para almacenar en la DB.
    """
    return _pwd_context.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    """
    Verifica una contraseña contra su hash bcrypt.
    Timing-safe: no revela si el hash es válido mediante timing attacks.
    """
    return _pwd_context.verify(plain, hashed)


# ── JWT ───────────────────────────────────────────────────────

def create_access_token(
    *,
    sub: str,
    club_id: UUID,
    role: str,
    email: str,
) -> str:
    """
    Genera un JWT firmado con HS256.

    Payload:
      sub     → ID del usuario (string UUID) — estándar RFC 7519
      club_id → UUID del club activo (string)
      role    → StaffRole: OWNER | RESERVATIONS_MANAGER | STOCK_MANAGER
      email   → email del operador (permite switch-club sin re-login)
      exp     → timestamp UTC de expiración (settings.JWT_EXPIRE_MINUTES)

    Args:
      sub:     ID del usuario como string.
      club_id: UUID del club activo.
      role:    Rol del operador en el club.
      email:   Email del operador.

    Returns:
      JWT firmado como string.
    """
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.JWT_EXPIRE_MINUTES)
    payload: dict[str, str | int] = {
        "sub":     sub,
        "club_id": str(club_id),
        "role":    role,
        "email":   email,
        "exp":     int(expire.timestamp()),
    }
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)
