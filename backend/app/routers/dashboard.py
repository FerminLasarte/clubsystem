# backend/app/routers/dashboard.py
import logging
from datetime import date, datetime, timedelta
from uuid import UUID

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import cast, func, select, String, Date
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.middleware.tenant import get_current_club_id, require_role
from app.models.club_staff import ClubStaff
from app.models.court import Court
from app.models.expense import Expense
from app.models.payment import Payment
from app.models.reservation import Reservation
from app.models.user import User

logger = logging.getLogger(__name__)
router = APIRouter()


# ── GET /metrics ─────────────────────────────────────────────────────────────
# Métricas de snapshot del día actual: orientadas al widget superior del dashboard.

class DashboardMetrics(BaseModel):
    total_revenue: float        # paid_amount confirmadas HOY
    active_reservations: int    # reservas de HOY no canceladas
    available_courts: int       # canchas activas − canceladas ocupadas AHORA
    pending_staff: int          # invitaciones sin aceptar (status=PENDING)


@router.get("/metrics", response_model=DashboardMetrics)
async def get_dashboard_metrics(
    club_id: UUID = Depends(get_current_club_id),
    db: AsyncSession = Depends(get_db),
) -> DashboardMetrics:
    """
    Snapshot rápido del estado actual del club para el bloque superior del dashboard.

    - `total_revenue`       → Suma de paid_amount de reservas CONFIRMADAS de hoy.
    - `active_reservations` → Reservas de hoy en cualquier estado distinto de 'cancelled'.
    - `available_courts`    → Canchas activas del club menos las que están ocupadas
                              en este momento exacto (starts_at ≤ now < ends_at).
    - `pending_staff`       → Invitaciones de staff aún no aceptadas (status='PENDING').
    """
    today = date.today()
    now   = datetime.utcnow()           # Hora actual en UTC para calcular ocupación
    status_col = cast(Reservation.status, String)

    # ── 1. Ingresos de hoy (reservas confirmadas) ─────────────
    rev_res = await db.execute(
        select(func.coalesce(func.sum(Reservation.paid_amount), 0)).where(
            Reservation.club_id == club_id,
            func.date(Reservation.starts_at) == today,
            status_col == "confirmed",
        )
    )
    total_revenue = float(rev_res.scalar() or 0)

    # ── 2. Reservas activas hoy (no canceladas) ───────────────
    res_today = await db.execute(
        select(func.count()).where(
            Reservation.club_id == club_id,
            func.date(Reservation.starts_at) == today,
            status_col != "cancelled",
        )
    )
    active_reservations = res_today.scalar() or 0

    # ── 3. Canchas disponibles ────────────────────────────────
    total_courts_res = await db.execute(
        select(func.count()).where(
            Court.club_id == club_id,
            Court.is_active == True,
        )
    )
    total_courts = total_courts_res.scalar() or 0

    # Canchas ocupadas = reservas que solapan con el momento actual
    occupied_res = await db.execute(
        select(func.count(Reservation.court_id.distinct())).where(
            Reservation.club_id == club_id,
            Reservation.starts_at <= now,
            Reservation.ends_at   >  now,
            status_col != "cancelled",
        )
    )
    occupied = occupied_res.scalar() or 0
    available_courts = max(0, total_courts - occupied)

    # ── 4. Invitaciones de staff pendientes ───────────────────
    pending_res = await db.execute(
        select(func.count()).where(
            ClubStaff.club_id == club_id,
            ClubStaff.status  == "PENDING",
        )
    )
    pending_staff = pending_res.scalar() or 0

    return DashboardMetrics(
        total_revenue=total_revenue,
        active_reservations=active_reservations,
        available_courts=available_courts,
        pending_staff=pending_staff,
    )


# ── Schemas para /kpis ────────────────────────────────────────────────────────

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
    # Tras el RBAC, los usuarios no tienen `role` propio.
    # Todos los Users con club_id == club activo son socios.
    active_members_res = await db.execute(
        select(func.count()).where(
            User.club_id == club_id,
            User.is_active == True,
        )
    )
    active_members = active_members_res.scalar() or 0

    new_members_res = await db.execute(
        select(func.count()).where(
            User.club_id == club_id,
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


# ── GET /summary (OWNER only) ─────────────────────────────────────────────────

class ManagerSummary(BaseModel):
    """
    Resumen gerencial mensual para el Dashboard Principal.
    Accesible solo por OWNER (RBAC).
    """
    total_members:      int    # socios activos del club
    today_reservations: int    # reservas de hoy (no canceladas)
    monthly_income:     float  # cobros INCOME del mes (tabla payments)
    monthly_expenses:   float  # gastos operativos + retiros OUTFLOW del mes
    net_profit:         float  # monthly_income - monthly_expenses


@router.get("/summary", response_model=ManagerSummary)
async def get_manager_summary(
    club_id: UUID  = Depends(get_current_club_id),
    _roles:  list  = Depends(require_role("OWNER")),
    db:      AsyncSession = Depends(get_db),
):
    """
    Dashboard gerencial: KPIs clave del mes para el dueño del club.
    Requiere rol OWNER (HTTP 403 si no lo tiene).
    """
    logger.info("GET /dashboard/summary — club=%s", club_id)

    today       = date.today()
    month_start = today.replace(day=1)
    status_col  = cast(Reservation.status, String)

    # ── 1. Socios activos ─────────────────────────────────────────────────────
    members_res = await db.execute(
        select(func.count()).where(
            User.club_id   == club_id,
            User.is_active.is_(True),
        )
    )
    total_members = int(members_res.scalar() or 0)

    # ── 2. Reservas de hoy (no canceladas) ───────────────────────────────────
    reservations_res = await db.execute(
        select(func.count()).where(
            Reservation.club_id == club_id,
            func.date(Reservation.starts_at) == today,
            status_col != "cancelled",
        )
    )
    today_reservations = int(reservations_res.scalar() or 0)

    # ── 3. Ingresos del mes (payments INCOME) ────────────────────────────────
    income_res = await db.execute(
        select(func.coalesce(func.sum(Payment.amount), 0)).where(
            Payment.club_id         == club_id,
            Payment.is_active.is_(True),
            Payment.transaction_type == "INCOME",
            cast(Payment.payment_date, Date) >= month_start,
        )
    )
    monthly_income = float(income_res.scalar() or 0)

    # ── 4. Egresos del mes = gastos operativos + retiros OUTFLOW ─────────────
    expenses_res = await db.execute(
        select(func.coalesce(func.sum(Expense.amount), 0)).where(
            Expense.club_id      == club_id,
            Expense.is_active.is_(True),
            Expense.expense_date >= month_start,
        )
    )
    monthly_operational = float(expenses_res.scalar() or 0)

    outflow_res = await db.execute(
        select(func.coalesce(func.sum(Payment.amount), 0)).where(
            Payment.club_id         == club_id,
            Payment.is_active.is_(True),
            Payment.transaction_type == "OUTFLOW",
            cast(Payment.payment_date, Date) >= month_start,
        )
    )
    monthly_outflow = float(outflow_res.scalar() or 0)

    monthly_expenses = monthly_operational + monthly_outflow

    logger.info(
        "Summary club=%s members=%s reservations=%s income=%s expenses=%s",
        club_id, total_members, today_reservations, monthly_income, monthly_expenses,
    )

    return ManagerSummary(
        total_members=total_members,
        today_reservations=today_reservations,
        monthly_income=monthly_income,
        monthly_expenses=monthly_expenses,
        net_profit=monthly_income - monthly_expenses,
    )
