"""
ClubSync — Fees Router
======================
Motor de facturación recurrente: Cuotas Societarias.

Endpoints:
  GET  /api/v1/fees               → Lista cuotas del club (filtros: month, year, status)
  POST /api/v1/fees/generate      → Genera cuotas masivas para todos los socios activos
  POST /api/v1/fees/{id}/pay      → Cobra una cuota: PENDING → PAID + Payment en caja

Lógica:
  - generate: por cada User activo del club genera un MembershipFee PENDING.
              El monto sale del dict plan_amounts[socio.membership_plan].
              Socios sin plan o sin monto configurado se omiten (ver skip_plans).
  - pay:      marca la cuota PAID y crea un Payment INCOME en la caja diaria,
              cruzando el fee con la caja mediante payment_id.

Multi-tenant: club_id extraído del JWT vía get_current_club_id.
RBAC:         generate y pay requieren rol OWNER.
"""

import logging
from calendar import monthrange
from datetime import date, datetime, timezone
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.middleware.tenant import get_current_club_id, require_role
from app.models.fee import MembershipFee, VALID_FEE_STATUSES
from app.models.payment import Payment
from app.models.user import User

logger = logging.getLogger(__name__)
router = APIRouter()


# ── Schemas ───────────────────────────────────────────────────────────────────

class MemberSnapshot(BaseModel):
    """Subconjunto de datos del socio embebido en FeeOut."""
    id:              UUID
    first_name:      str
    last_name:       str
    email:           str
    member_number:   Optional[str]
    membership_plan: Optional[str]

    class Config:
        from_attributes = True


class FeeOut(BaseModel):
    id:         UUID
    club_id:    UUID
    member_id:  UUID
    fee_name:   str
    month:      int
    year:       int
    amount:     float
    status:     str
    due_date:   date
    payment_id: Optional[UUID]
    is_active:  bool
    created_at: datetime
    member:     Optional[MemberSnapshot] = None

    class Config:
        from_attributes = True


class GenerateFeesPayload(BaseModel):
    month:       int            = Field(..., ge=1, le=12, description="Mes (1-12)")
    year:        int            = Field(..., ge=2020,     description="Año (ej. 2025)")
    plan_amounts: dict[str, float] = Field(
        ...,
        description="Mapa plan → monto. Ej: {\"Base\": 10000, \"Carnet Tenis\": 25000}",
    )
    due_day:     int            = Field(10, ge=1, le=28,  description="Día de vencimiento del mes")
    overwrite:   bool           = Field(False, description="Si True, regenera cuotas ya existentes para el mes")


class GenerateFeesResult(BaseModel):
    generated: int
    skipped:   int
    message:   str


# ── GET / ─────────────────────────────────────────────────────────────────────

@router.get("/", response_model=list[FeeOut])
async def list_fees(
    month:   Optional[int] = Query(None, ge=1,  le=12),
    year:    Optional[int] = Query(None, ge=2020),
    status:  Optional[str] = Query(None, description="PENDING | PAID | CANCELLED"),
    club_id: UUID          = Depends(get_current_club_id),
    db:      AsyncSession  = Depends(get_db),
):
    """
    Devuelve las cuotas del club con datos del socio embebidos.
    Filtros opcionales: month, year, status (ej. status=PENDING para morosos).
    """
    logger.info("GET /fees — club=%s month=%s year=%s status=%s", club_id, month, year, status)

    if status and status not in VALID_FEE_STATUSES:
        raise HTTPException(
            status_code=422,
            detail=f"Estado inválido. Opciones: {', '.join(sorted(VALID_FEE_STATUSES))}",
        )

    q = (
        select(MembershipFee)
        .where(
            MembershipFee.club_id   == club_id,
            MembershipFee.is_active.is_(True),
        )
    )
    if month:  q = q.where(MembershipFee.month  == month)
    if year:   q = q.where(MembershipFee.year   == year)
    if status: q = q.where(MembershipFee.status == status)

    q = q.order_by(MembershipFee.due_date, MembershipFee.created_at)
    fees = (await db.execute(q)).scalars().all()

    # ── Enriquecer con datos del socio ────────────────────────────────────────
    if not fees:
        return []

    member_ids = list({f.member_id for f in fees})
    members_q  = select(User).where(User.id.in_(member_ids))
    members    = (await db.execute(members_q)).scalars().all()
    member_map = {m.id: m for m in members}

    result: list[FeeOut] = []
    for fee in fees:
        fee_out = FeeOut.model_validate(fee)
        m = member_map.get(fee.member_id)
        if m:
            fee_out.member = MemberSnapshot.model_validate(m)
        result.append(fee_out)

    return result


