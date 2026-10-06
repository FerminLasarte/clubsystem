"""
Socios, solicitudes de membresía y planes.

Todo lo propio de un club (plan, número de socio, alta, estado) vive en `ClubMembership`.
El club nunca modifica el `User`: dar de baja a un socio es pasar su membresía a INACTIVE.
"""

from datetime import datetime
from typing import Any, cast
from uuid import UUID

from fastapi.responses import Response
from sqlalchemy import Select, and_, delete, exists, func, or_, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.csv import csv_response
from app.core.db import set_tenant_context
from app.core.errors import BusinessRuleViolation, Conflict, NotFound
from app.core.security import hash_password, new_opaque_token
from app.core.time import month_bounds, today_in, tz, utcnow
from app.domain.enums import MembershipStatus, ReservationStatus
from app.models import Club, ClubMembership, MembershipPlan, Reservation, User
from app.repositories.base import get_scoped, paginate
from app.schemas.clubs import ClubDirectoryOut
from app.schemas.common import Page, PageParams
from app.schemas.members import (
    ApproveRequest,
    ClubDirectoryItemOut,
    MemberCreate,
    MemberFilters,
    MemberListParams,
    MemberOut,
    MemberPersonOut,
    MemberStatsOut,
    MemberUpdate,
    MyMembershipOut,
    PlanCreate,
    PlanSummaryOut,
    PlanUpdate,
)
from app.services.auth import AuthService
from app.services.clubs import active_clubs_directory
from app.services.context import StaffContext

_MemberRows = Select[ClubMembership, User, MembershipPlan, datetime]
_MyMembershipRows = Select[ClubMembership, Club, MembershipPlan]

_MEMBER_STATUSES = (MembershipStatus.APPROVED, MembershipStatus.INACTIVE)
_STATUS_LABELS = {
    MembershipStatus.PENDING: "Pendiente",
    MembershipStatus.APPROVED: "Activo",
    MembershipStatus.INACTIVE: "Inactivo",
    MembershipStatus.REJECTED: "Rechazado",
}
_CSV_HEADER = [
    "N° socio",
    "Apellido",
    "Nombre",
    "Email",
    "DNI",
    "Teléfono",
    "Plan",
    "Alta",
    "Estado",
    "Última reserva",
]


def _contains(term: str) -> str:
    """Patrón ILIKE que trata `%`, `_` y `\\` del usuario como texto literal."""
    escaped = term.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    return f"%{escaped}%"


def _plan_join() -> Any:
    return and_(
        MembershipPlan.id == ClubMembership.plan_id,
        MembershipPlan.club_id == ClubMembership.club_id,
    )


# ── Planes ──────────────────────────────────────────────────────────────────


class PlanService:
    def __init__(self, session: AsyncSession, ctx: StaffContext) -> None:
        self.db = session
        self.ctx = ctx

    async def plans(self) -> list[MembershipPlan]:
        rows = await self.db.execute(
            select(MembershipPlan)
            .where(MembershipPlan.club_id == self.ctx.club_id)
            .order_by(MembershipPlan.is_active.desc(), MembershipPlan.name)
        )
        return list(rows.scalars())

    async def create(self, data: PlanCreate) -> MembershipPlan:
        plan = MembershipPlan(
            club_id=self.ctx.club_id, name=data.name, monthly_fee=data.monthly_fee
        )
        self.db.add(plan)
        await self.db.flush()  # nombre repetido → 409
        await self.db.refresh(plan)  # la cuota vuelve con la escala de la columna
        return plan

    async def update(self, plan_id: UUID, data: PlanUpdate) -> MembershipPlan:
        plan = await self._get(plan_id, for_update=True)
        changes = data.model_dump(exclude_unset=True)
        for field in ("name", "monthly_fee", "is_active"):
            if field in changes and changes[field] is None:
                raise BusinessRuleViolation("Nombre, cuota y estado del plan no pueden ser nulos.")
        for field, value in changes.items():
            setattr(plan, field, value)
        await self.db.flush()
        await self.db.refresh(plan)
        return plan

    async def remove(self, plan_id: UUID) -> None:
        """Borra el plan; si alguna membresía lo usa, lo desactiva para conservar el historial."""
        plan = await self._get(plan_id, for_update=True)
        in_use = await self.db.scalar(
            select(exists().where(ClubMembership.plan_id == plan.id, _plan_join()))
        )
        if in_use:
            plan.is_active = False
            await self.db.flush()
        else:
            await self.db.execute(delete(MembershipPlan).where(MembershipPlan.id == plan.id))

    async def _get(self, plan_id: UUID, *, for_update: bool = False) -> MembershipPlan:
        return await get_scoped(
            self.db,
            MembershipPlan,
            plan_id,
            self.ctx.club_id,
            not_found="Plan no encontrado.",
            for_update=for_update,
        )


