"""
Cuotas sociales. Cobrar una cuota crea su Payment en la caja; anular ese pago (services/cash.py)
la devuelve a PENDING. Los cambios de estado son UPDATE condicionales: dos cobros simultáneos
de la misma cuota no generan dos ingresos.
"""

import calendar
from datetime import date
from typing import Any, cast
from uuid import UUID

from fastapi.responses import Response
from sqlalchemy import Select, and_, exists, func, literal, or_, select, text, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.csv import csv_response
from app.core.errors import BusinessRuleViolation, Conflict, NotFound
from app.core.sql import contains_pattern
from app.core.time import today_in, tz, utcnow
from app.domain.enums import FeeStatus, MembershipStatus, PaymentMethod, TransactionType
from app.models import ClubMembership, MembershipFee, MembershipPlan, Payment, User
from app.repositories.base import paginate
from app.schemas.common import Page
from app.schemas.fees import (
    FeeFilters,
    FeeGenerateOut,
    FeeGenerateRequest,
    FeeOut,
    FeeSummaryOut,
    FeeTotals,
)
from app.services.cash import PAYMENT_METHOD_LABELS, money_sum
from app.services.context import StaffContext

_STATUS_LABELS = {
    FeeStatus.PENDING: "Pendiente",
    FeeStatus.PAID: "Cobrada",
    FeeStatus.CANCELLED: "Cancelada",
}
_EXPORT_HEADER = (
    "Socio",
    "N° de socio",
    "Plan",
    "Período",
    "Monto",
    "Estado",
    "Vence",
    "Vencida",
    "Cobrada el",
    "Medio de pago",
)


