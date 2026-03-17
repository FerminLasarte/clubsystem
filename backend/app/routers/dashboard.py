# backend/app/routers/dashboard.py
from datetime import date, timedelta
from uuid import UUID

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import func, select, cast, String
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.middleware.tenant import get_current_club_id
from app.models.expense import Expense
from app.models.reservation import Reservation
from app.models.user import User

router = APIRouter()


class RecentReservation(BaseModel):
    id: UUID
    member_name: str
    court_name: str
    starts_at: str
    ends_at: str
    status: str
    total_price: float

    class Config:
        from_attributes = True


class DashboardKPIs(BaseModel):
    reservations_today: int
    reservations_today_delta: int
    reservations_this_month: int
    revenue_this_month: float
    revenue_last_month: float
    revenue_delta_pct: float
    active_members: int
    new_members_this_month: int
    expenses_this_month: float
    anomalies_pending: int
    recent_reservations: list[RecentReservation]


@router.get("/kpis", response_model=DashboardKPIs)
async def get_dashboard_kpis(
    club_id: UUID = Depends(get_current_club_id),
    db: AsyncSession = Depends(get_db),
):
    today = date.today()
    yesterday = today - timedelta(days=1)
    month_start = today.replace(day=1)
    last_month_start = (month_start - timedelta(days=1)).replace(day=1)
    last_month_end = month_start - timedelta(days=1)

    # Cast status a String para comparar con el ENUM
    status_col = cast(Reservation.status, String)

    # ── Reservas hoy ──────────────────────────────────────────
    res_today = await db.execute(
        select(func.count()).where(
            Reservation.club_id == club_id,
            func.date(Reservation.starts_at) == today,
            status_col != "cancelled",
        )
    )
    reservations_today = res_today.scalar() or 0

    res_yesterday = await db.execute(
        select(func.count()).where(
            Reservation.club_id == club_id,
            func.date(Reservation.starts_at) == yesterday,
            status_col != "cancelled",
        )
    )
    reservations_yesterday = res_yesterday.scalar() or 0

    # ── Reservas este mes ─────────────────────────────────────
    res_month = await db.execute(
        select(func.count()).where(
            Reservation.club_id == club_id,
            func.date(Reservation.starts_at) >= month_start,
            status_col != "cancelled",
        )
    )
    reservations_this_month = res_month.scalar() or 0

    # ── Ingresos este mes ─────────────────────────────────────
    rev_this = await db.execute(
        select(func.coalesce(func.sum(Reservation.paid_amount), 0)).where(
            Reservation.club_id == club_id,
            func.date(Reservation.starts_at) >= month_start,
            status_col == "confirmed",
        )
    )
    revenue_this_month = float(rev_this.scalar() or 0)

    rev_last = await db.execute(
        select(func.coalesce(func.sum(Reservation.paid_amount), 0)).where(
            Reservation.club_id == club_id,
            func.date(Reservation.starts_at) >= last_month_start,
            func.date(Reservation.starts_at) <= last_month_end,
            status_col == "confirmed",
        )
    )
    revenue_last_month = float(rev_last.scalar() or 0)

    revenue_delta_pct = (
        ((revenue_this_month - revenue_last_month) / revenue_last_month) * 100
        if revenue_last_month > 0 else 0.0
    )

    # ── Socios ────────────────────────────────────────────────
    active_members_res = await db.execute(
        select(func.count()).where(
            User.club_id == club_id,
            User.role == "member",
            User.is_active == True,
        )
    )
    active_members = active_members_res.scalar() or 0

    new_members_res = await db.execute(
        select(func.count()).where(
            User.club_id == club_id,
            User.role == "member",
            User.joined_at >= month_start,
        )
    )
    new_members_this_month = new_members_res.scalar() or 0

    # ── Gastos este mes ───────────────────────────────────────
    exp_res = await db.execute(
        select(func.coalesce(func.sum(Expense.amount), 0)).where(
            Expense.club_id == club_id,
            Expense.expense_date >= month_start,
        )
    )
    expenses_this_month = float(exp_res.scalar() or 0)

    anomalies_res = await db.execute(
        select(func.count()).where(
            Expense.club_id == club_id,
            Expense.anomaly_severity.isnot(None),
            Expense.reviewed_at.is_(None),
        )
    )
    anomalies_pending = anomalies_res.scalar() or 0

    # ── Reservas recientes ────────────────────────────────────
    from app.models.court import Court

    recent_q = await db.execute(
        select(
            Reservation.id,
            (User.first_name + " " + User.last_name).label("member_name"),
            Court.name.label("court_name"),
            Reservation.starts_at,
            Reservation.ends_at,
            cast(Reservation.status, String).label("status"),
            Reservation.total_price,
        )
        .join(User, Reservation.user_id == User.id)
        .join(Court, Reservation.court_id == Court.id)
        .where(Reservation.club_id == club_id)
        .order_by(Reservation.starts_at.desc())
        .limit(5)
    )
    rows = recent_q.fetchall()

    recent_reservations = [
        RecentReservation(
            id=r.id,
            member_name=r.member_name,
            court_name=r.court_name,
            starts_at=r.starts_at.strftime("%H:%M"),
            ends_at=r.ends_at.strftime("%H:%M"),
            status=r.status,
            total_price=float(r.total_price),
        )
        for r in rows
    ]

    return DashboardKPIs(
        reservations_today=reservations_today,
        reservations_today_delta=reservations_today - reservations_yesterday,
        reservations_this_month=reservations_this_month,
        revenue_this_month=revenue_this_month,
        revenue_last_month=revenue_last_month,
        revenue_delta_pct=revenue_delta_pct,
        active_members=active_members,
        new_members_this_month=new_members_this_month,
        expenses_this_month=expenses_this_month,
        anomalies_pending=anomalies_pending,
        recent_reservations=recent_reservations,
    )
