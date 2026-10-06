"""
Reservas: gestión del staff, reservas y disponibilidad del socio, y transiciones del job.

Reglas:
  - El solapamiento lo impide la base (EXCLUDE `no_overlap` → 409).
  - El precio sale de domain/pricing.py; los turnos y el horario, de domain/slots.py.
  - Los cambios de estado son UPDATE condicionales sobre el estado esperado: si otro request
    (o el job) ganó la carrera, el UPDATE no afecta filas y se responde 409.
"""

from collections import defaultdict
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import Any
from uuid import UUID

from fastapi.responses import Response
from sqlalchemy import Numeric, Select, and_, case, cast, func, not_, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql.elements import ColumnElement

from app.core.csv import csv_response
from app.core.errors import BusinessRuleViolation, Conflict, NotFound
from app.core.time import day_bounds, days_bounds, tz, utcnow
from app.domain.cancellation import member_can_cancel, member_cancel_deadline
from app.domain.enums import (
    CancelReason,
    CustomerType,
    MembershipStatus,
    ReservationSource,
    ReservationStatus,
    Sport,
    TransactionType,
)
from app.domain.pricing import reservation_price
from app.domain.slots import (
    SLOT_STEP,
    Interval,
    available_starts,
    on_grid,
    operating_window,
    window_for_start,
    within_window,
)
from app.models import (
    ACTIVE_RESERVATION_STATUSES,
    Club,
    ClubMembership,
    Court,
    Payment,
    Reservation,
    User,
)
from app.repositories.base import get_scoped, paginate
from app.schemas.common import ExportRange, Page
from app.schemas.reservations import (
    AvailabilityOut,
    ClubBrief,
    CourtAvailabilityOut,
    CourtBrief,
    GridCourtOut,
    MemberReservationCreate,
    MyReservationOut,
    MyReservationsQuery,
    ReservationCreate,
    ReservationFilters,
    ReservationGridOut,
    ReservationOut,
    ReservationUpdate,
    SlotOut,
)
from app.services.context import MemberContext, StaffContext