class FeeService:
    def __init__(self, session: AsyncSession, ctx: StaffContext) -> None:
        self.db = session
        self.ctx = ctx

    async def generate(self, data: FeeGenerateRequest) -> FeeGenerateOut:
        last_day = calendar.monthrange(data.year, data.month)[1]
        due_date = date(data.year, data.month, min(data.due_day, last_day))
        plan_join = and_(
            MembershipPlan.id == ClubMembership.plan_id,
            MembershipPlan.club_id == ClubMembership.club_id,
        )
        billable = and_(MembershipPlan.is_active.is_(True), MembershipPlan.monthly_fee > 0)
        approved = and_(
            ClubMembership.club_id == self.ctx.club_id,
            ClubMembership.status == MembershipStatus.APPROVED,
        )

        approved_count, billable_count = (
            await self.db.execute(
                select(func.count(), func.count().filter(billable))
                .select_from(ClubMembership)
                .outerjoin(MembershipPlan, plan_join)
                .where(approved)
            )
        ).one()

        # Una cuota cancelada también cuenta como "ya generada": regenerar el período no
        # revive lo que el club decidió no cobrar.
        already_billed = exists().where(
            MembershipFee.membership_id == ClubMembership.id,
            MembershipFee.year == data.year,
            MembershipFee.month == data.month,
        )
        rows = (
            select(
                func.gen_random_uuid(),
                ClubMembership.club_id,
                ClubMembership.id,
                MembershipPlan.name,
                literal(data.year),
                literal(data.month),
                MembershipPlan.monthly_fee,
                literal(FeeStatus.PENDING.value),
                literal(due_date),
            )
            .join(MembershipPlan, plan_join)
            .where(approved, billable, ~already_billed)
        )
        # ON CONFLICT cubre la carrera con otra generación simultánea del mismo período.
        stmt = (
            insert(MembershipFee)
            .from_select(
                [
                    "id",
                    "club_id",
                    "membership_id",
                    "plan_name",
                    "year",
                    "month",
                    "amount",
                    "status",
                    "due_date",
                ],
                rows,
            )
            .on_conflict_do_nothing(
                index_elements=["membership_id", "year", "month"],
                index_where=text("status <> 'CANCELLED'"),
            )
            .returning(MembershipFee.id)
        )
        created = len((await self.db.execute(stmt)).all())
        return FeeGenerateOut(
            created=created,
            skipped=billable_count - created,
            without_plan=approved_count - billable_count,
        )

    async def find(self, filters: FeeFilters) -> Page[FeeOut]:
        stmt = _fees_query(self.ctx.club_id)
        if filters.year is not None:
            stmt = stmt.where(MembershipFee.year == filters.year)
        if filters.month is not None:
            stmt = stmt.where(MembershipFee.month == filters.month)
        if filters.status is not None:
            stmt = stmt.where(MembershipFee.status == filters.status)
        if filters.search:
            pattern = contains_pattern(filters.search)
            stmt = stmt.where(
                or_(
                    (User.first_name + " " + User.last_name).ilike(pattern, escape="\\"),
                    (User.last_name + " " + User.first_name).ilike(pattern, escape="\\"),
                    ClubMembership.member_number.ilike(pattern, escape="\\"),
                )
            )
        stmt = stmt.order_by(
            MembershipFee.year.desc(),
            MembershipFee.month.desc(),
            User.last_name,
            User.first_name,
            MembershipFee.id,
        )
        # paginate tipa Select[Any]; Select es invariante en sus columnas.
        rows, total = await paginate(self.db, cast(Select[Any], stmt), filters)
        today = self._today()
        return Page(
            items=[_fee_out(*row, today=today) for row in rows],
            total=total,
            page=filters.page,
            page_size=filters.page_size,
        )

    async def export(self, year: int, month: int) -> Response:
        """Todas las cuotas del mes (canceladas incluidas), ordenadas por socio."""
        zone = tz(self.ctx.club.timezone)
        rows = await self.db.execute(
            _fees_query(self.ctx.club_id)
            .where(MembershipFee.year == year, MembershipFee.month == month)
            .order_by(User.last_name, User.first_name, MembershipFee.id)
        )
        today = self._today()
        fees = [_fee_out(*row, today=today) for row in rows.all()]
        return csv_response(
            f"cuotas-{year}-{month:02d}.csv",
            _EXPORT_HEADER,
            (
                (
                    f.member_name,
                    f.member_number,
                    f.plan_name,
                    f"{f.month:02d}/{f.year}",
                    f.amount,
                    _STATUS_LABELS[f.status],
                    f.due_date,
                    "Sí" if f.is_overdue else "No",
                    f.paid_at.astimezone(zone).strftime("%Y-%m-%d %H:%M") if f.paid_at else None,
                    PAYMENT_METHOD_LABELS[f.payment_method] if f.payment_method else None,
                )
                for f in fees
            ),
        )

    async def pay(self, fee_id: UUID, method: PaymentMethod) -> FeeOut:
        fee, _, user, _ = await self._row(fee_id)
        if fee.status != FeeStatus.PENDING:
            raise Conflict(_not_pending(fee.status))
        if fee.amount <= 0:
            raise BusinessRuleViolation("Una cuota sin monto no se cobra.")

        payment = Payment(
            club_id=self.ctx.club_id,
            type=TransactionType.INCOME,
            amount=fee.amount,
            method=method,
            description=(f"Cuota {fee.month:02d}/{fee.year} · {fee.plan_name} · {user.full_name}")[
                :255
            ],
            membership_id=fee.membership_id,
            occurred_at=utcnow(),
            created_by_id=self.ctx.user_id,
        )
        self.db.add(payment)
        await self.db.flush()
        # Condicional: si otro request la cobró primero, no actualiza nada y el Payment de
        # este request se descarta con el rollback.
        paid = await self.db.execute(
            update(MembershipFee)
            .where(
                MembershipFee.id == fee_id,
                MembershipFee.club_id == self.ctx.club_id,
                MembershipFee.status == FeeStatus.PENDING,
            )
            .values(status=FeeStatus.PAID, payment_id=payment.id)
            .returning(MembershipFee.id)
        )
        if paid.scalar_one_or_none() is None:
            raise Conflict("La cuota ya fue cobrada o cancelada.")
        return await self.get(fee_id)

    async def cancel(self, fee_id: UUID) -> FeeOut:
        cancelled = await self.db.execute(
            update(MembershipFee)
            .where(
                MembershipFee.id == fee_id,
                MembershipFee.club_id == self.ctx.club_id,
                MembershipFee.status == FeeStatus.PENDING,
            )
            .values(status=FeeStatus.CANCELLED, cancelled_at=utcnow())
            .returning(MembershipFee.id)
        )
        if cancelled.scalar_one_or_none() is None:
            fee, *_ = await self._row(fee_id)
            raise Conflict(_not_pending(fee.status))
        return await self.get(fee_id)

    async def get(self, fee_id: UUID) -> FeeOut:
        return _fee_out(*await self._row(fee_id), today=self._today())

    async def summary(self, year: int, month: int) -> FeeSummaryOut:
        issued = MembershipFee.status != FeeStatus.CANCELLED
        paid = MembershipFee.status == FeeStatus.PAID
        pending = MembershipFee.status == FeeStatus.PENDING
        row = (
            await self.db.execute(
                select(
                    func.count().filter(issued),
                    money_sum(MembershipFee.amount, issued),
                    func.count().filter(paid),
                    money_sum(MembershipFee.amount, paid),
                    func.count().filter(pending),
                    money_sum(MembershipFee.amount, pending),
                ).where(
                    MembershipFee.club_id == self.ctx.club_id,
                    MembershipFee.year == year,
                    MembershipFee.month == month,
                )
            )
        ).one()
        return FeeSummaryOut(
            year=year,
            month=month,
            issued=FeeTotals(count=row[0], amount=row[1]),
            collected=FeeTotals(count=row[2], amount=row[3]),
            pending=FeeTotals(count=row[4], amount=row[5]),
        )

    async def _row(
        self, fee_id: UUID
    ) -> tuple[MembershipFee, ClubMembership, User, Payment | None]:
        row = (
            await self.db.execute(
                _fees_query(self.ctx.club_id)
                .where(MembershipFee.id == fee_id)
                # Puede venir de un UPDATE recién hecho: no reutilizar el objeto en memoria.
                .execution_options(populate_existing=True)
            )
        ).one_or_none()
        if row is None:
            raise NotFound("Cuota no encontrada.")
        fee, membership, user, payment = row
        return fee, membership, user, payment

    def _today(self) -> date:
        return today_in(tz(self.ctx.club.timezone))