# ── Socios y solicitudes (panel) ────────────────────────────────────────────


class MemberService:
    def __init__(self, session: AsyncSession, ctx: StaffContext) -> None:
        self.db = session
        self.ctx = ctx

    async def members(self, params: MemberListParams) -> Page[MemberOut]:
        stmt = self._filtered(params).order_by(User.last_name, User.first_name, ClubMembership.id)
        return await self._page(stmt, params)

    async def get(self, membership_id: UUID) -> MemberOut:
        row = (
            await self.db.execute(self._query().where(ClubMembership.id == membership_id))
        ).one_or_none()
        if row is None:
            raise NotFound("Socio no encontrado.")
        return _member_out(row)

    async def stats(self) -> MemberStatsOut:
        today = today_in(tz(self.ctx.club.timezone))
        start, end = month_bounds(today.year, today.month)
        status = ClubMembership.status
        row = (
            await self.db.execute(
                select(
                    func.count().filter(status == MembershipStatus.PENDING),
                    func.count().filter(status == MembershipStatus.APPROVED),
                    func.count().filter(status == MembershipStatus.INACTIVE),
                    func.count().filter(status == MembershipStatus.REJECTED),
                    func.count().filter(
                        status.in_(_MEMBER_STATUSES),
                        ClubMembership.joined_on >= start,
                        ClubMembership.joined_on < end,
                    ),
                ).where(ClubMembership.club_id == self.ctx.club_id)
            )
        ).one()
        return MemberStatsOut(
            pending=row[0],
            approved=row[1],
            inactive=row[2],
            rejected=row[3],
            joined_this_month=row[4],
        )

    async def create(self, data: MemberCreate) -> MemberOut:
        """
        Alta por el staff. Si la persona ya tiene cuenta, solo se crea o reactiva su
        membresía (sus datos personales no se tocan). Si no, se crea la cuenta sin una
        contraseña utilizable y se le envía un link para que la elija.
        """
        plan_id = await self._assignable_plan(data.plan_id)
        email = data.email.lower()
        user = (await self.db.execute(select(User).where(User.email == email))).scalar_one_or_none()
        membership: ClubMembership | None = None
        new_account = user is None
        if user is None:
            user = User(
                email=email,
                password_hash=await hash_password(new_opaque_token()[0]),
                first_name=data.first_name,
                last_name=data.last_name,
                phone=data.phone,
                dni=data.dni,
            )
            self.db.add(user)
            await self.db.flush()  # email o DNI repetidos → 409
        else:
            membership = (
                await self.db.execute(
                    select(ClubMembership)
                    .where(
                        ClubMembership.club_id == self.ctx.club_id,
                        ClubMembership.user_id == user.id,
                    )
                    .with_for_update()
                )
            ).scalar_one_or_none()
            if membership is not None and membership.status == MembershipStatus.APPROVED:
                raise Conflict("Esa persona ya es socia del club.", code="already_member")

        if membership is None:
            membership = ClubMembership(club_id=self.ctx.club_id, user_id=user.id)
            self.db.add(membership)
        self._approve(membership, plan_id, data.member_number)
        if data.notes is not None:
            membership.notes = data.notes
        await self.db.flush()  # número de socio repetido → 409, antes de mandar el email

        if new_account:
            await AuthService(self.db).send_account_setup(user, self.ctx.club.name)
        return await self.get(membership.id)

    async def update(self, membership_id: UUID, data: MemberUpdate) -> MemberOut:
        membership = await self._locked(membership_id, "Socio no encontrado.")
        if membership.status not in _MEMBER_STATUSES:
            raise BusinessRuleViolation(
                "Las solicitudes se aprueban o rechazan desde el listado de solicitudes.",
                code="membership_not_decided",
            )
        changes = data.model_dump(exclude_unset=True)
        for field in ("joined_on", "status"):
            if field in changes and changes[field] is None:
                raise BusinessRuleViolation("La fecha de alta y el estado no pueden ser nulos.")
        if "plan_id" in changes and changes["plan_id"] != membership.plan_id:
            changes["plan_id"] = await self._assignable_plan(changes["plan_id"])
        for field, value in changes.items():
            setattr(membership, field, value)
        await self.db.flush()
        return await self.get(membership.id)

    async def pending_requests(self, params: PageParams) -> Page[MemberOut]:
        stmt = (
            self._query()
            .where(ClubMembership.status == MembershipStatus.PENDING)
            .order_by(ClubMembership.requested_at, ClubMembership.id)
        )
        return await self._page(stmt, params)

    async def approve(self, membership_id: UUID, data: ApproveRequest) -> MemberOut:
        membership = await self._pending(membership_id)
        plan_id = await self._assignable_plan(data.plan_id)
        # Un socio que vuelve a pedir el alta conserva su plan y número si no se mandan.
        self._approve(
            membership,
            plan_id or membership.plan_id,
            data.member_number or membership.member_number,
        )
        await self.db.flush()
        return await self.get(membership.id)

    async def reject(self, membership_id: UUID) -> MemberOut:
        membership = await self._pending(membership_id)
        membership.status = MembershipStatus.REJECTED
        membership.decided_at = utcnow()
        membership.decided_by_id = self.ctx.user_id
        await self.db.flush()
        return await self.get(membership.id)

    async def export_csv(self, filters: MemberFilters) -> Response:
        stmt = self._filtered(filters).order_by(User.last_name, User.first_name)
        members = [_member_out(r) for r in (await self.db.execute(stmt)).all()]
        today = today_in(tz(self.ctx.club.timezone))
        return csv_response(
            f"socios_{today.isoformat()}.csv",
            _CSV_HEADER,
            (
                [
                    m.member_number,
                    m.user.last_name,
                    m.user.first_name,
                    m.user.email,
                    m.user.dni,
                    m.user.phone,
                    m.plan.name if m.plan else None,
                    m.joined_on,
                    _STATUS_LABELS[m.status],
                    m.last_reservation_at,
                ]
                for m in members
            ),
        )

    # ── Internos ────────────────────────────────────────────────────────────

    async def _page(self, stmt: _MemberRows, params: PageParams) -> Page[MemberOut]:
        # `paginate` tipa Select[Any], que con los genéricos variádicos de SQLAlchemy 2.1
        # no acepta selects de varias columnas.
        rows, total = await paginate(self.db, cast("Select[Any]", stmt), params)
        return Page(
            items=[_member_out(r) for r in rows],
            total=total,
            page=params.page,
            page_size=params.page_size,
        )

    def _query(self) -> _MemberRows:
        last_reservation = (
            select(func.max(Reservation.starts_at))
            .where(
                Reservation.club_id == ClubMembership.club_id,
                Reservation.user_id == ClubMembership.user_id,
                Reservation.status != ReservationStatus.CANCELLED,
            )
            .correlate(ClubMembership)
            .scalar_subquery()
        )
        return (
            select(ClubMembership, User, MembershipPlan, last_reservation)
            .join(User, User.id == ClubMembership.user_id)
            .outerjoin(MembershipPlan, _plan_join())
            .where(ClubMembership.club_id == self.ctx.club_id)
        )

    def _filtered(self, filters: MemberFilters) -> _MemberRows:
        stmt = self._query()
        if filters.status is not None:
            stmt = stmt.where(ClubMembership.status == filters.status)
        else:
            stmt = stmt.where(ClubMembership.status.in_(_MEMBER_STATUSES))
        if filters.plan_id is not None:
            stmt = stmt.where(ClubMembership.plan_id == filters.plan_id)
        if filters.search:
            pattern = _contains(filters.search)
            stmt = stmt.where(
                or_(
                    func.concat(User.first_name, " ", User.last_name).ilike(pattern, escape="\\"),
                    User.email.ilike(pattern, escape="\\"),
                    User.dni.ilike(pattern, escape="\\"),
                    ClubMembership.member_number.ilike(pattern, escape="\\"),
                )
            )
        return stmt

    def _approve(
        self, membership: ClubMembership, plan_id: UUID | None, member_number: str | None
    ) -> None:
        membership.status = MembershipStatus.APPROVED
        membership.plan_id = plan_id
        membership.member_number = member_number
        membership.joined_on = today_in(tz(self.ctx.club.timezone))
        membership.decided_at = utcnow()
        membership.decided_by_id = self.ctx.user_id

    async def _assignable_plan(self, plan_id: UUID | None) -> UUID | None:
        if plan_id is None:
            return None
        plan = await get_scoped(
            self.db, MembershipPlan, plan_id, self.ctx.club_id, not_found="Plan no encontrado."
        )
        if not plan.is_active:
            raise BusinessRuleViolation("El plan está desactivado.", code="plan_inactive")
        return plan.id

    async def _locked(self, membership_id: UUID, not_found: str) -> ClubMembership:
        return await get_scoped(
            self.db,
            ClubMembership,
            membership_id,
            self.ctx.club_id,
            not_found=not_found,
            for_update=True,
        )

    async def _pending(self, membership_id: UUID) -> ClubMembership:
        # El lock serializa decisiones simultáneas: la segunda ve el estado ya resuelto.
        membership = await self._locked(membership_id, "Solicitud no encontrada.")
        if membership.status != MembershipStatus.PENDING:
            raise Conflict("La solicitud ya fue resuelta.", code="request_already_decided")
        return membership


