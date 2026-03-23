"""
ClubSystem — Expenses Router
==========================
Gestión de gastos operativos del club.

Endpoints:
  GET    /api/v1/expenses/stats          → Estadísticas del mes / período.
  GET    /api/v1/expenses/export/csv     → Exporta CSV del período (day|month|year).
  GET    /api/v1/expenses                → Lista gastos activos (filtros: category, fechas, anomalía).
  POST   /api/v1/expenses                → Crea un gasto + análisis de anomalía automático.
  PUT    /api/v1/expenses/{id}           → Edita un gasto.
  DELETE /api/v1/expenses/{id}           → Soft-delete (is_active = False).
  PATCH  /api/v1/expenses/{id}/review    → Marca anomalía como revisada.
  POST   /api/v1/expenses/{id}/analyze   → Análisis manual de anomalía (AI).
  POST   /api/v1/expenses/analyze-all   → Analiza todos los gastos sin análisis.

Multi-tenant:
  - club_id extraído del JWT vía get_current_club_id.
  - Todos los queries incluyen WHERE club_id = <jwt_club_id>.

Observabilidad:
  - logger.info()  en operaciones exitosas.
  - logger.error() + await db.rollback() en cada bloque except.
"""

import csv
import io
import logging
from datetime import date, datetime
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import cast, func, select, String
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.middleware.tenant import get_current_club_id, get_current_user_id
from app.models.expense import Expense

logger = logging.getLogger(__name__)
router = APIRouter()


# ── Category catalogue ────────────────────────────────────────────────────────

VALID_CATEGORIES = frozenset({
    "maintenance", "utilities", "salaries", "equipment",
    "marketing", "supplies", "other",
})

CATEGORY_LABELS: dict[str, str] = {
    "maintenance": "Mantenimiento",
    "utilities":   "Servicios",
    "salaries":    "Sueldos",
    "equipment":   "Equipamiento",
    "marketing":   "Marketing",
    "supplies":    "Insumos",
    "other":       "Otros",
}


# ── Schemas ───────────────────────────────────────────────────────────────────

class ExpenseOut(BaseModel):
    id:                      UUID
    category:                str
    description:             str
    amount:                  float
    currency:                str
    expense_date:            date
    vendor_name:             Optional[str]
    is_active:               bool
    anomaly_score:           Optional[float]
    anomaly_severity:        Optional[str]
    anomaly_reason:          Optional[str]
    anomaly_llm_explanation: Optional[str]
    reviewed_at:             Optional[datetime]
    created_at:              datetime

    class Config:
        from_attributes = True


class ExpenseCreate(BaseModel):
    category:     str   = Field(..., description="maintenance|utilities|salaries|equipment|marketing|supplies|other")
    description:  str   = Field(..., min_length=3, max_length=500)
    amount:       float = Field(..., gt=0)
    expense_date: date
    currency:     str   = "ARS"
    vendor_name:  Optional[str] = None
    notes:        Optional[str] = None


class ExpenseUpdate(BaseModel):
    category:     Optional[str]   = None
    description:  Optional[str]   = Field(None, min_length=3, max_length=500)
    amount:       Optional[float] = Field(None, gt=0)
    expense_date: Optional[date]  = None
    vendor_name:  Optional[str]   = None
    notes:        Optional[str]   = None


class ExpenseStats(BaseModel):
    total_amount:      float
    count:             int
    by_category:       dict
    anomalies_pending: int


# ── GET /stats ────────────────────────────────────────────────────────────────

@router.get("/stats", response_model=ExpenseStats)
async def get_expense_stats(
    date_from: Optional[date] = Query(None),
    date_to:   Optional[date] = Query(None),
    club_id:   UUID           = Depends(get_current_club_id),
    db:        AsyncSession   = Depends(get_db),
):
    logger.info("GET /expenses/stats — club=%s", club_id)

    q = select(Expense).where(Expense.club_id == club_id, Expense.is_active.is_(True))
    if date_from:
        q = q.where(Expense.expense_date >= date_from)
    if date_to:
        q = q.where(Expense.expense_date <= date_to)

    result   = await db.execute(q)
    expenses = result.scalars().all()

    by_cat: dict[str, float] = {}
    for e in expenses:
        key          = str(e.category)
        by_cat[key]  = by_cat.get(key, 0.0) + float(e.amount)

    anomaly_q = select(func.count()).where(
        Expense.club_id == club_id,
        Expense.is_active.is_(True),
        Expense.anomaly_severity.isnot(None),
        Expense.reviewed_at.is_(None),
    )
    anomalies_pending = (await db.execute(anomaly_q)).scalar() or 0

    return ExpenseStats(
        total_amount=sum(float(e.amount) for e in expenses),
        count=len(expenses),
        by_category=by_cat,
        anomalies_pending=int(anomalies_pending),
    )


# ── GET /export/csv ───────────────────────────────────────────────────────────