# ── POST /generate ────────────────────────────────────────────────────────────

@router.post("/generate", response_model=GenerateFeesResult, status_code=201)
async def generate_fees(
    payload: GenerateFeesPayload,
    club_id: UUID        = Depends(get_current_club_id),
    _roles:  list        = Depends(require_role("OWNER")),
    db:      AsyncSession = Depends(get_db),
):
    """
    Genera cuotas PENDING para todos los socios activos del club.

    - Socios sin membership_plan o cuyo plan no esté en plan_amounts se omiten.
    - Si overwrite=False (default), los socios que ya tienen cuota para ese mes/año
      también se omiten (idempotente).
    - Si overwrite=True, las cuotas previas se cancelan y se generan nuevas.
    """
    logger.info(
        "POST /fees/generate — club=%s month=%s/%s plans=%s",
        club_id, payload.month, payload.year, list(payload.plan_amounts.keys()),
    )

    # ── Calcular fecha de vencimiento ─────────────────────────────────────────
    last_day_of_month = monthrange(payload.year, payload.month)[1]
    safe_due_day      = min(payload.due_day, last_day_of_month)
    due_date          = date(payload.year, payload.month, safe_due_day)

    # ── Obtener todos los socios activos del club ─────────────────────────────
    members_q = select(User).where(
        User.club_id   == club_id,
        User.is_active.is_(True),
    )
    members = (await db.execute(members_q)).scalars().all()

    if not members:
        return GenerateFeesResult(generated=0, skipped=0, message="No hay socios activos.")

    # ── Obtener cuotas ya existentes para el período ──────────────────────────
    existing_q = select(MembershipFee.member_id).where(
        MembershipFee.club_id   == club_id,
        MembershipFee.month     == payload.month,
        MembershipFee.year      == payload.year,
        MembershipFee.is_active.is_(True),
    )
    existing_member_ids: set[UUID] = set(
        (await db.execute(existing_q)).scalars().all()
    )

    generated = 0
    skipped   = 0

    try:
        for member in members:
            plan   = member.membership_plan or ""
            amount = payload.plan_amounts.get(plan)

            # Sin monto configurado para el plan → omitir
            if amount is None:
                skipped += 1
                continue

            # Ya tiene cuota para el período
            if member.id in existing_member_ids:
                if not payload.overwrite:
                    skipped += 1
                    continue
                # overwrite=True → cancelar las previas
                await db.execute(
                    select(MembershipFee).where(
                        MembershipFee.club_id   == club_id,
                        MembershipFee.member_id == member.id,
                        MembershipFee.month     == payload.month,
                        MembershipFee.year      == payload.year,
                        MembershipFee.is_active.is_(True),
                    )
                )
                # soft-delete de las previas
                prev_fees_q = select(MembershipFee).where(
                    MembershipFee.club_id   == club_id,
                    MembershipFee.member_id == member.id,
                    MembershipFee.month     == payload.month,
                    MembershipFee.year      == payload.year,
                    MembershipFee.is_active.is_(True),
                )
                prev_fees = (await db.execute(prev_fees_q)).scalars().all()
                for pf in prev_fees:
                    pf.is_active = False

            fee_name = f"Cuota {payload.month:02d}/{payload.year} - {plan}" if plan else f"Cuota {payload.month:02d}/{payload.year}"

            fee = MembershipFee(
                club_id   = club_id,
                member_id = member.id,
                fee_name  = fee_name,
                month     = payload.month,
                year      = payload.year,
                amount    = amount,
                status    = "PENDING",
                due_date  = due_date,
            )
            db.add(fee)
            generated += 1

        await db.commit()

    except Exception as exc:
        await db.rollback()
        logger.error("Error al generar cuotas — club=%s: %s", club_id, exc, exc_info=True)
        raise HTTPException(status_code=500, detail="Error al generar las cuotas.")

    logger.info("Cuotas generadas — club=%s count=%s skipped=%s", club_id, generated, skipped)
    return GenerateFeesResult(
        generated=generated,
        skipped=skipped,
        message=f"Se generaron {generated} cuota(s). {skipped} omitida(s).",
    )


# ── POST /{fee_id}/pay ────────────────────────────────────────────────────────