def _member_out(row: Any) -> MemberOut:
    membership, user, plan, last_reservation_at = row
    return MemberOut(
        id=membership.id,
        status=membership.status,
        member_number=membership.member_number,
        joined_on=membership.joined_on,
        notes=membership.notes,
        requested_at=membership.requested_at,
        decided_at=membership.decided_at,
        created_at=membership.created_at,
        plan=PlanSummaryOut.model_validate(plan) if plan else None,
        user=MemberPersonOut.model_validate(user),
        last_reservation_at=last_reservation_at,
    )


# ── App del socio ───────────────────────────────────────────────────────────


async def clubs_directory(
    session: AsyncSession, user: User, search: str | None
) -> list[ClubDirectoryItemOut]:
    clubs = await active_clubs_directory(session, search)
    rows = await session.execute(
        select(ClubMembership.club_id, ClubMembership.status).where(
            ClubMembership.user_id == user.id,
            ClubMembership.club_id.in_([c.id for c in clubs]),
        )
    )
    statuses = {club_id: status for club_id, status in rows.all()}
    return [
        ClubDirectoryItemOut.model_validate(club).model_copy(
            update={"my_membership_status": statuses.get(club.id)}
        )
        for club in clubs
    ]


async def my_memberships(session: AsyncSession, user: User) -> list[MyMembershipOut]:
    rows = await session.execute(_my_memberships_query(user).order_by(Club.name))
    return [_my_membership_out(row) for row in rows.all()]