@router.get("/export/csv")
async def export_expenses_csv(
    period:  str          = Query(..., pattern="^(day|month|year)$"),
    club_id: UUID         = Depends(get_current_club_id),
    db:      AsyncSession = Depends(get_db),
):
    """
    Exporta los gastos activos del período como CSV con fila de total al pie.
    period: day | month | year
    """
    logger.info("GET /expenses/export/csv — club=%s period=%s", club_id, period)

    today = date.today()
    if period == "day":
        date_from = today
        date_to   = today
        label     = today.strftime("%Y-%m-%d")
    elif period == "month":
        date_from = today.replace(day=1)
        date_to   = today
        label     = today.strftime("%Y-%m")
    else:  # year
        date_from = today.replace(month=1, day=1)
        date_to   = today
        label     = str(today.year)

    q = (
        select(Expense)
        .where(
            Expense.club_id      == club_id,
            Expense.is_active.is_(True),
            Expense.expense_date >= date_from,
            Expense.expense_date <= date_to,
        )
        .order_by(Expense.expense_date.asc())
    )
    result   = await db.execute(q)
    expenses = result.scalars().all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Fecha", "Categoría", "Descripción", "Proveedor", "Monto", "Moneda"])

    total = 0.0
    for e in expenses:
        cat_label = CATEGORY_LABELS.get(str(e.category), str(e.category))
        writer.writerow([
            e.expense_date.strftime("%d/%m/%Y"),
            cat_label,
            e.description,
            e.vendor_name or "",
            f"{float(e.amount):.2f}",
            e.currency,
        ])
        total += float(e.amount)

    writer.writerow([])  # blank separator
    writer.writerow(["GASTO TOTAL DEL PERÍODO", "", "", "", f"{total:.2f}", ""])

    output.seek(0)
    filename = f"gastos_{label}.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ── GET / ─────────────────────────────────────────────────────────────────────

@router.get("/", response_model=list[ExpenseOut])
async def list_expenses(
    category:    Optional[str]  = Query(None),
    date_from:   Optional[date] = Query(None),
    date_to:     Optional[date] = Query(None),
    has_anomaly: Optional[bool] = Query(None),
    page:        int            = Query(1, ge=1),
    page_size:   int            = Query(50, ge=1, le=200),
    club_id:     UUID           = Depends(get_current_club_id),
    db:          AsyncSession   = Depends(get_db),
):
    logger.info("GET /expenses — club=%s category=%s", club_id, category)

    cat_col = cast(Expense.category, String)
    q = select(Expense).where(Expense.club_id == club_id, Expense.is_active.is_(True))

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


# ── POST / ────────────────────────────────────────────────────────────────────

@router.post("/", response_model=ExpenseOut, status_code=201)
async def create_expense(
    payload: ExpenseCreate,
    club_id: UUID         = Depends(get_current_club_id),
    user_id: UUID         = Depends(get_current_user_id),
    db:      AsyncSession = Depends(get_db),
):
    logger.info("POST /expenses — club=%s category=%s amount=%s", club_id, payload.category, payload.amount)

    if payload.category not in VALID_CATEGORIES:
        raise HTTPException(
            status_code=422,
            detail=f"Categoría inválida. Opciones: {', '.join(sorted(VALID_CATEGORIES))}",
        )

    try:
        expense = Expense(
            club_id    = club_id,
            created_by = user_id,
            **payload.model_dump(),
        )
        db.add(expense)
        await db.commit()
        await db.refresh(expense)
    except Exception as exc:
        await db.rollback()
        logger.error("Error al crear gasto — club=%s: %s", club_id, exc, exc_info=True)
        raise HTTPException(status_code=500, detail="Error al crear el gasto")

    # Non-blocking anomaly analysis — failure never blocks the response
    try:
        from app.services.anomaly_detector import AnomalyDetectorService
        detector = AnomalyDetectorService(db)
        analysis = await detector.analyze(expense)
        expense.anomaly_score            = analysis.score
        expense.anomaly_severity         = analysis.severity
        expense.anomaly_reason           = analysis.reason
        expense.anomaly_llm_explanation  = analysis.llm_explanation
        await db.commit()
        await db.refresh(expense)
    except Exception:
        pass

    logger.info("Gasto creado id=%s club=%s", expense.id, club_id)
    return expense


# ── PUT /{id} ─────────────────────────────────────────────────────────────────

