"""
Caja: el libro único de ingresos y egresos (`payments`).

Un cobro de reserva o de cuota es un Payment asociado. Anular un pago no lo borra: queda con
`voided_at` y deja de sumar. Las agregaciones de este módulo son la única definición de
"ingresos" y "egresos de caja"; el dashboard las reutiliza para no tener dos fuentes de verdad.
"""

from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import Any
from uuid import UUID

from fastapi.responses import Response
from sqlalchemy import ColumnElement, Numeric, Select, and_, func, literal, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased

from app.core.csv import csv_response
from app.core.errors import BusinessRuleViolation, Conflict, NotFound
from app.core.time import day_bounds, days_bounds, today_in, tz, utcnow
from app.domain.enums import FeeStatus, PaymentMethod, TransactionType
from app.models import ClubMembership, Court, MembershipFee, Payment, Reservation, User
from app.repositories.base import get_scoped
from app.schemas.cash import (
    CashDayOut,
    CashSummary,
    MethodTotals,
    MovementMember,
    MovementOut,
    MovementReservation,
    PaymentCreate,
)
from app.schemas.common import ExportRange
from app.services.context import StaffContext

ZERO = Decimal("0.00")
# Tolerancia para relojes de cliente apenas adelantados.
_FUTURE_TOLERANCE = timedelta(minutes=5)


def money_sum(column: Any, *conditions: ColumnElement[bool]) -> ColumnElement[Decimal]:
    """SUM(column) FILTER (WHERE ...) que devuelve 0.00 en lugar de NULL."""
    total = func.sum(column)
    filtered = total.filter(and_(*conditions)) if conditions else total
    return func.coalesce(filtered, literal(ZERO, Numeric(12, 2)))


INCOME = Payment.type == TransactionType.INCOME
OUTFLOW = Payment.type == TransactionType.OUTFLOW


def ledger_window(club_id: UUID, start: datetime, end: datetime) -> list[ColumnElement[bool]]:
    """Pagos vigentes (no anulados) del club en [start, end)."""
    return [
        Payment.club_id == club_id,
        Payment.voided_at.is_(None),
        Payment.occurred_at >= start,
        Payment.occurred_at < end,
    ]


async def collected_for_reservation(
    session: AsyncSession, club_id: UUID, reservation_id: UUID
) -> Decimal:
    """Neto cobrado de una reserva: ingresos menos devoluciones, sin anulados."""
    stmt = select(money_sum(Payment.amount, INCOME) - money_sum(Payment.amount, OUTFLOW)).where(
        Payment.club_id == club_id,
        Payment.reservation_id == reservation_id,
        Payment.voided_at.is_(None),
    )
    return (await session.execute(stmt)).scalar_one()


# Etiquetas de los exports CSV (los frontends tienen las suyas en @clubsystem/shared).
PAYMENT_METHOD_LABELS = {
    PaymentMethod.CASH: "Efectivo",
    PaymentMethod.CARD: "Tarjeta",
    PaymentMethod.TRANSFER: "Transferencia",
    PaymentMethod.MERCADOPAGO: "Mercado Pago",
}
_TYPE_LABELS = {TransactionType.INCOME: "Ingreso", TransactionType.OUTFLOW: "Egreso"}
_EXPORT_HEADER = (
    "Fecha y hora",
    "Tipo",
    "Medio",
    "Monto",
    "Descripción",
    "Socio",
    "N° de socio",
    "Reserva",
    "Registró",
    "Anulado el",
    "Motivo de anulación",
)


def _signed(type_: TransactionType, amount: Decimal) -> Decimal:
    return amount if type_ == TransactionType.INCOME else -amount


