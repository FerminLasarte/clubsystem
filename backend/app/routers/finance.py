"""
ClubSync — Finance Router
=========================
Endpoints de resumen financiero diario (Caja Diaria).

Endpoints:
  GET  /api/v1/finance/daily-summary   → Ingresos + Retiros + Egresos + Balance neto del día

Lógica:
  - Ingresos:  SUM(payments WHERE transaction_type=INCOME AND date=?) por payment_method
  - Retiros:   SUM(payments WHERE transaction_type=OUTFLOW AND date=?)  (caja chica)
  - Egresos:   SUM(expenses WHERE expense_date=?)                       (gastos operativos)
  - Balance:   total_income - total_outflow - total_expenses

Multi-tenant:
  - club_id extraído del JWT vía get_current_club_id.

Observabilidad:
  - logger.info() en cada request.
"""

import logging
from datetime import date
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import cast, func, select, Date
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.middleware.tenant import get_current_club_id
from app.models.payment import Payment
from app.models.expense import Expense

logger = logging.getLogger(__name__)
router = APIRouter()


# ── Schemas ───────────────────────────────────────────────────────────────────

class DailySummary(BaseModel):
    date:             str
    total_income:     float          # cobros INCOME del día
    total_outflow:    float          # retiros / caja chica (OUTFLOW) del día
    total_expenses:   float          # gastos operativos (tabla expenses) del día
    net_balance:      float          # income - outflow - expenses
    income_by_method: dict[str, float]


# ── GET /daily-summary ────────────────────────────────────────────────────────

@router.get("/daily-summary", response_model=DailySummary)
async def get_daily_summary(
    date_filter: Optional[date] = Query(None, alias="date", description="Fecha YYYY-MM-DD (default: hoy)"),
    club_id:     UUID           = Depends(get_current_club_id),
    db:          AsyncSession   = Depends(get_db),
):
    """
    Devuelve el resumen financiero del día: ingresos (payments), egresos (expenses)
    y balance neto, con desglose de ingresos por método de pago.
    """
    target_date = date_filter or date.today()
    logger.info("GET /finance/daily-summary — club=%s date=%s", club_id, target_date)

    # ── Ingresos (INCOME) agrupados por método ────────────────────────────────
    income_q = (
        select(Payment.payment_method, func.sum(Payment.amount).label("total"))
        .where(
            Payment.club_id         == club_id,
            Payment.is_active.is_(True),
            Payment.transaction_type == "INCOME",
            cast(Payment.payment_date, Date) == target_date,
        )
        .group_by(Payment.payment_method)
    )
    income_rows = (await db.execute(income_q)).all()

    income_by_method: dict[str, float] = {
        row.payment_method: float(row.total)
        for row in income_rows
    }
    total_income = sum(income_by_method.values())

    # ── Retiros / caja chica (OUTFLOW) del día ────────────────────────────────
    outflow_q = (
        select(func.coalesce(func.sum(Payment.amount), 0).label("total"))
        .where(
            Payment.club_id         == club_id,
            Payment.is_active.is_(True),
            Payment.transaction_type == "OUTFLOW",
            cast(Payment.payment_date, Date) == target_date,
        )
    )
    total_outflow = float((await db.execute(outflow_q)).scalar() or 0)

    # ── Egresos operativos (tabla expenses) del día ───────────────────────────
    expense_q = (
        select(func.coalesce(func.sum(Expense.amount), 0).label("total"))
        .where(
            Expense.club_id      == club_id,
            Expense.is_active.is_(True),
            Expense.expense_date == target_date,
        )
    )
    total_expenses = float((await db.execute(expense_q)).scalar() or 0)

    return DailySummary(
        date=target_date.isoformat(),
        total_income=total_income,
        total_outflow=total_outflow,
        total_expenses=total_expenses,
        net_balance=total_income - total_outflow - total_expenses,
        income_by_method=income_by_method,
    )