@router.post("/{fee_id}/pay", response_model=FeeOut)
async def pay_fee(
    fee_id:  UUID,
    club_id: UUID        = Depends(get_current_club_id),
    _roles:  list        = Depends(require_role("OWNER")),
    db:      AsyncSession = Depends(get_db),
):
    """
    Cobra una cuota PENDING:
      1. Cambia status → PAID.
      2. Crea un Payment INCOME en la caja diaria (impacta en el resumen del día).
      3. Cruza fee.payment_id → el nuevo payment.

    Requiere rol OWNER.
    """
    logger.info("POST /fees/%s/pay — club=%s", fee_id, club_id)

    # ── Obtener la cuota ──────────────────────────────────────────────────────
    result = await db.execute(
        select(MembershipFee).where(
            MembershipFee.id        == fee_id,
            MembershipFee.club_id   == club_id,
            MembershipFee.is_active.is_(True),
        )
    )
    fee = result.scalar_one_or_none()
    if not fee:
        raise HTTPException(status_code=404, detail="Cuota no encontrada.")

    if fee.status == "PAID":
        raise HTTPException(status_code=409, detail="La cuota ya fue cobrada.")

    if fee.status == "CANCELLED":
        raise HTTPException(status_code=409, detail="La cuota está cancelada y no puede cobrarse.")

    # ── Obtener socio para la descripción del payment ─────────────────────────
    member_result = await db.execute(select(User).where(User.id == fee.member_id))
    member        = member_result.scalar_one_or_none()
    member_label  = (
        f"{member.first_name} {member.last_name}" if member else str(fee.member_id)
    )

    try:
        # 1. Crear Payment INCOME en caja diaria
        payment = Payment(
            club_id          = club_id,
            transaction_type = "INCOME",
            amount           = fee.amount,
            payment_method   = "EFECTIVO",     # default; el cajero puede editar si lo necesita
            description      = f"{fee.fee_name} — {member_label}",
            member_id        = fee.member_id,
            payment_date     = datetime.now(timezone.utc),
        )
        db.add(payment)
        await db.flush()   # obtener payment.id antes del commit

        # 2. Actualizar cuota
        fee.status     = "PAID"
        fee.payment_id = payment.id

        await db.commit()
        await db.refresh(fee)

    except Exception as exc:
        await db.rollback()
        logger.error("Error al cobrar cuota %s: %s", fee_id, exc, exc_info=True)
        raise HTTPException(status_code=500, detail="Error al registrar el cobro.")

    logger.info("Cuota cobrada id=%s payment_id=%s", fee_id, payment.id)

    fee_out = FeeOut.model_validate(fee)
    if member:
        fee_out.member = MemberSnapshot.model_validate(member)
    return fee_out


# ── POST /{fee_id}/cancel ─────────────────────────────────────────────────────

@router.post("/{fee_id}/cancel", status_code=204)
async def cancel_fee(
    fee_id:  UUID,
    club_id: UUID        = Depends(get_current_club_id),
    _roles:  list        = Depends(require_role("OWNER")),
    db:      AsyncSession = Depends(get_db),
):
    """Cancela una cuota PENDING (soft: status → CANCELLED). Requiere OWNER."""
    logger.info("POST /fees/%s/cancel — club=%s", fee_id, club_id)

    result = await db.execute(
        select(MembershipFee).where(
            MembershipFee.id        == fee_id,
            MembershipFee.club_id   == club_id,
            MembershipFee.is_active.is_(True),
        )
    )
    fee = result.scalar_one_or_none()
    if not fee:
        raise HTTPException(status_code=404, detail="Cuota no encontrada.")
    if fee.status != "PENDING":
        raise HTTPException(status_code=409, detail="Solo se pueden cancelar cuotas en estado PENDING.")

    try:
        fee.status = "CANCELLED"
        await db.commit()
    except Exception as exc:
        await db.rollback()
        logger.error("Error al cancelar cuota %s: %s", fee_id, exc, exc_info=True)
        raise HTTPException(status_code=500, detail="Error al cancelar la cuota.")


# ── GET /plans ────────────────────────────────────────────────────────────────

@router.get("/plans", response_model=list[str])
async def list_plans(
    club_id: UUID        = Depends(get_current_club_id),
    db:      AsyncSession = Depends(get_db),
):
    """
    Devuelve los membership_plan distintos de los socios activos del club.
    Útil para pre-poblar el modal de generación masiva.
    """
    q = (
        select(User.membership_plan)
        .where(
            User.club_id   == club_id,
            User.is_active.is_(True),
            User.membership_plan.isnot(None),
        )
        .distinct()
        .order_by(User.membership_plan)
    )
    rows = (await db.execute(q)).scalars().all()
    return [r for r in rows if r]
