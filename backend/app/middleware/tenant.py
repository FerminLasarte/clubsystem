"""
ClubSync — Tenant Middleware & Dependencies
============================================
Responsabilidades:
1. Extraer club_id del JWT en cada request autenticado.
2. Validar que el club exista y esté activo.
3. Inyectar `SET LOCAL app.current_club_id = '...'` en la sesión de
   PostgreSQL para que las Row-Level Security policies funcionen.
4. Exponer dependencias FastAPI reutilizables:
     - get_current_club_id  → UUID del club activo (+ RLS injection)
     - get_current_user_id  → UUID del usuario autenticado
     - get_current_role     → StaffRole string del JWT
     - require_role(...)    → Factory que lanza 403 si el rol no está permitido

Uso de require_role en un router:
    from app.middleware.tenant import require_role

    @router.delete("/{id}")
    async def delete_expense(
        id: UUID,
        club_id: UUID = Depends(get_current_club_id),
        _role: str   = Depends(require_role("OWNER")),
    ): ...

    # Multi-rol:
    _role: str = Depends(require_role("OWNER", "RESERVATIONS_MANAGER"))
"""

import logging
from typing import Optional
from uuid import UUID

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.responses import Response

from app.core.config import settings
from app.core.database import get_db

logger = logging.getLogger(__name__)

security = HTTPBearer(auto_error=False)

# ── Public paths that bypass tenant resolution ────────────────
PUBLIC_PATHS = {
    "/health",
    "/docs",
    "/openapi.json",
    "/api/v1/auth/login",
    "/api/v1/auth/register",
    "/api/v1/auth/switch-club",  # switch-club valida su propio token internamente
    "/api/v1/clubs",
}


# ─────────────────────────────────────────────────────────────
# Starlette Middleware (sets club_id on request.state early)
# ─────────────────────────────────────────────────────────────
class TenantMiddleware(BaseHTTPMiddleware):
    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        if request.url.path in PUBLIC_PATHS:
            return await call_next(request)

        token = _extract_bearer_token(request)
        if token:
            club_id = _decode_club_id(token)
            request.state.club_id = club_id
        else:
            request.state.club_id = None

        response = await call_next(request)
        return response


# ─────────────────────────────────────────────────────────────
# Dependency: get_current_club_id
# ─────────────────────────────────────────────────────────────
async def get_current_club_id(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> UUID:
    """
    Extrae, valida e inyecta club_id en la sesión de PostgreSQL.
    Usar en TODOS los routers protegidos.
    """
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )

    club_id = _decode_club_id(credentials.credentials)
    if club_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )

    await _assert_club_active(db, club_id)

    # Inyecta variable de sesión para Row-Level Security
    await db.execute(
        text("SELECT set_config('app.current_club_id', :club_id, true)"),
        {"club_id": str(club_id)},
    )

    return club_id


# ─────────────────────────────────────────────────────────────
# Dependency: get_current_user_id
# ─────────────────────────────────────────────────────────────
async def get_current_user_id(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> UUID:
    """Retorna el UUID del usuario autenticado (campo 'sub' del JWT)."""
    if credentials is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    payload = _decode_token(credentials.credentials)
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    return UUID(user_id)


# ─────────────────────────────────────────────────────────────
# Dependency: get_current_role
# ─────────────────────────────────────────────────────────────
async def get_current_role(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> str:
    """
    Retorna el StaffRole del JWT ('OWNER', 'RESERVATIONS_MANAGER', 'STOCK_MANAGER').
    Útil para lógica condicional dentro de un handler sin lanzar 403.
    """
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
        )
    payload = _decode_token(credentials.credentials)
    role = payload.get("role")
    if not role:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Role not found in token",
        )
    return role


# ─────────────────────────────────────────────────────────────
# Dependency factory: require_role
# ─────────────────────────────────────────────────────────────
def require_role(*allowed_roles: str):
    """
    Factory que devuelve una dependencia FastAPI.
    Lanza HTTP 403 si el rol del JWT no está en `allowed_roles`.

    Uso:
        @router.delete("/{id}")
        async def delete(
            _: str = Depends(require_role("OWNER")),
        ): ...
    """
    async def _check(
        credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    ) -> str:
        if credentials is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication required",
            )
        payload = _decode_token(credentials.credentials)
        role = payload.get("role")

        if not role or role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    f"Acceso denegado. Tu rol '{role}' no tiene permiso para esta acción. "
                    f"Roles requeridos: {list(allowed_roles)}"
                ),
            )
        return role

    return _check


# ─────────────────────────────────────────────────────────────
# Helpers (privados)
# ─────────────────────────────────────────────────────────────
def _extract_bearer_token(request: Request) -> Optional[str]:
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        return auth[7:]
    return None


def _decode_token(token: str) -> dict:
    try:
        return jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
        )
    except JWTError:
        return {}


def _decode_club_id(token: str) -> Optional[UUID]:
    payload = _decode_token(token)
    raw = payload.get("club_id")
    if not raw:
        return None
    try:
        return UUID(raw)
    except (ValueError, AttributeError):
        return None


async def _assert_club_active(db: AsyncSession, club_id: UUID) -> None:
    """Lanza 403 si el club no existe o está inactivo."""
    result = await db.execute(
        text("SELECT is_active FROM clubs WHERE id = :id"),
        {"id": str(club_id)},
    )
    row = result.fetchone()
    if not row:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Club not found",
        )
    if not row.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Club subscription is inactive",
        )