class CashService:
    def __init__(self, session: AsyncSession, ctx: StaffContext) -> None:
        self.db = session
        self.ctx = ctx

    async def day(self, day: date | None) -> CashDayOut:
        zone = tz(self.ctx.club.timezone)
        day = day or today_in(zone)
        start, end = day_bounds(day, zone)

        movements = await self._movements_between(start, end)

        # ROLLUP: una fila por método y una fila total (method NULL), todo en SQL.
        totals = await self.db.execute(
            select(
                Payment.method,
                money_sum(Payment.amount, INCOME).label("income"),
                money_sum(Payment.amount, OUTFLOW).label("outflow"),
            )
            .where(*ledger_window(self.ctx.club_id, start, end))
            .group_by(func.rollup(Payment.method))
        )
        by_method = {
            m: MethodTotals(method=m, income=ZERO, outflow=ZERO, net=ZERO) for m in PaymentMethod
        }
        income = outflow = ZERO
        for method, method_income, method_outflow in totals.all():
            if method is None:
                income, outflow = method_income, method_outflow
            else:
                by_method[PaymentMethod(method)] = MethodTotals(
                    method=method,
                    income=method_income,
                    outflow=method_outflow,
                    net=method_income - method_outflow,
                )
        return CashDayOut(
            date=day,
            timezone=self.ctx.club.timezone,
            movements=movements,
            summary=CashSummary(
                income=income,
                outflow=outflow,
                net=income - outflow,
                by_method=list(by_method.values()),
            ),
        )

    async def export(self, period: ExportRange) -> Response:
        """Todos los movimientos del rango, anulados incluidos (con la fecha y el motivo)."""
        zone = tz(self.ctx.club.timezone)
        movements = await self._movements_between(*days_bounds(period.from_, period.to, zone))

        def local(moment: datetime) -> str:
            return moment.astimezone(zone).strftime("%Y-%m-%d %H:%M")

        first, last = period.from_.isoformat(), period.to.isoformat()
        return csv_response(
            f"caja-{first}.csv" if first == last else f"caja-{first}-{last}.csv",
            _EXPORT_HEADER,
            (
                (
                    local(m.occurred_at),
                    _TYPE_LABELS[m.type],
                    PAYMENT_METHOD_LABELS[m.method],
                    m.amount,
                    m.description,
                    m.member.full_name if m.member else None,
                    m.member.member_number if m.member else None,
                    f"{m.reservation.court_name} · {local(m.reservation.starts_at)}"
                    f" · {m.reservation.customer_name}"
                    if m.reservation
                    else None,
                    m.created_by_name,
                    local(m.voided_at) if m.voided_at else None,
                    m.void_reason,
                )
                for m in movements
            ),
        )

    async def _movements_between(self, start: datetime, end: datetime) -> list[MovementOut]:
        rows = await self.db.execute(
            _movements_query(self.ctx.club_id)
            .where(Payment.occurred_at >= start, Payment.occurred_at < end)
            .order_by(Payment.occurred_at, Payment.created_at)
        )
        return [_movement(*row) for row in rows.all()]

    async def create(self, data: PaymentCreate) -> MovementOut:
        occurred_at = data.occurred_at or utcnow()
        if occurred_at > utcnow() + _FUTURE_TOLERANCE:
            raise BusinessRuleViolation("La fecha del movimiento no puede ser futura.")

        membership = None
        if data.membership_id is not None:
            membership = await get_scoped(
                self.db,
                ClubMembership,
                data.membership_id,
                self.ctx.club_id,
                not_found="Socio no encontrado.",
            )
        if data.reservation_id is not None:
            # Lock de la reserva: serializa cobros simultáneos para validar el saldo.
            reservation = await get_scoped(
                self.db,
                Reservation,
                data.reservation_id,
                self.ctx.club_id,
                not_found="Reserva no encontrada.",
                for_update=True,
            )
            if membership is not None and reservation.user_id != membership.user_id:
                raise BusinessRuleViolation("La reserva no es de ese socio.")
            await self._check_reservation_balance(reservation, _signed(data.type, data.amount))

        payment = Payment(
            club_id=self.ctx.club_id,
            type=data.type,
            amount=data.amount,
            method=data.method,
            description=data.description,
            membership_id=data.membership_id,
            reservation_id=data.reservation_id,
            occurred_at=occurred_at,
            created_by_id=self.ctx.user_id,
        )
        self.db.add(payment)
        await self.db.flush()
        return await self.movement(payment.id)

    async def void(self, payment_id: UUID, reason: str) -> MovementOut:
        payment = await get_scoped(
            self.db,
            Payment,
            payment_id,
            self.ctx.club_id,
            not_found="Movimiento no encontrado.",
            for_update=True,
        )
        if payment.voided_at is not None:
            raise Conflict("El movimiento ya está anulado.")
        if payment.reservation_id is not None:
            reservation = await get_scoped(
                self.db, Reservation, payment.reservation_id, self.ctx.club_id, for_update=True
            )
            await self._check_reservation_balance(
                reservation, -_signed(payment.type, payment.amount)
            )

        payment.voided_at = utcnow()
        payment.voided_by_id = self.ctx.user_id
        payment.void_reason = reason
        await self.db.flush()
        # La cuota cobrada con este pago vuelve a quedar pendiente (misma transacción).
        await self.db.execute(
            update(MembershipFee)
            .where(
                MembershipFee.club_id == self.ctx.club_id,
                MembershipFee.payment_id == payment.id,
                MembershipFee.status == FeeStatus.PAID,
            )
            .values(status=FeeStatus.PENDING, payment_id=None)
        )
        return await self.movement(payment.id)

    async def movement(self, payment_id: UUID) -> MovementOut:
        row = (
            await self.db.execute(
                _movements_query(self.ctx.club_id).where(Payment.id == payment_id)
            )
        ).one_or_none()
        if row is None:
            raise NotFound("Movimiento no encontrado.")
        return _movement(*row)

    async def _check_reservation_balance(self, reservation: Reservation, delta: Decimal) -> None:
        collected = await collected_for_reservation(self.db, self.ctx.club_id, reservation.id)
        after = collected + delta
        if after > reservation.total_price:
            raise BusinessRuleViolation(
                f"El total cobrado superaría el precio de la reserva ({reservation.total_price}). "
                f"Ya cobrado: {collected}.",
                code="reservation_overpaid",
            )
        if after < 0:
            raise BusinessRuleViolation(
                f"Lo devuelto superaría lo cobrado en la reserva ({collected}).",
                code="reservation_overrefunded",
            )