@router.put("/{expense_id}", response_model=ExpenseOut)
async def update_expense(
    expense_id: UUID,
    payload:    ExpenseUpdate,
    club_id:    UUID         = Depends(get_current_club_id),
    db:         AsyncSession = Depends(get_db),
):
    logger.info("PUT /expenses/%s — club=%s", expense_id, club_id)

    result  = await db.execute(
        select(Expense).where(
            Expense.id       == expense_id,
            Expense.club_id  == club_id,
            Expense.is_active.is_(True),
        )
    )
    expense = result.scalar_one_or_none()
    if not expense:
        raise HTTPException(status_code=404, detail="Gasto no encontrado")

    if payload.category and payload.category not in VALID_CATEGORIES:
        raise HTTPException(status_code=422, detail="Categoría inválida")

    try:
        for field, value in payload.model_dump(exclude_unset=True).items():
            setattr(expense, field, value)
        expense.updated_at = datetime.utcnow()
        await db.commit()
        await db.refresh(expense)
    except Exception as exc:
        await db.rollback()
        logger.error("Error al actualizar gasto %s: %s", expense_id, exc, exc_info=True)
        raise HTTPException(status_code=500, detail="Error al actualizar el gasto")

    logger.info("Gasto actualizado id=%s", expense_id)
    return expense


# ── DELETE /{id} ──────────────────────────────────────────────────────────────

@router.delete("/{expense_id}", status_code=204)
async def delete_expense(
    expense_id: UUID,
    club_id:    UUID         = Depends(get_current_club_id),
    db:         AsyncSession = Depends(get_db),
):
    """Soft-delete: establece is_active = False."""
    logger.info("DELETE /expenses/%s — club=%s", expense_id, club_id)

    result  = await db.execute(
        select(Expense).where(
            Expense.id       == expense_id,
            Expense.club_id  == club_id,
            Expense.is_active.is_(True),
        )
    )
    expense = result.scalar_one_or_none()
    if not expense:
        raise HTTPException(status_code=404, detail="Gasto no encontrado")

    try:
        expense.is_active  = False
        expense.updated_at = datetime.utcnow()
        await db.commit()
    except Exception as exc:
        await db.rollback()
        logger.error("Error al eliminar gasto %s: %s", expense_id, exc, exc_info=True)
        raise HTTPException(status_code=500, detail="Error al eliminar el gasto")

    logger.info("Gasto eliminado (soft-delete) id=%s", expense_id)


# ── PATCH /{id}/review ────────────────────────────────────────────────────────

@router.patch("/{expense_id}/review")
async def mark_reviewed(
    expense_id: UUID,
    club_id:    UUID         = Depends(get_current_club_id),
    user_id:    UUID         = Depends(get_current_user_id),
    db:         AsyncSession = Depends(get_db),
):
    result  = await db.execute(
        select(Expense).where(Expense.id == expense_id, Expense.club_id == club_id)
    )
    expense = result.scalar_one_or_none()
    if not expense:
        raise HTTPException(status_code=404, detail="Gasto no encontrado")

    expense.reviewed_by = user_id
    expense.reviewed_at = datetime.utcnow()
    await db.commit()
    return {"status": "reviewed"}


# ── AI Anomaly endpoints ──────────────────────────────────────────────────────

@router.post("/{expense_id}/analyze", tags=["AI"])
async def analyze_expense(
    expense_id: UUID,
    club_id:    UUID         = Depends(get_current_club_id),
    db:         AsyncSession = Depends(get_db),
):
    """Analiza un gasto individual con el detector estadístico."""
    from app.services.anomaly_detector import AnomalyDetectorService

    result  = await db.execute(
        select(Expense).where(Expense.id == expense_id, Expense.club_id == club_id)
    )
    expense = result.scalar_one_or_none()
    if not expense:
        raise HTTPException(status_code=404, detail="Gasto no encontrado")

    detector = AnomalyDetectorService(db)
    analysis = await detector.analyze(expense)

    expense.anomaly_score            = analysis.score
    expense.anomaly_severity         = analysis.severity
    expense.anomaly_reason           = analysis.reason
    expense.anomaly_llm_explanation  = analysis.llm_explanation
    await db.commit()

    return {
        "expense_id":      expense_id,
        "score":           analysis.score,
        "severity":        analysis.severity,
        "reason":          analysis.reason,
        "llm_explanation": analysis.llm_explanation,
    }


@router.post("/analyze-all", tags=["AI"])
async def analyze_all_expenses(
    club_id: UUID         = Depends(get_current_club_id),
    db:      AsyncSession = Depends(get_db),
):
    """Analiza todos los gastos del club que aún no tienen análisis."""
    from app.services.anomaly_detector import AnomalyDetectorService

    result   = await db.execute(
        select(Expense).where(
            Expense.club_id == club_id,
            Expense.anomaly_score.is_(None),
        )
    )
    expenses = result.scalars().all()

    if not expenses:
        return {"analyzed": 0, "anomalies_found": 0}

    detector        = AnomalyDetectorService(db)
    anomalies_found = 0

    for expense in expenses:
        analysis = await detector.analyze(expense)
        expense.anomaly_score            = analysis.score
        expense.anomaly_severity         = analysis.severity
        expense.anomaly_reason           = analysis.reason
        expense.anomaly_llm_explanation  = analysis.llm_explanation
        if analysis.severity:
            anomalies_found += 1

    await db.commit()
    return {"analyzed": len(expenses), "anomalies_found": anomalies_found}
