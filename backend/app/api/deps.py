"""
Dependencias de autenticación y contexto de tenant.

  CurrentUser   → usuario autenticado (cookie del panel o Bearer de la app).
  StaffContext  → usuario + club activo + roles leídos de la base (no del token).
  require(...)  → StaffContext que además exige permisos (domain/permissions.py).
  MemberContext → usuario socio APPROVED del club indicado en la URL (app mobile).

Cada una fija el contexto de RLS de la transacción del request.
"""

from collections.abc import Callable, Coroutine
from dataclasses import dataclass
from typing import Annotated, Any
from uuid import UUID

from fastapi import Depends, Path, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session, set_tenant_context
from app.core.errors import Forbidden, Unauthorized
from app.core.logging import club_id_var, user_id_var
from app.core.security import AccessClaims, decode_access_token
from app.domain.enums import MembershipStatus, StaffStatus
from app.domain.permissions import Permission, permissions_for
from app.models import AuthSession, Club, ClubMembership, ClubStaff, User

ACCESS_COOKIE = "cs_access"
REFRESH_COOKIE = "cs_refresh"
# Con auth por cookie, toda mutación debe traer este header. Un sitio ajeno no puede
# agregarlo sin pasar por CORS, que solo admite los orígenes configurados (anti-CSRF).
CSRF_HEADER = "x-requested-with"
CSRF_VALUE = "clubsystem"
_SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}

SessionDep = Annotated[AsyncSession, Depends(get_session, scope="function")]


@dataclass(frozen=True)
class AuthContext:
    user: User
    claims: AccessClaims


@dataclass(frozen=True)
class StaffContext:
    user: User
    club: Club
    roles: list[str]
    permissions: frozenset[Permission]

    @property
    def club_id(self) -> UUID:
        return self.club.id

    @property
    def user_id(self) -> UUID:
        return self.user.id


@dataclass(frozen=True)
class MemberContext:
    user: User
    club: Club
    membership: ClubMembership


def _extract_token(request: Request) -> str:
    header = request.headers.get("authorization", "")
    if header.lower().startswith("bearer "):
        return header[7:].strip()
    cookie = request.cookies.get(ACCESS_COOKIE)
    if cookie:
        if request.method not in _SAFE_METHODS and request.headers.get(CSRF_HEADER) != CSRF_VALUE:
            raise Forbidden("Falta el header anti-CSRF.", code="csrf")
        return cookie
    raise Unauthorized("Necesitás iniciar sesión.")


async def get_auth(request: Request, session: SessionDep) -> AuthContext:
    claims = decode_access_token(_extract_token(request))
    if claims is None:
        raise Unauthorized("La sesión expiró o es inválida.", code="token_invalid")

    user = await session.get(User, claims.user_id)
    if user is None or not user.is_active or user.token_version != claims.token_version:
        raise Unauthorized("La sesión ya no es válida.", code="token_revoked")
    auth_session = await session.get(AuthSession, claims.session_id)
    if auth_session is None or auth_session.revoked_at is not None:
        raise Unauthorized("La sesión fue cerrada.", code="token_revoked")

    await set_tenant_context(session, user_id=user.id, user_email=user.email)
    user_id_var.set(str(user.id))
    return AuthContext(user=user, claims=claims)


AuthDep = Annotated[AuthContext, Depends(get_auth)]


async def get_current_user(auth: AuthDep) -> User:
    return auth.user


CurrentUser = Annotated[User, Depends(get_current_user)]


async def get_staff_context(auth: AuthDep, session: SessionDep) -> StaffContext:
    club_id = auth.claims.club_id
    if auth.claims.client != "web" or club_id is None:
        raise Forbidden("Esta acción requiere una sesión del panel con un club activo.")

    row = (
        await session.execute(
            select(ClubStaff, Club)
            .join(Club, Club.id == ClubStaff.club_id)
            .where(
                ClubStaff.club_id == club_id,
                ClubStaff.user_id == auth.user.id,
                ClubStaff.status == StaffStatus.ACTIVE,
            )
        )
    ).one_or_none()
    if row is None:
        raise Forbidden("Ya no tenés acceso a este club.", code="staff_revoked")
    staff, club = row
    if not club.is_active:
        raise Forbidden("La suscripción del club está inactiva.", code="club_inactive")

    await set_tenant_context(session, club_id=club.id)
    club_id_var.set(str(club.id))
    return StaffContext(
        user=auth.user, club=club, roles=list(staff.roles), permissions=permissions_for(staff.roles)
    )


Staff = Annotated[StaffContext, Depends(get_staff_context)]


def require(*needed: Permission) -> Callable[..., Coroutine[Any, Any, StaffContext]]:
    async def _check(ctx: Staff) -> StaffContext:
        missing = [p for p in needed if p not in ctx.permissions]
        if missing:
            raise Forbidden("No tenés permiso para esta acción.")
        return ctx

    return _check


async def get_member_context(
    auth: AuthDep, session: SessionDep, club_id: Annotated[UUID, Path()]
) -> MemberContext:
    row = (
        await session.execute(
            select(ClubMembership, Club)
            .join(Club, Club.id == ClubMembership.club_id)
            .where(
                ClubMembership.club_id == club_id,
                ClubMembership.user_id == auth.user.id,
                ClubMembership.status == MembershipStatus.APPROVED,
                Club.is_active.is_(True),
            )
        )
    ).one_or_none()
    if row is None:
        raise Forbidden("No sos socio de este club.", code="not_a_member")
    membership, club = row
    await set_tenant_context(session, club_id=club.id)
    club_id_var.set(str(club.id))
    return MemberContext(user=auth.user, club=club, membership=membership)


Member = Annotated[MemberContext, Depends(get_member_context)]