def _not_pending(status: FeeStatus) -> str:
    if status == FeeStatus.PAID:
        return "La cuota ya fue cobrada."
    return "La cuota está cancelada."


def _fees_query(club_id: UUID) -> Select[MembershipFee, ClubMembership, User, Payment]:
    return (
        select(MembershipFee, ClubMembership, User, Payment)
        .join(
            ClubMembership,
            and_(
                ClubMembership.id == MembershipFee.membership_id,
                ClubMembership.club_id == MembershipFee.club_id,
            ),
        )
        .join(User, User.id == ClubMembership.user_id)
        .outerjoin(
            Payment,
            and_(Payment.id == MembershipFee.payment_id, Payment.club_id == MembershipFee.club_id),
        )
        .where(MembershipFee.club_id == club_id)
    )


def _fee_out(
    fee: MembershipFee,
    membership: ClubMembership,
    user: User,
    payment: Payment | None,
    *,
    today: date,
) -> FeeOut:
    return FeeOut(
        id=fee.id,
        membership_id=fee.membership_id,
        member_name=user.full_name,
        member_number=membership.member_number,
        plan_name=fee.plan_name,
        year=fee.year,
        month=fee.month,
        amount=fee.amount,
        status=fee.status,
        due_date=fee.due_date,
        is_overdue=fee.status == FeeStatus.PENDING and fee.due_date < today,
        payment_id=fee.payment_id,
        paid_at=payment.occurred_at if payment else None,
        payment_method=payment.method if payment else None,
        cancelled_at=fee.cancelled_at,
        created_at=fee.created_at,
    )