def _minutes(starts_at: datetime, ends_at: datetime) -> int:
    return int((ends_at - starts_at).total_seconds() // 60)


def _price(court: Court, customer: CustomerType, minutes: int) -> Decimal:
    return reservation_price(court.price_member, court.price_guest, customer, minutes)


# Reservas desde la app: evita que un socio bloquee la agenda con pendientes.
APP_BOOKING_HORIZON_DAYS = 14
APP_MAX_PENDING_PER_MEMBER = 3


def staff_cancellation(user_id: UUID) -> dict[str, Any]:
    """Valores de una reserva cancelada por el staff (individual o al desactivar una cancha)."""
    return {
        "status": ReservationStatus.CANCELLED,
        "cancelled_at": utcnow(),
        "cancelled_by_id": user_id,
        "cancel_reason": CancelReason.BY_STAFF,
    }


async def _lock_bookable_court(session: AsyncSession, court_id: UUID, club_id: UUID) -> Court:
    """
    Cancha del club, activa. FOR SHARE: no bloquea otras reservas, pero sí que la cancha
    se desactive mientras se crea una.
    """
    court = (
        await session.execute(
            select(Court)
            .where(Court.id == court_id, Court.club_id == club_id)
            .with_for_update(read=True)
        )
    ).scalar_one_or_none()
    if court is None:
        raise NotFound("Cancha no encontrada.")
    if not court.is_active:
        raise BusinessRuleViolation("La cancha no está habilitada.", code="court_inactive")
    return court


def _check_hours(club: Club, starts_at: datetime, ends_at: datetime) -> Interval:
    window = window_for_start(starts_at, tz(club.timezone), club.open_time, club.close_time)
    if not within_window(starts_at, ends_at, window):
        raise BusinessRuleViolation(
            "El horario está fuera del horario de atención del club.", code="outside_hours"
        )
    return window


# ── Panel ─────────────────────────────────────────────────────────────────────


def _paid_amount() -> ColumnElement[Decimal]:
    signed = case((Payment.type == TransactionType.INCOME, Payment.amount), else_=-Payment.amount)
    return (
        select(cast(func.coalesce(func.sum(signed), 0), Numeric(12, 2)))
        .where(
            Payment.reservation_id == Reservation.id,
            Payment.club_id == Reservation.club_id,
            Payment.voided_at.is_(None),
        )
        .correlate(Reservation)
        .scalar_subquery()
    )


def _staff_select(club_id: UUID) -> Select[*tuple[Any, ...]]:
    return (
        select(
            Reservation,
            Court.name,
            User,
            ClubMembership.id,
            ClubMembership.member_number,
            _paid_amount(),
        )
        .join(Court, and_(Court.id == Reservation.court_id, Court.club_id == Reservation.club_id))
        .outerjoin(User, User.id == Reservation.user_id)
        .outerjoin(
            ClubMembership,
            and_(
                ClubMembership.user_id == Reservation.user_id,
                ClubMembership.club_id == Reservation.club_id,
            ),
        )
        .where(Reservation.club_id == club_id)
    )


def _staff_out(row: Sequence[Any]) -> ReservationOut:
    r, court_name, user, membership_id, member_number, paid = row
    return ReservationOut(
        id=r.id,
        court_id=r.court_id,
        court_name=court_name,
        customer_type=r.customer_type,
        customer_name=user.full_name if user is not None else r.guest_name or "",
        customer_phone=user.phone if user is not None else r.guest_phone,
        user_id=r.user_id,
        membership_id=membership_id,
        member_number=member_number,
        status=r.status,
        source=r.source,
        starts_at=r.starts_at,
        ends_at=r.ends_at,
        duration_minutes=_minutes(r.starts_at, r.ends_at),
        total_price=r.total_price,
        paid_amount=paid,
        notes=r.notes,
        confirmed_at=r.confirmed_at,
        cancelled_at=r.cancelled_at,
        cancel_reason=r.cancel_reason,
        created_at=r.created_at,
    )


_EXPORT_HEADER = (
    "Fecha y hora",
    "Cancha",
    "Cliente",
    "Tipo",
    "Teléfono",
    "Estado",
    "Origen",
    "Minutos",
    "Precio",
    "Pagado",
    "Notas",
)


class ReservationService:
    def __init__(self, session: AsyncSession, ctx: StaffContext) -> None:
        self.db = session
        self.ctx = ctx

    @property
    def club(self) -> Club:
        return self.ctx.club

    async def list(self, filters: ReservationFilters) -> Page[ReservationOut]:
        start, end = days_bounds(*filters.days, tz(self.club.timezone))
        stmt = _staff_select(self.ctx.club_id).where(
            Reservation.starts_at >= start, Reservation.starts_at < end
        )
        if filters.status is not None:
            stmt = stmt.where(Reservation.status == filters.status)
        if filters.court_id is not None:
            stmt = stmt.where(Reservation.court_id == filters.court_id)
        order = (
            Reservation.starts_at.desc() if filters.sort == "-starts_at" else Reservation.starts_at
        )
        rows, total = await paginate(self.db, stmt.order_by(order, Reservation.id), filters)
        return Page(
            items=[_staff_out(row) for row in rows],
            total=total,
            page=filters.page,
            page_size=filters.page_size,
        )

    async def export(self, period: ExportRange) -> Response:
        start, end = days_bounds(period.from_, period.to, tz(self.club.timezone))
        stmt = _staff_select(self.ctx.club_id).where(
            Reservation.starts_at >= start, Reservation.starts_at < end
        )
        zone = tz(self.club.timezone)
        rows = [
            _staff_out(row) for row in await self.db.execute(stmt.order_by(Reservation.starts_at))
        ]
        return csv_response(
            f"reservas-{period.from_.isoformat()}-{period.to.isoformat()}.csv",
            _EXPORT_HEADER,
            (
                (
                    r.starts_at.astimezone(zone).strftime("%Y-%m-%d %H:%M"),
                    r.court_name,
                    r.customer_name,
                    r.customer_type.value,
                    r.customer_phone,
                    r.status.value,
                    r.source.value,
                    r.duration_minutes,
                    r.total_price,
                    r.paid_amount,
                    r.notes,
                )
                for r in rows
            ),
        )

    async def grid(self, day: date) -> ReservationGridOut:
        """
        Canchas activas y las reservas no canceladas que tocan el día local. Una cancha ya
        desactivada aparece solo si tiene reservas ese día (historial).
        """
        start, end = day_bounds(day, tz(self.club.timezone))
        rows = await self.db.execute(
            _staff_select(self.ctx.club_id)
            .where(
                Reservation.status != ReservationStatus.CANCELLED,
                Reservation.starts_at < end,
                Reservation.ends_at > start,
            )
            .order_by(Reservation.starts_at)
        )
        by_court: dict[UUID, list[ReservationOut]] = defaultdict(list)
        for row in rows:
            out = _staff_out(row)
            by_court[out.court_id].append(out)
        courts = (
            await self.db.execute(
                select(Court)
                .where(
                    Court.club_id == self.ctx.club_id,
                    or_(Court.is_active.is_(True), Court.id.in_(list(by_court))),
                )
                .order_by(Court.is_active.desc(), Court.name)
            )
        ).scalars()
        return ReservationGridOut(
            date=day,
            timezone=self.club.timezone,
            open_time=self.club.open_time,
            close_time=self.club.close_time,
            slot_minutes=int(SLOT_STEP.total_seconds() // 60),
            courts=[
                GridCourtOut(
                    id=c.id,
                    name=c.name,
                    sport=c.sport,
                    surface=c.surface,
                    is_indoor=c.is_indoor,
                    is_active=c.is_active,
                    reservations=by_court[c.id],
                )
                for c in courts
            ],
        )

    async def get(self, reservation_id: UUID) -> ReservationOut:
        row = (
            await self.db.execute(
                _staff_select(self.ctx.club_id).where(Reservation.id == reservation_id)
            )
        ).one_or_none()
        if row is None:
            raise NotFound("Reserva no encontrada.")
        return _staff_out(row)

    async def create(self, data: ReservationCreate) -> UUID:
        court = await _lock_bookable_court(self.db, data.court_id, self.ctx.club_id)
        _check_hours(self.club, data.starts_at, data.ends_at)
        user_id: UUID | None = None
        if data.membership_id is not None:
            membership = await get_scoped(
                self.db,
                ClubMembership,
                data.membership_id,
                self.ctx.club_id,
                not_found="Socio no encontrado.",
            )
            if membership.status != MembershipStatus.APPROVED:
                raise BusinessRuleViolation(
                    "El socio no está aprobado en el club.", code="member_not_approved"
                )
            user_id = membership.user_id

        minutes = _minutes(data.starts_at, data.ends_at)
        price = (
            data.price_override
            if data.price_override is not None
            else _price(court, data.customer_type, minutes)
        )
        now = utcnow()
        reservation = Reservation(
            club_id=self.ctx.club_id,
            court_id=court.id,
            customer_type=data.customer_type,
            user_id=user_id,
            guest_name=data.guest_name,
            guest_phone=data.guest_phone,
            # Lo que carga el staff ya está confirmado.
            status=ReservationStatus.CONFIRMED,
            confirmed_at=now,
            source=ReservationSource.PANEL,
            starts_at=data.starts_at,
            ends_at=data.ends_at,
            total_price=price,
            notes=data.notes,
            created_by_id=self.ctx.user_id,
        )
        self.db.add(reservation)
        await self.db.flush()  # solapamiento → 409 (no_overlap)
        return reservation.id

    async def confirm(self, reservation_id: UUID) -> None:
        await self._transition(
            reservation_id,
            (ReservationStatus.PENDING,),
            {"status": ReservationStatus.CONFIRMED, "confirmed_at": utcnow()},
            "Solo se pueden confirmar reservas pendientes.",
        )

    async def cancel(self, reservation_id: UUID) -> None:
        await self._transition(
            reservation_id,
            ACTIVE_RESERVATION_STATUSES,
            staff_cancellation(self.ctx.user_id),
            "La reserva ya no se puede cancelar.",
        )

    async def update(self, reservation_id: UUID, data: ReservationUpdate) -> None:
        reservation = await get_scoped(
            self.db,
            Reservation,
            reservation_id,
            self.ctx.club_id,
            not_found="Reserva no encontrada.",
            for_update=True,
        )
        if "notes" in data.model_fields_set:
            reservation.notes = data.notes

        reschedule = data.starts_at is not None or data.court_id is not None
        if not reschedule and data.price_override is None:
            await self.db.flush()
            return
        if reservation.status not in ACTIVE_RESERVATION_STATUSES:
            raise Conflict("Solo se modifican reservas pendientes o confirmadas.")
        if data.price_override is not None:
            reservation.total_price = data.price_override
        if not reschedule:
            await self.db.flush()
            return

        starts_at = data.starts_at or reservation.starts_at
        ends_at = data.ends_at or reservation.ends_at
        court = await _lock_bookable_court(
            self.db, data.court_id or reservation.court_id, self.ctx.club_id
        )
        _check_hours(self.club, starts_at, ends_at)
        minutes = _minutes(starts_at, ends_at)
        changed_rate = court.id != reservation.court_id or minutes != _minutes(
            reservation.starts_at, reservation.ends_at
        )
        if data.price_override is None and changed_rate:
            reservation.total_price = _price(court, reservation.customer_type, minutes)
        reservation.court_id = court.id
        reservation.starts_at = starts_at
        reservation.ends_at = ends_at
        await self.db.flush()  # solapamiento → 409 (no_overlap)

    async def _transition(
        self,
        reservation_id: UUID,
        expected: Sequence[ReservationStatus],
        values: dict[str, Any],
        conflict: str,
    ) -> None:
        updated = (
            await self.db.execute(
                update(Reservation)
                .where(
                    Reservation.id == reservation_id,
                    Reservation.club_id == self.ctx.club_id,
                    Reservation.status.in_(expected),
                )
                .values(**values)
                .returning(Reservation.id)
            )
        ).scalar_one_or_none()
        if updated is None:
            await get_scoped(
                self.db,
                Reservation,
                reservation_id,
                self.ctx.club_id,
                not_found="Reserva no encontrada.",
            )
            raise Conflict(conflict, code="invalid_status")


# ── App del socio ─────────────────────────────────────────────────────────────


class MemberBookingService:
    def __init__(self, session: AsyncSession, ctx: MemberContext) -> None:
        self.db = session
        self.ctx = ctx

    async def availability(
        self, day: date, sport: Sport | None, duration_minutes: int
    ) -> AvailabilityOut:
        club = self.ctx.club
        window = operating_window(day, tz(club.timezone), club.open_time, club.close_time)
        courts_stmt = (
            select(Court)
            .where(Court.club_id == club.id, Court.is_active.is_(True))
            .order_by(Court.sport, Court.name)
        )
        if sport is not None:
            courts_stmt = courts_stmt.where(Court.sport == sport)
        courts = list((await self.db.execute(courts_stmt)).scalars())

        busy: dict[UUID, list[Interval]] = defaultdict(list)
        if courts:
            rows = await self.db.execute(
                select(Reservation.court_id, Reservation.starts_at, Reservation.ends_at).where(
                    Reservation.club_id == club.id,
                    Reservation.court_id.in_([c.id for c in courts]),
                    Reservation.status.in_(ACTIVE_RESERVATION_STATUSES),
                    Reservation.starts_at < window[1],
                    Reservation.ends_at > window[0],
                )
            )
            for court_id, starts_at, ends_at in rows:
                busy[court_id].append((starts_at, ends_at))

        duration = timedelta(minutes=duration_minutes)
        now = utcnow()
        return AvailabilityOut(
            date=day,
            timezone=club.timezone,
            duration_minutes=duration_minutes,
            courts=[
                CourtAvailabilityOut(
                    court_id=c.id,
                    name=c.name,
                    sport=c.sport,
                    surface=c.surface,
                    is_indoor=c.is_indoor,
                    price=_price(c, CustomerType.MEMBER, duration_minutes),
                    slots=[
                        SlotOut(starts_at=s, ends_at=s + duration)
                        for s in available_starts(window, duration, busy[c.id], now)
                    ],
                )
                for c in courts
            ],
        )

    async def create(self, data: MemberReservationCreate) -> UUID:
        club = self.ctx.club
        court = await _lock_bookable_court(self.db, data.court_id, club.id)
        starts_at = data.starts_at
        ends_at = starts_at + timedelta(minutes=data.duration_minutes)
        if starts_at <= utcnow():
            raise BusinessRuleViolation("No se puede reservar en el pasado.", code="past_start")
        if starts_at > utcnow() + timedelta(days=APP_BOOKING_HORIZON_DAYS):
            raise BusinessRuleViolation(
                f"Se puede reservar hasta {APP_BOOKING_HORIZON_DAYS} días antes.", code="too_far"
            )
        pending = await self.db.scalar(
            select(func.count()).where(
                Reservation.club_id == club.id,
                Reservation.user_id == self.ctx.user.id,
                Reservation.status == ReservationStatus.PENDING,
                Reservation.starts_at > utcnow(),
            )
        )
        if (pending or 0) >= APP_MAX_PENDING_PER_MEMBER:
            raise BusinessRuleViolation(
                f"Tenés {APP_MAX_PENDING_PER_MEMBER} reservas esperando confirmación del club. "
                "Esperá a que las confirmen para pedir otra.",
                code="too_many_pending",
            )
        window = _check_hours(club, starts_at, ends_at)
        if not on_grid(starts_at, window):
            raise BusinessRuleViolation(
                "Los turnos empiezan cada 30 minutos desde la apertura.", code="off_grid"
            )
        reservation = Reservation(
            club_id=club.id,
            court_id=court.id,
            customer_type=CustomerType.MEMBER,
            user_id=self.ctx.user.id,
            status=ReservationStatus.PENDING,
            source=ReservationSource.APP,
            starts_at=starts_at,
            ends_at=ends_at,
            total_price=_price(court, CustomerType.MEMBER, data.duration_minutes),
            created_by_id=self.ctx.user.id,
        )
        self.db.add(reservation)
        await self.db.flush()  # solapamiento → 409 (no_overlap)
        return reservation.id

    async def cancel(self, reservation_id: UUID) -> None:
        """Pendientes siempre; confirmadas hasta el plazo del club (domain/cancellation.py)."""
        reservation = await get_scoped(
            self.db,
            Reservation,
            reservation_id,
            self.ctx.club.id,
            not_found="Reserva no encontrada.",
            for_update=True,
        )
        if reservation.user_id != self.ctx.user.id:
            raise NotFound("Reserva no encontrada.")
        notice = self.ctx.club.member_cancel_notice_hours
        now = utcnow()
        if not member_can_cancel(reservation.status, reservation.starts_at, notice, now):
            if reservation.status == ReservationStatus.CONFIRMED and reservation.ends_at > now:
                raise BusinessRuleViolation(
                    f"Las reservas confirmadas se cancelan desde la app hasta {notice} horas "
                    "antes del inicio. Para cancelarla, comunicate con el club.",
                    code="cancel_window_closed",
                )
            raise Conflict("La reserva ya no se puede cancelar.", code="invalid_status")
        reservation.status = ReservationStatus.CANCELLED
        reservation.cancelled_at = now
        reservation.cancelled_by_id = self.ctx.user.id
        reservation.cancel_reason = CancelReason.BY_MEMBER
        await self.db.flush()


# ── Reservas propias (todas las del usuario, de todos sus clubes) ─────────────


def _my_select(user_id: UUID) -> Select[*tuple[Any, ...]]:
    return (
        select(Reservation, Court, Club)
        .join(Court, and_(Court.id == Reservation.court_id, Court.club_id == Reservation.club_id))
        .join(Club, Club.id == Reservation.club_id)
        .where(Reservation.user_id == user_id)
    )


def _my_out(r: Reservation, court: Court, club: Club) -> MyReservationOut:
    notice = club.member_cancel_notice_hours
    return MyReservationOut(
        id=r.id,
        status=r.status,
        starts_at=r.starts_at,
        ends_at=r.ends_at,
        duration_minutes=_minutes(r.starts_at, r.ends_at),
        total_price=r.total_price,
        cancel_reason=r.cancel_reason,
        created_at=r.created_at,
        club=ClubBrief.model_validate(club),
        court=CourtBrief.model_validate(court),
        can_cancel=member_can_cancel(r.status, r.starts_at, notice, utcnow()),
        cancel_deadline=member_cancel_deadline(r.status, r.starts_at, notice),
    )


async def my_reservations(
    session: AsyncSession, user: User, query: MyReservationsQuery
) -> Page[MyReservationOut]:
    upcoming: ColumnElement[bool] = and_(
        Reservation.status.in_(ACTIVE_RESERVATION_STATUSES), Reservation.ends_at > utcnow()
    )
    stmt = _my_select(user.id)
    if query.scope == "upcoming":
        stmt = stmt.where(upcoming).order_by(Reservation.starts_at, Reservation.id)
    else:
        stmt = stmt.where(not_(upcoming)).order_by(Reservation.starts_at.desc(), Reservation.id)
    rows, total = await paginate(session, stmt, query)
    return Page(
        items=[_my_out(*row) for row in rows],
        total=total,
        page=query.page,
        page_size=query.page_size,
    )


async def my_reservation(
    session: AsyncSession, user: User, reservation_id: UUID
) -> MyReservationOut:
    row = (
        await session.execute(_my_select(user.id).where(Reservation.id == reservation_id))
    ).one_or_none()
    if row is None:
        raise NotFound("Reserva no encontrada.")
    return _my_out(*row)


# ── Job ───────────────────────────────────────────────────────────────────────


@dataclass(frozen=True)
class TransitionResult:
    expired: int
    completed: int


async def run_transitions(
    session: AsyncSession, club_id: UUID, now: datetime | None = None
) -> TransitionResult:
    """
    Pendientes cuyo inicio ya pasó → canceladas por el sistema (EXPIRED_UNCONFIRMED).
    Confirmadas cuyo fin ya pasó → completadas. Idempotente: UPDATE sobre el estado esperado.
    """
    now = now or utcnow()
    expired = await session.execute(
        update(Reservation)
        .where(
            Reservation.club_id == club_id,
            Reservation.status == ReservationStatus.PENDING,
            Reservation.starts_at <= now,
        )
        .values(
            status=ReservationStatus.CANCELLED,
            cancelled_at=now,
            cancelled_by_id=None,
            cancel_reason=CancelReason.EXPIRED_UNCONFIRMED,
        )
        .returning(Reservation.id)
    )
    expired_count = len(expired.all())
    completed = await session.execute(
        update(Reservation)
        .where(
            Reservation.club_id == club_id,
            Reservation.status == ReservationStatus.CONFIRMED,
            Reservation.ends_at <= now,
        )
        .values(status=ReservationStatus.COMPLETED)
        .returning(Reservation.id)
    )
    return TransitionResult(expired=expired_count, completed=len(completed.all()))
