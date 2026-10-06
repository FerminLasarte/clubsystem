"""
Equipo del club (staff del panel) e invitaciones.

Las invitaciones se aceptan con el link del email: quien acepta demuestra que controla
ese email, así que una cuenta pre-registrada por otra persona no puede apropiarse del rol.
"""

from dataclasses import dataclass
from datetime import timedelta
from uuid import UUID

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import set_tenant_context
from app.core.errors import BusinessRuleViolation, Conflict, Forbidden, NotFound, Unauthorized
from app.core.security import hash_opaque_token, hash_password, new_opaque_token, verify_password
from app.core.time import utcnow
from app.domain.enums import StaffRole, StaffStatus
from app.domain.permissions import INVITABLE_ROLES
from app.models import Club, ClubStaff, User
from app.repositories.base import get_scoped
from app.schemas.staff import AcceptInvitationRequest, InvitationPreviewOut, StaffMemberOut
from app.services.auth import AuthService
from app.services.context import StaffContext
from app.services.email import send_email, web_link

_INVITE_TTL = timedelta(days=7)
_MIN_PASSWORD = 10


def _check_assignable(roles: list[StaffRole]) -> list[str]:
    if not set(roles) <= INVITABLE_ROLES:
        raise BusinessRuleViolation("El rol OWNER no se puede asignar desde el panel.")
    return sorted({r.value for r in roles})


class StaffService:
    def __init__(self, session: AsyncSession, ctx: StaffContext) -> None:
        self.db = session
        self.ctx = ctx

    async def members(self) -> list[StaffMemberOut]:
        rows = await self.db.execute(
            select(ClubStaff, User)
            .outerjoin(User, User.id == ClubStaff.user_id)
            .where(ClubStaff.club_id == self.ctx.club_id, ClubStaff.status != StaffStatus.REVOKED)
            .order_by(ClubStaff.created_at)
        )
        return [
            StaffMemberOut(
                id=staff.id,
                email=staff.email,
                full_name=user.full_name if user else None,
                roles=list(staff.roles),  # type: ignore[arg-type]
                status=staff.status,
                is_self=staff.user_id == self.ctx.user_id,
                created_at=staff.created_at,
            )
            for staff, user in rows.all()
        ]

    async def invite(self, email: str, roles: list[StaffRole]) -> ClubStaff:
        assignable = _check_assignable(roles)
        return await issue_invitation(
            self.db, self.ctx.club, email, assignable, invited_by=self.ctx.user
        )

    async def update_roles(self, staff_id: UUID, roles: list[StaffRole]) -> ClubStaff:
        staff = await self._editable(staff_id)
        staff.roles = _check_assignable(roles)
        await self.db.flush()
        return staff

    async def revoke(self, staff_id: UUID) -> None:
        staff = await self._editable(staff_id)
        staff.status = StaffStatus.REVOKED
        staff.invite_token_hash = None
        staff.invite_expires_at = None
        await self.db.flush()

    async def _editable(self, staff_id: UUID) -> ClubStaff:
        staff = await get_scoped(
            self.db,
            ClubStaff,
            staff_id,
            self.ctx.club_id,
            not_found="Miembro del equipo no encontrado.",
        )
        if staff.status == StaffStatus.REVOKED:
            raise NotFound("Miembro del equipo no encontrado.")
        if staff.user_id == self.ctx.user_id:
            raise Forbidden("No podés modificar tu propio acceso.")
        if StaffRole.OWNER.value in staff.roles:
            raise Forbidden("Los propietarios del club no se modifican desde el panel.")
        return staff