async def request_membership(
    session: AsyncSession, user: User, club_id: UUID
) -> tuple[MyMembershipOut, bool]:
    """
    Pide ser socio. Idempotente: si ya hay una solicitud o membresía vigente la devuelve;
    una rechazada o dada de baja vuelve a quedar pendiente. Devuelve (membresía, creada).
    """
    if not user.email_verified:
        raise BusinessRuleViolation(
            "Confirmá tu email antes de pedir ser socio.", code="email_not_verified"
        )
    club = await session.get(Club, club_id)
    if club is None or not club.is_active:
        raise NotFound("Club no encontrado.")
    await set_tenant_context(session, club_id=club.id)

    # ON CONFLICT: dos pedidos simultáneos no fallan; el segundo encuentra la fila del primero.
    inserted = await session.scalar(
        insert(ClubMembership)
        .values(
            club_id=club.id,
            user_id=user.id,
            status=MembershipStatus.PENDING,
            requested_at=utcnow(),
        )
        .on_conflict_do_nothing(constraint="uq_club_memberships_club_id_user_id")
        .returning(ClubMembership.id)
    )
    membership = (
        await session.execute(
            select(ClubMembership)
            .where(ClubMembership.club_id == club.id, ClubMembership.user_id == user.id)
            .with_for_update()
        )
    ).scalar_one()
    if membership.status in (MembershipStatus.REJECTED, MembershipStatus.INACTIVE):
        membership.status = MembershipStatus.PENDING
        membership.requested_at = utcnow()
        membership.decided_at = None
        membership.decided_by_id = None
        await session.flush()

    row = (
        await session.execute(_my_memberships_query(user).where(ClubMembership.id == membership.id))
    ).one()
    return _my_membership_out(row), inserted is not None


def _my_memberships_query(user: User) -> _MyMembershipRows:
    return (
        select(ClubMembership, Club, MembershipPlan)
        .join(Club, Club.id == ClubMembership.club_id)
        .outerjoin(MembershipPlan, _plan_join())
        .where(ClubMembership.user_id == user.id, Club.is_active.is_(True))
    )


def _my_membership_out(row: Any) -> MyMembershipOut:
    membership, club, plan = row
    # El plan solo se informa mientras la membresía está vigente.
    approved = membership.status == MembershipStatus.APPROVED
    return MyMembershipOut(
        id=membership.id,
        status=membership.status,
        member_number=membership.member_number,
        joined_on=membership.joined_on,
        requested_at=membership.requested_at,
        club=ClubDirectoryOut.model_validate(club),
        plan=PlanSummaryOut.model_validate(plan) if plan and approved else None,
    )
