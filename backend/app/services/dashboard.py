"""
Tableros del panel. Todo se agrega en SQL, con rangos semiabiertos en la zona del club.
Las finanzas salen del libro de caja (services/cash.py) y de gastos; nunca de las reservas.
"""

from datetime import UTC, date, datetime, timedelta
from decimal import Decimal

from sqlalchemy import DateTime, and_, cast, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.time import day_bounds, month_bounds, today_in, tz, utcnow
from app.domain.enums import MembershipStatus, ReservationStatus
from app.domain.permissions import Permission
from app.models import (
    ACTIVE_RESERVATION_STATUSES,
    ClubMembership,
    Court,
    Expense,
    Payment,
    Reservation,
    StockItem,
    User,
)
from app.schemas.dashboard import (
    DashboardFinanceOut,
    DashboardOperationsOut,
    LowStockItem,
    LowStockOut,
    MonthFinance,
    UpcomingReservation,
)
from app.services.cash import INCOME, OUTFLOW, ZERO, ledger_window, money_sum
from app.services.context import StaffContext
from app.services.fees import FeeService

_UPCOMING_LIMIT = 10
_LOW_STOCK_LIMIT = 10
_SERIES_MONTHS = 6
_NOT_CANCELLED = (*ACTIVE_RESERVATION_STATUSES, ReservationStatus.COMPLETED)


