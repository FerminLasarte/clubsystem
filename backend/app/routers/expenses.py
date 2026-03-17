# backend/app/routers/expenses.py
from datetime import date
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import select, func, cast, String
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.middleware.tenant import get_current_club_id, get_current_user_id
from app.models.expense import Expense

router = APIRouter()


class ExpenseOut(BaseModel):
    id: UUID
    category: str
    description: str
    amount: float
    currency: str
    expense_date: date
    vendor_name: Optional[str]
    anomaly_score: Optional[float]
    anomaly_severity: Optional[str]
    anomaly_reason: Optional[str]
    anomaly_llm_explanation: Optional[str]
    reviewed_at: Optional[str]

    class Config:
        from_attributes = True


class ExpenseCreate(BaseModel):
    category: str
    description: str = Field(..., min_length=3, max_length=500)
    amount: float = Field(..., gt=0)
    currency: str = "ARS"
    expense_date: date
    vendor_name: Optional[str] = None
    notes: Optional[str] = None


class ExpenseStats(BaseModel):
    total_amount: float
    count: int
    by_category: dict
    anomalies_pending: int


@router.get("/", response_model=list[ExpenseOut])
async def list_expenses(
    category: Optional[str] = Query(None),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    has_anomaly: Optional[bool] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    club_id: UUID = Depends(get_current_club_id),
    db: AsyncSession = Depends(get_db),
):
    cat_col = cast(Expense.category, String)
    q = select(Expense).where(Expense.club_id == club_id)

    if category:
        q = q.where(cat_col == category)
    if date_from:
        q = q.where(Expense.expense_date >= date_from)
    if date_to:
        q = q.where(Expense.expense_date <= date_to)
    if has_anomaly is True:
        q = q.where(Expense.anomaly_severity.isnot(None))
    if has_anomaly is False:
        q = q.where(Expense.anomaly_severity.is_(None))

    q = q.order_by(Expense.expense_date.desc())
    q = q.offset((page - 1) * page_size).limit(page_size)

    result = await db.execute(q)
    return result.scalars().all()


@router.get("/stats", response_model=ExpenseStats)
async def get_expense_stats(
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    club_id: UUID = Depends(get_current_club_id),
    db: AsyncSession = Depends(get_db),
):
    cat_col = cast(Expense.category, String)
    q = select(Expense).where(Expense.club_id == club_id)
    if date_from:
        q = q.where(Expense.expense_date >= date_from)
    if date_to:
        q = q.where(Expense.expense_date <= date_to)

    result = await db.execute(q)
    expenses = result.scalars().all()

    by_cat: dict = {}
    for e in expenses:
        key = str(e.category)
        by_cat[key] = by_cat.get(key, 0) + float(e.amount)

    anomaly_q = select(func.count()).where(
        Expense.club_id == club_id,
        Expense.anomaly_severity.isnot(None),
        Expense.reviewed_at.is_(None),
    )
    anomalies_pending = (await db.execute(anomaly_q)).scalar() or 0

    return ExpenseStats(
        total_amount=sum(float(e.amount) for e in expenses),
        count=len(expenses),
        by_category=by_cat,
        anomalies_pending=anomalies_pending,
    )


@router.post("/", response_model=ExpenseOut, status_code=201)
async def create_expense(
    payload: ExpenseCreate,
    club_id: UUID = Depends(get_current_club_id),
    user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    expense = Expense(
        club_id=club_id,
        created_by=user_id,
        **payload.model_dump(),
    )
    db.add(expense)
    await db.commit()
    await db.refresh(expense)

    # ── Auto-run anomaly analysis ─────────────────────────
    try:
        from app.services.anomaly_detector import AnomalyDetectorService

        detector = AnomalyDetectorService(db)
        analysis = await detector.analyze(expense)
        expense.anomaly_score = analysis.score
        expense.anomaly_severity = analysis.severity
        expense.anomaly_reason = analysis.reason
        expense.anomaly_llm_explanation = analysis.llm_explanation
        await db.commit()
        await db.refresh(expense)
    except Exception:
        pass  # Non-blocking: if analysis fails, expense still created

    return expense


@router.patch("/{expense_id}/review")
async def mark_reviewed(
    expense_id: UUID,
    club_id: UUID = Depends(get_current_club_id),
    user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    from datetime import datetime
    result = await db.execute(
        select(Expense).where(Expense.id == expense_id, Expense.club_id == club_id)
    )
    expense = result.scalar_one_or_none()
    if not expense:
        raise HTTPException(status_code=404, detail="Gasto no encontrado")
    expense.reviewed_by = user_id
    expense.reviewed_at = datetime.utcnow()
    await db.commit()
    return {"status": "reviewed"}


# ── AI Anomaly endpoints ──────────────────────────────────────
@router.post("/{expense_id}/analyze", tags=["AI"])
async def analyze_expense(
    expense_id: UUID,
    club_id: UUID = Depends(get_current_club_id),
    db: AsyncSession = Depends(get_db),
):
    """Analiza un gasto individual con el detector estadístico."""
    from app.services.anomaly_detector import AnomalyDetectorService

    result = await db.execute(
        select(Expense).where(Expense.id == expense_id, Expense.club_id == club_id)
    )
    expense = result.scalar_one_or_none()
    if not expense:
        raise HTTPException(status_code=404, detail="Gasto no encontrado")

    detector = AnomalyDetectorService(db)
    analysis = await detector.analyze(expense)

    expense.anomaly_score = analysis.score
    expense.anomaly_severity = analysis.severity
    expense.anomaly_reason = analysis.reason
    expense.anomaly_llm_explanation = analysis.llm_explanation
    await db.commit()

    return {
        "expense_id": expense_id,
        "score": analysis.score,
        "severity": analysis.severity,
        "reason": analysis.reason,
        "llm_explanation": analysis.llm_explanation,
    }


@router.post("/analyze-all", tags=["AI"])
async def analyze_all_expenses(
    club_id: UUID = Depends(get_current_club_id),
    db: AsyncSession = Depends(get_db),
):
    """
    Analiza TODOS los gastos del club que no tengan análisis todavía.
    Útil para correr al inicio o después de cargar datos históricos.
    """
    from app.services.anomaly_detector import AnomalyDetectorService
    from datetime import datetime

    result = await db.execute(
        select(Expense).where(
            Expense.club_id == club_id,
            Expense.anomaly_score.is_(None),
        )
    )
    expenses = result.scalars().all()

    if not expenses:
        return {"analyzed": 0, "anomalies_found": 0}

    detector = AnomalyDetectorService(db)
    anomalies_found = 0

    for expense in expenses:
        analysis = await detector.analyze(expense)
        expense.anomaly_score = analysis.score
        expense.anomaly_severity = analysis.severity
        expense.anomaly_reason = analysis.reason
        expense.anomaly_llm_explanation = analysis.llm_explanation
        if analysis.severity:
            anomalies_found += 1

    await db.commit()

    return {
        "analyzed": len(expenses),
        "anomalies_found": anomalies_found,
    }
