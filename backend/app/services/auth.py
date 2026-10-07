"""
Autenticación: login (panel y app), sesiones con refresh rotativo, cambio de club,
registro, verificación de email y reset de contraseña.
"""

import logging
import uuid
from dataclasses import dataclass
from datetime import timedelta

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.db import session_scope, set_tenant_context
from app.core.errors import BusinessRuleViolation, Forbidden, Unauthorized
from app.core.security import (
    AccessClaims,
    ClientKind,
    create_access_token,
    hash_opaque_token,
    hash_password,
    new_opaque_token,
    normalize_email,
    verify_password,
)
from app.core.time import utcnow
from app.domain.enums import MembershipStatus, OneTimeTokenPurpose, StaffStatus
from app.models import AuthSession, Club, ClubMembership, ClubStaff, OneTimeToken, User
from app.schemas.auth import RegisterRequest
from app.services.email import send_email, web_link

logger = logging.getLogger(__name__)

_INVALID_CREDENTIALS = "Email o contraseña incorrectos."
_VERIFY_TTL = timedelta(days=2)
_RESET_TTL = timedelta(hours=1)
_ACCOUNT_SETUP_TTL = timedelta(days=7)


@dataclass(frozen=True)
class ClientInfo:
    user_agent: str | None
    ip: str | None


@dataclass(frozen=True)
class IssuedTokens:
    access_token: str
    refresh_token: str
    session: AuthSession