_MemberUser = aliased(User, name="member_user")
_Customer = aliased(User, name="customer")
_Creator = aliased(User, name="creator")


def _movements_query(
    club_id: UUID,
) -> Select[Payment, ClubMembership, User, Reservation, Court, User, User]:
    return (
        select(Payment, ClubMembership, _MemberUser, Reservation, Court, _Customer, _Creator)
        .outerjoin(
            ClubMembership,
            and_(
                ClubMembership.id == Payment.membership_id,
                ClubMembership.club_id == Payment.club_id,
            ),
        )
        .outerjoin(_MemberUser, _MemberUser.id == ClubMembership.user_id)
        .outerjoin(
            Reservation,
            and_(Reservation.id == Payment.reservation_id, Reservation.club_id == Payment.club_id),
        )
        .outerjoin(Court, Court.id == Reservation.court_id)
        .outerjoin(_Customer, _Customer.id == Reservation.user_id)
        .outerjoin(_Creator, _Creator.id == Payment.created_by_id)
        .where(Payment.club_id == club_id)
    )


def _movement(
    payment: Payment,
    membership: ClubMembership | None,
    member_user: User | None,
    reservation: Reservation | None,
    court: Court | None,
    customer: User | None,
    creator: User | None,
) -> MovementOut:
    member = None
    if membership is not None and member_user is not None:
        member = MovementMember(
            membership_id=membership.id,
            full_name=member_user.full_name,
            member_number=membership.member_number,
        )
    linked_reservation = None
    if reservation is not None and court is not None:
        linked_reservation = MovementReservation(
            reservation_id=reservation.id,
            court_name=court.name,
            customer_name=customer.full_name if customer else reservation.guest_name or "",
            starts_at=reservation.starts_at,
            ends_at=reservation.ends_at,
        )
    return MovementOut(
        id=payment.id,
        type=payment.type,
        amount=payment.amount,
        method=payment.method,
        description=payment.description,
        occurred_at=payment.occurred_at,
        created_at=payment.created_at,
        created_by_name=creator.full_name if creator else None,
        member=member,
        reservation=linked_reservation,
        voided_at=payment.voided_at,
        void_reason=payment.void_reason,
    )
