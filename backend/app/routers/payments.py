"""
ClubSync — Payments Router
==========================
Gestión de cobros e ingresos del club (Caja Diaria).

Endpoints:
  GET    /api/v1/payments          → Lista cobros activos (filtro: ?date=YYYY-MM-DD)
  POST   /api/v1/payments          → Registra un nuevo cobro
  DELETE /api/v1/payments/{id}     → Soft-delete (is_active = False) — requiere OWNER

Multi-tenant:
  - club_id extraído del JWT vía get_current_club_id.
  - Todos los queries incluyen WHERE club_id = <jwt_club_id>.

Observabilidad:
  - logger.info()  en operaciones exitosas.
  - logger.error() + await db.rollback() en cada bloque except.
"""

import logging
from datetime import date, datetime, timezone
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import cast, func, select, Date
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.middleware.tenant import get_current_club_id, require_role
from app.models.payment import Payment, VALID_PAYMENT_METHODS

logger = logging.getLogger(__name__)
router = APIRouter()


# ── Schemas ───────────────────────────────────────────────────────────────────

class PaymentOut(BaseModel):
    id:             UUID
    amount:         float
    payment_method: str
    description:    str
    payment_date:   datetime
    member_id:      Optional[UUID]
    reservation_id: Optional[UUID]
    is_active:      bool
    created_at:     datetime

    class Config:
        from_attributes = True


class PaymentCreate(BaseModel):
    amount:         float       = Field(..., gt=0, description="Monto del cobro (positivo)")
    payment_method: str         = Field(..., description="EFECTIVO|TARJETA|TRANSFERENCIA|MERCADOPAGO")
    description:    str         = Field(..., min_length=1, max_length=255)
    member_id:      Optional[UUID] = None
    reservation_id: Optional[UUID] = None
    payment_date:   Optional[datetime] = None


# ── GET / ─────────────────────────────────────────────────────────────────────

@router.get("/", response_model=list[PaymentOut])
async def list_payments(
    date_filter: Optional[date] = Query(None, alias="date", description="Filtrar por fecha (YYYY-MM-DD)"),
    club_id:     UUID           = Depends(get_current_club_id),
    db:          AsyncSession   = Depends(get_db),
):
    """Lista los cobros activos del club. Si se pasa ?date=, filtra por ese día."""
    logger.info("GET /payments — club=%s date=%s", club_id, date_filter)

    q = (
        select(Payment)
        .where(Payment.club_id == club_id, Payment.is_active.is_(True))
    )

    if date_filter:
        q = q.where(cast(Payment.payment_date, Date) == date_filter)

    q = q.order_by(Payment.payment_date.desc())

    result = await db.execute(q)
    return result.scalars().all()


# ── POST / ────────────────────────────────────────────────────────────────────

@router.post("/", response_model=PaymentOut, status_code=201)
async def create_payment(
    payload: PaymentCreate,
    club_id: UUID         = Depends(get_current_club_id),
    db:      AsyncSession = Depends(get_db),
):
    """Registra un nuevo cobro en la caja del club."""
    logger.info("POST /payments — club=%s method=%s amount=%s", club_id, payload.payment_method, payload.amount)

    if payload.payment_method not in VALID_PAYMENT_METHODS:
        raise HTTPException(
            status_code=422,
            detail=f"Método de pago inválido. Opciones: {', '.join(sorted(VALID_PAYMENT_METHODS))}",
        )

    payment_date = payload.payment_date or datetime.now(timezone.utc)

    try:
        payment = Payment(
            club_id        = club_id,
            amount         = payload.amount,
            payment_method = payload.payment_method,
            description    = payload.description,
            member_id      = payload.member_id,
            reservation_id = payload.reservation_id,
            payment_date   = payment_date,
        )
        db.add(payment)
        await db.commit()
        await db.refresh(payment)
    except Exception as exc:
        await db.rollback()
        logger.error("Error al crear cobro — club=%s: %s", club_id, exc, exc_info=True)
        raise HTTPException(status_code=500, detail="Error al registrar el cobro")

    logger.info("Cobro registrado id=%s club=%s", payment.id, club_id)
    return payment


# ── DELETE /{id} ──────────────────────────────────────────────────────────────

@router.delete("/{payment_id}", status_code=204)
async def delete_payment(
    payment_id: UUID,
    club_id:    UUID  = Depends(get_current_club_id),
    _roles:     list  = Depends(require_role("OWNER")),
    db:         AsyncSession = Depends(get_db),
):
    """Soft-delete: establece is_active = False. Requiere rol OWNER."""
    logger.info("DELETE /payments/%s — club=%s", payment_id, club_id)

    result = await db.execute(
        select(Payment).where(
            Payment.id      == payment_id,
            Payment.club_id == club_id,
            Payment.is_active.is_(True),
        )
    )
    payment = result.scalar_one_or_none()
    if not payment:
        raise HTTPException(status_code=404, detail="Cobro no encontrado")

    try:
        payment.is_active = False
        await db.commit()
    except Exception as exc:
        await db.rollback()
        logger.error("Error al eliminar cobro %s: %s", payment_id, exc, exc_info=True)
        raise HTTPException(status_code=500, detail="Error al eliminar el cobro")

    logger.info("Cobro eliminado (soft-delete) id=%s", payment_id)