class DashboardService:
    def __init__(self, session: AsyncSession, ctx: StaffContext) -> None:
        self.db = session
        self.ctx = ctx

    async def operations(self) -> DashboardOperationsOut:
        club = self.ctx.club
        zone = tz(club.timezone)
        today = today_in(zone)
        day_start, day_end = day_bounds(today, zone)
        # Ventana operable de hoy; sin horario configurado es el día completo.
        open_at = (
            datetime.combine(today, club.open_time, tzinfo=zone).astimezone(UTC)
            if club.open_time
            else day_start
        )
        close_at = (
            datetime.combine(today, club.close_time, tzinfo=zone).astimezone(UTC)
            if club.close_time
            else day_end
        )

        active_courts = (
            await self.db.execute(
                select(func.count()).where(
                    Court.club_id == self.ctx.club_id, Court.is_active.is_(True)
                )
            )
        ).scalar_one()

        overlap = func.least(Reservation.ends_at, close_at) - func.greatest(
            Reservation.starts_at, open_at
        )
        reservations_today, booked_seconds = (
            await self.db.execute(
                select(
                    func.count().filter(
                        Reservation.starts_at >= day_start, Reservation.starts_at < day_end
                    ),
                    func.coalesce(
                        func.sum(func.extract("epoch", overlap)).filter(
                            Court.is_active.is_(True),
                            Reservation.starts_at < close_at,
                            Reservation.ends_at > open_at,
                        ),
                        0,
                    ),
                )
                .select_from(Reservation)
                .join(Court, Court.id == Reservation.court_id)
                .where(
                    Reservation.club_id == self.ctx.club_id,
                    Reservation.status.in_(_NOT_CANCELLED),
                    Reservation.starts_at < day_end,
                    Reservation.ends_at > day_start,
                )
            )
        ).one()
        operable_seconds = int((close_at - open_at).total_seconds()) * active_courts
        occupancy = (
            (Decimal(booked_seconds) * 100 / operable_seconds).quantize(Decimal("0.1"))
            if operable_seconds
            else Decimal("0.0")
        )

        can_see_reservations = Permission.RESERVATIONS_READ in self.ctx.permissions
        upcoming = (
            (
                await self.db.execute(
                    select(Reservation, Court.name, User)
                    .join(Court, Court.id == Reservation.court_id)
                    .outerjoin(User, User.id == Reservation.user_id)
                    .where(
                        Reservation.club_id == self.ctx.club_id,
                        Reservation.status.in_(ACTIVE_RESERVATION_STATUSES),
                        Reservation.starts_at >= day_start,
                        Reservation.starts_at < day_end,
                        Reservation.ends_at > utcnow(),
                    )
                    .order_by(Reservation.starts_at, Court.name)
                    .limit(_UPCOMING_LIMIT)
                )
            ).all()
            if can_see_reservations
            else None
        )

        pending_requests = (
            (
                await self.db.execute(
                    select(func.count()).where(
                        ClubMembership.club_id == self.ctx.club_id,
                        ClubMembership.status == MembershipStatus.PENDING,
                    )
                )
            ).scalar_one()
            if Permission.MEMBERS_READ in self.ctx.permissions
            else None
        )

        return DashboardOperationsOut(
            date=today,
            reservations_today=reservations_today,
            active_courts=active_courts,
            occupancy_pct=occupancy,
            upcoming_reservations=None
            if upcoming is None
            else [
                UpcomingReservation(
                    id=reservation.id,
                    court_name=court_name,
                    customer_name=user.full_name if user else reservation.guest_name or "",
                    customer_type=reservation.customer_type,
                    starts_at=reservation.starts_at,
                    ends_at=reservation.ends_at,
                    status=reservation.status,
                )
                for reservation, court_name, user in upcoming
            ],
            pending_membership_requests=pending_requests,
            low_stock=(
                await self._low_stock() if Permission.STOCK_READ in self.ctx.permissions else None
            ),
        )

    async def _low_stock(self) -> LowStockOut:
        low = and_(
            StockItem.club_id == self.ctx.club_id,
            StockItem.deleted_at.is_(None),
            StockItem.quantity <= StockItem.min_quantity,
        )
        count = (await self.db.execute(select(func.count()).where(low))).scalar_one()
        items = await self.db.execute(
            select(StockItem).where(low).order_by(StockItem.name).limit(_LOW_STOCK_LIMIT)
        )
        return LowStockOut(
            count=count,
            items=[
                LowStockItem(
                    id=item.id,
                    name=item.name,
                    quantity=item.quantity,
                    min_quantity=item.min_quantity,
                    unit=item.unit,
                )
                for item in items.scalars()
            ],
        )

    async def finance(self) -> DashboardFinanceOut:
        club = self.ctx.club
        zone = tz(club.timezone)
        today = today_in(zone)
        months = _last_months(today, _SERIES_MONTHS)
        first_day = months[0]
        _, end_day = month_bounds(today.year, today.month)
        start, _ = day_bounds(first_day, zone)
        end, _ = day_bounds(end_day, zone)

        payment_month = func.date_trunc("month", func.timezone(club.timezone, Payment.occurred_at))
        payment_month = payment_month.label("period")
        payments = await self.db.execute(
            select(
                payment_month,
                money_sum(Payment.amount, INCOME),
                money_sum(Payment.amount, OUTFLOW),
            )
            .where(*ledger_window(self.ctx.club_id, start, end))
            .group_by(payment_month)
        )
        cash = {period.date(): (income, outflow) for period, income, outflow in payments.all()}

        expense_month = func.date_trunc("month", cast(Expense.expense_date, DateTime)).label(
            "period"
        )
        expenses = await self.db.execute(
            select(expense_month, money_sum(Expense.amount))
            .where(
                Expense.club_id == self.ctx.club_id,
                Expense.deleted_at.is_(None),
                Expense.expense_date >= first_day,
                Expense.expense_date < end_day,
            )
            .group_by(expense_month)
        )
        spent = {period.date(): total for period, total in expenses.all()}

        series = []
        for month_start in months:
            income, outflow = cash.get(month_start, (ZERO, ZERO))
            expense_total = spent.get(month_start, ZERO)
            series.append(
                MonthFinance(
                    year=month_start.year,
                    month=month_start.month,
                    income=income,
                    cash_outflow=outflow,
                    expenses=expense_total,
                    net=income - outflow - expense_total,
                )
            )
        return DashboardFinanceOut(
            current=series[-1],
            fees=await FeeService(self.db, self.ctx).summary(today.year, today.month),
            series=series,
        )


def _last_months(today: date, count: int) -> list[date]:
    """Primer día de los últimos `count` meses, del más viejo al actual."""
    months = [today.replace(day=1)]
    while len(months) < count:
        months.insert(0, (months[0] - timedelta(days=1)).replace(day=1))
    return months