class AuthService:
    def __init__(self, session: AsyncSession) -> None:
        self.db = session

    # ── Credenciales ────────────────────────────────────────────────────────

    async def authenticate(self, email: str, password: str) -> User:
        """Email + contraseña. El mismo error y el mismo tiempo si el usuario no existe."""
        user = (
            await self.db.execute(select(User).where(User.email == normalize_email(email)))
        ).scalar_one_or_none()

        valid = await verify_password(password, user.password_hash if user else None)
        if user is None or not valid or not user.is_active:
            raise Unauthorized(_INVALID_CREDENTIALS, code="invalid_credentials")

        user.last_login_at = utcnow()
        await set_tenant_context(self.db, user_id=user.id)
        return user

    # ── Sesiones ────────────────────────────────────────────────────────────

    async def start_session(
        self,
        user: User,
        *,
        client: ClientKind,
        info: ClientInfo,
        club_id: uuid.UUID | None = None,
    ) -> IssuedTokens:
        return await self._issue(
            user, client=client, family_id=uuid.uuid4(), club_id=club_id, info=info
        )

    async def refresh(
        self, raw_token: str, *, client: ClientKind, info: ClientInfo
    ) -> tuple[User, IssuedTokens]:
        current = (
            await self.db.execute(
                select(AuthSession)
                .where(AuthSession.token_hash == hash_opaque_token(raw_token))
                .with_for_update()
            )
        ).scalar_one_or_none()
        if current is None:
            raise Unauthorized("Sesión inválida.", code="refresh_invalid")
        if current.rotated_at is not None or current.revoked_at is not None:
            # Un token ya usado vuelve a aparecer: posible robo. Se corta toda la familia en
            # una transacción aparte, porque la del request se revierte al responder 401.
            # La fila actual (bloqueada acá) ya está rotada o revocada: no hace falta tocarla.
            async with session_scope() as independent:
                await independent.execute(
                    update(AuthSession)
                    .where(
                        AuthSession.family_id == current.family_id,
                        AuthSession.id != current.id,
                        AuthSession.revoked_at.is_(None),
                    )
                    .values(revoked_at=utcnow())
                )
            logger.warning("Reuso de refresh token detectado (familia=%s)", current.family_id)
            raise Unauthorized("Sesión inválida.", code="refresh_reused")
        if current.expires_at <= utcnow():
            raise Unauthorized("La sesión expiró.", code="refresh_expired")

        user = await self.db.get(User, current.user_id)
        if user is None or not user.is_active:
            raise Unauthorized("Sesión inválida.", code="refresh_invalid")

        current.rotated_at = utcnow()
        await set_tenant_context(self.db, user_id=user.id)
        club_id = current.active_club_id
        if club_id and not await self._has_active_staff(user, club_id):
            club_id = None
        tokens = await self._issue(
            user, client=client, family_id=current.family_id, club_id=club_id, info=info
        )
        return user, tokens

    async def revoke(self, session_id: uuid.UUID) -> None:
        auth_session = await self.db.get(AuthSession, session_id)
        if auth_session is not None:
            await self._revoke_family(auth_session.family_id)

    async def revoke_all(self, user: User) -> None:
        user.token_version += 1
        await self.db.execute(
            update(AuthSession)
            .where(AuthSession.user_id == user.id, AuthSession.revoked_at.is_(None))
            .values(revoked_at=utcnow())
        )

    async def switch_club(self, user: User, session_id: uuid.UUID, club_id: uuid.UUID) -> str:
        if not await self._has_active_staff(user, club_id):
            raise Forbidden("No tenés acceso a ese club.")
        auth_session = await self.db.get(AuthSession, session_id)
        if auth_session is None or auth_session.revoked_at is not None:
            raise Unauthorized("La sesión fue cerrada.")
        auth_session.active_club_id = club_id
        return create_access_token(
            AccessClaims(
                user_id=user.id,
                token_version=user.token_version,
                session_id=auth_session.id,
                client="web",
                club_id=club_id,
            )
        )

    # ── Panel: clubes del staff ─────────────────────────────────────────────

    async def staff_clubs(self, user: User) -> list[tuple[ClubStaff, Club]]:
        rows = await self.db.execute(
            select(ClubStaff, Club)
            .join(Club, Club.id == ClubStaff.club_id)
            .where(
                ClubStaff.user_id == user.id,
                ClubStaff.status == StaffStatus.ACTIVE,
                Club.is_active.is_(True),
            )
            .order_by(Club.name)
        )
        return [(staff, club) for staff, club in rows.all()]

    @staticmethod
    def default_club(clubs: list[tuple[ClubStaff, Club]]) -> tuple[ClubStaff, Club]:
        """Club con el que arranca la sesión: el primero donde es OWNER, si no el primero."""
        return next(((s, c) for s, c in clubs if "OWNER" in s.roles), clubs[0])

    async def memberships(self, user: User) -> list[tuple[ClubMembership, Club]]:
        rows = await self.db.execute(
            select(ClubMembership, Club)
            .join(Club, Club.id == ClubMembership.club_id)
            .where(ClubMembership.user_id == user.id, Club.is_active.is_(True))
            .where(ClubMembership.status != MembershipStatus.INACTIVE)
            .order_by(Club.name)
        )
        return [(m, c) for m, c in rows.all()]

    # ── Registro y verificación de email ────────────────────────────────────

    async def register(self, data: RegisterRequest) -> User:
        user = User(
            email=normalize_email(data.email),
            password_hash=await hash_password(data.password),
            first_name=data.first_name,
            last_name=data.last_name,
            phone=data.phone,
            dni=data.dni,
            birth_date=data.birth_date,
            gender=data.gender,
        )
        self.db.add(user)
        await self.db.flush()  # dispara las constraints de unicidad acá (→ 409)
        await self.send_verification(user)
        return user

    async def send_verification(self, user: User) -> None:
        if user.email_verified:
            return
        raw = await self._new_one_time_token(user, OneTimeTokenPurpose.VERIFY_EMAIL, _VERIFY_TTL)
        await send_email(
            user.email,
            "Confirmá tu email",
            f"Hola {user.first_name}, confirmá tu email: {web_link(f'/verify-email?token={raw}')}",
        )

    async def verify_email(self, raw_token: str) -> None:
        token = await self._consume_one_time_token(raw_token, OneTimeTokenPurpose.VERIFY_EMAIL)
        user = await self.db.get(User, token.user_id)
        if user is not None and user.email_verified_at is None:
            user.email_verified_at = utcnow()

    # ── Reset de contraseña ─────────────────────────────────────────────────

    async def request_password_reset(self, email: str) -> None:
        """Siempre responde igual: no revela si el email existe."""
        user = (
            await self.db.execute(select(User).where(User.email == normalize_email(email)))
        ).scalar_one_or_none()
        if user is None or not user.is_active:
            return
        raw = await self._new_one_time_token(user, OneTimeTokenPurpose.RESET_PASSWORD, _RESET_TTL)
        await send_email(
            user.email,
            "Restablecer contraseña",
            f"Para elegir una contraseña nueva: {web_link(f'/reset-password?token={raw}')}\n"
            "Si no lo pediste, ignorá este mensaje.",
        )

    async def send_account_setup(self, user: User, club_name: str) -> None:
        """Cuenta creada por el staff de un club: la persona elige su contraseña con el link."""
        raw = await self._new_one_time_token(
            user, OneTimeTokenPurpose.RESET_PASSWORD, _ACCOUNT_SETUP_TTL
        )
        await send_email(
            user.email,
            f"Ya sos socio de {club_name}",
            f"Hola {user.first_name}, {club_name} te dio de alta como socio en ClubSystem.\n"
            f"Elegí tu contraseña para entrar a la app: "
            f"{web_link(f'/reset-password?token={raw}')}\n"
            "El enlace vence en 7 días.",
        )

    async def reset_password(self, raw_token: str, new_password: str) -> None:
        token = await self._consume_one_time_token(raw_token, OneTimeTokenPurpose.RESET_PASSWORD)
        user = await self.db.get(User, token.user_id)
        if user is None:
            raise BusinessRuleViolation("El enlace no es válido.")
        user.password_hash = await hash_password(new_password)
        # Quien pudo resetear demostró acceso al email.
        user.email_verified_at = user.email_verified_at or utcnow()
        await self.revoke_all(user)

    # ── Internos ────────────────────────────────────────────────────────────

    async def _issue(
        self,
        user: User,
        *,
        client: ClientKind,
        family_id: uuid.UUID,
        club_id: uuid.UUID | None,
        info: ClientInfo,
    ) -> IssuedTokens:
        raw, digest = new_opaque_token()
        auth_session = AuthSession(
            id=uuid.uuid4(),
            user_id=user.id,
            family_id=family_id,
            token_hash=digest,
            active_club_id=club_id,
            expires_at=utcnow() + timedelta(days=get_settings().REFRESH_TOKEN_TTL_DAYS),
            user_agent=(info.user_agent or "")[:255] or None,
            ip=info.ip,
        )
        self.db.add(auth_session)
        access = create_access_token(
            AccessClaims(
                user_id=user.id,
                token_version=user.token_version,
                session_id=auth_session.id,
                client=client,
                club_id=club_id,
            )
        )
        return IssuedTokens(access_token=access, refresh_token=raw, session=auth_session)

    async def _revoke_family(self, family_id: uuid.UUID) -> None:
        await self.db.execute(
            update(AuthSession)
            .where(AuthSession.family_id == family_id, AuthSession.revoked_at.is_(None))
            .values(revoked_at=utcnow())
        )

    async def _has_active_staff(self, user: User, club_id: uuid.UUID) -> bool:
        return any(club.id == club_id for _, club in await self.staff_clubs(user))

    async def _new_one_time_token(
        self, user: User, purpose: OneTimeTokenPurpose, ttl: timedelta
    ) -> str:
        raw, digest = new_opaque_token()
        self.db.add(
            OneTimeToken(
                user_id=user.id, purpose=purpose, token_hash=digest, expires_at=utcnow() + ttl
            )
        )
        return raw

    async def _consume_one_time_token(
        self, raw_token: str, purpose: OneTimeTokenPurpose
    ) -> OneTimeToken:
        token = (
            await self.db.execute(
                select(OneTimeToken)
                .where(
                    OneTimeToken.token_hash == hash_opaque_token(raw_token),
                    OneTimeToken.purpose == purpose,
                )
                .with_for_update()
            )
        ).scalar_one_or_none()
        if token is None or token.used_at is not None or token.expires_at <= utcnow():
            raise BusinessRuleViolation("El enlace no es válido o ya expiró.", code="token_invalid")
        token.used_at = utcnow()
        return token