async def issue_invitation(
    session: AsyncSession, club: Club, email: str, roles: list[str], *, invited_by: User | None
) -> ClubStaff:
    """
    Crea o renueva la invitación de `email` al equipo de `club` y le manda el link.
    No valida qué roles se pueden asignar: lo decide quien llama (el panel excluye OWNER;
    el alta de un club por un operador invita justamente al OWNER).
    """
    email = email.lower()
    staff = (
        await session.execute(
            select(ClubStaff).where(ClubStaff.club_id == club.id, ClubStaff.email == email)
        )
    ).scalar_one_or_none()
    if staff is not None and staff.status == StaffStatus.ACTIVE:
        raise Conflict("Esa persona ya forma parte del equipo del club.")

    raw, digest = new_opaque_token()
    if staff is None:
        staff = ClubStaff(club_id=club.id, email=email)
        session.add(staff)
    staff.roles = roles
    staff.status = StaffStatus.INVITED
    staff.user_id = None
    staff.invited_by_id = invited_by.id if invited_by else None
    staff.invite_token_hash = digest
    staff.invite_expires_at = utcnow() + _INVITE_TTL
    await session.flush()

    inviter = invited_by.full_name if invited_by else "El equipo de ClubSystem"
    await send_email(
        email,
        f"Te invitaron al equipo de {club.name}",
        f"{inviter} te invitó a {club.name} en ClubSystem.\n"
        f"Aceptá la invitación: {web_link(f'/invitations/accept?token={raw}')}\n"
        "El enlace vence en 7 días.",
    )
    return staff


@dataclass(frozen=True)
class _Invitation:
    staff: ClubStaff
    club: Club
    user: User | None


async def _load_invitation(session: AsyncSession, raw_token: str) -> _Invitation:
    digest = hash_opaque_token(raw_token)
    club_id = (
        await session.execute(text("SELECT app_invitation_club(:h)"), {"h": digest})
    ).scalar_one_or_none()
    if club_id is None:
        raise NotFound("La invitación no existe o ya fue usada.", code="invitation_invalid")
    await set_tenant_context(session, club_id=club_id)
    staff = (
        await session.execute(
            select(ClubStaff).where(ClubStaff.invite_token_hash == digest).with_for_update()
        )
    ).scalar_one()
    if staff.invite_expires_at is None or staff.invite_expires_at <= utcnow():
        raise BusinessRuleViolation(
            "La invitación venció. Pedí una nueva.", code="invitation_expired"
        )
    club = await session.get(Club, club_id)
    if club is None or not club.is_active:
        raise NotFound("La invitación no existe o ya fue usada.", code="invitation_invalid")
    user = (
        await session.execute(select(User).where(User.email == staff.email))
    ).scalar_one_or_none()
    return _Invitation(staff=staff, club=club, user=user)


def _account_kind(user: User | None) -> str:
    if user is None:
        return "new"
    return "existing" if user.email_verified else "unverified"


async def preview_invitation(session: AsyncSession, raw_token: str) -> InvitationPreviewOut:
    inv = await _load_invitation(session, raw_token)
    return InvitationPreviewOut(
        club_name=inv.club.name,
        club_logo_url=inv.club.logo_url,
        email=inv.staff.email,
        roles=list(inv.staff.roles),  # type: ignore[arg-type]
        account=_account_kind(inv.user),  # type: ignore[arg-type]
    )


async def accept_invitation(
    session: AsyncSession, data: AcceptInvitationRequest
) -> tuple[User, Club]:
    inv = await _load_invitation(session, data.token)
    user = inv.user
    kind = _account_kind(user)

    if kind in ("new", "unverified") and len(data.password) < _MIN_PASSWORD:
        raise BusinessRuleViolation(
            f"La contraseña debe tener al menos {_MIN_PASSWORD} caracteres.", code="weak_password"
        )
    if user is None:
        if not data.first_name or not data.last_name:
            raise BusinessRuleViolation("Nombre y apellido son obligatorios.")
        user = User(
            email=inv.staff.email,
            password_hash=await hash_password(data.password),
            first_name=data.first_name,
            last_name=data.last_name,
            email_verified_at=utcnow(),
        )
        session.add(user)
        await session.flush()
    elif kind == "unverified":
        # Se demuestra el control del email: se reemplaza la contraseña de una cuenta que
        # pudo haber registrado otra persona y se cierran sus sesiones.
        user.password_hash = await hash_password(data.password)
        user.email_verified_at = utcnow()
        await AuthService(session).revoke_all(user)
    elif not await verify_password(data.password, user.password_hash):
        raise Unauthorized("La contraseña no es correcta.", code="invalid_credentials")
    if not user.is_active:
        raise Forbidden("La cuenta está deshabilitada.")

    await set_tenant_context(session, user_id=user.id)
    inv.staff.user_id = user.id
    inv.staff.status = StaffStatus.ACTIVE
    inv.staff.invite_token_hash = None
    inv.staff.invite_expires_at = None
    await session.flush()
    return user, inv.club
