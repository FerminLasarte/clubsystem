"""
ClubSync — Stock Router
========================
Gestión del inventario del club.

Endpoints:
  GET    /api/v1/stock/stats              → Estadísticas del inventario.
  GET    /api/v1/stock                    → Lista de ítems (filtros: search, category, low_stock).
  POST   /api/v1/stock                    → Crea un nuevo ítem.
  PUT    /api/v1/stock/{item_id}          → Actualiza campos del ítem (todos opcionales).
  DELETE /api/v1/stock/{item_id}          → Soft-delete (is_active=False).
  POST   /api/v1/stock/{item_id}/movements → Registra movimiento de stock (in/out/adjustment).

RBAC:
  - GET / stats: cualquier rol autenticado con club activo.
  - POST / PUT / DELETE / movements: OWNER | STOCK_MANAGER.

Multi-tenant:
  - club_id extraído del JWT vía get_current_club_id (inyecta RLS en Postgres).
  - Todos los queries incluyen WHERE club_id = <jwt_club_id>.
  - Se valida que el ítem pertenezca al club antes de cualquier mutación.

Observabilidad:
  - logger.info()  en cada operación exitosa.
  - logger.error() + await db.rollback() en cada bloque except.
"""

import csv
import io
import logging
from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.middleware.tenant import (
    get_current_club_id,
    get_current_user_id,
    require_role,
)
from app.models.stock import StockItem, StockMovement

logger = logging.getLogger(__name__)
router = APIRouter()


# ── Schemas ───────────────────────────────────────────────────────────────────

class StockItemOut(BaseModel):
    id:           UUID
    sku:          Optional[str]   = None
    name:         str
    description:  Optional[str]   = None
    category:     Optional[str]   = None
    unit:         str
    quantity:     float
    min_quantity: float
    unit_cost:    Optional[float] = None
    unit_price:   Optional[float] = None
    supplier:     Optional[str]   = None
    is_active:    bool
    is_low_stock: bool = False

    class Config:
        from_attributes = True


_VALID_UNITS = {"unit", "box", "kg", "liter", "pack"}


class StockItemCreate(BaseModel):
    name:         str             = Field(..., min_length=2, max_length=255)
    sku:          Optional[str]   = Field(None, max_length=100)
    description:  Optional[str]   = Field(None)
    category:     Optional[str]   = Field(None, max_length=100)
    unit:         str             = Field("unit", pattern=r"^(unit|box|kg|liter|pack)$")
    quantity:     float           = Field(0, ge=0)
    min_quantity: float           = Field(0, ge=0)
    unit_cost:    Optional[float] = Field(None, ge=0)
    unit_price:   Optional[float] = Field(None, ge=0)
    supplier:     Optional[str]   = Field(None, max_length=255)


class StockItemUpdate(BaseModel):
    """Todos los campos son opcionales — solo se actualizan los provistos."""
    name:         Optional[str]   = Field(None, min_length=2, max_length=255)
    sku:          Optional[str]   = Field(None, max_length=100)
    description:  Optional[str]   = Field(None)
    category:     Optional[str]   = Field(None, max_length=100)
    unit:         Optional[str]   = Field(None, pattern=r"^(unit|box|kg|liter|pack)$")
    quantity:     Optional[float] = Field(None, ge=0)
    min_quantity: Optional[float] = Field(None, ge=0)
    unit_cost:    Optional[float] = Field(None, ge=0)
    unit_price:   Optional[float] = Field(None, ge=0)
    supplier:     Optional[str]   = Field(None, max_length=255)
    is_active:    Optional[bool]  = None


class MovementCreate(BaseModel):
    type:           str   = Field(..., pattern="^(in|out|adjustment)$")
    quantity_delta: float
    reason:         Optional[str] = None


class AdjustPayload(BaseModel):
    """Payload para el endpoint /adjust — ajuste auditado de cantidad."""
    quantity_change: float        = Field(..., gt=0, description="Cantidad absoluta a sumar o restar (siempre positivo).")
    movement_type:   str          = Field(..., pattern="^(IN|OUT)$", description="'IN' para entrada, 'OUT' para salida.")
    reason:          Optional[str] = None


class StockStats(BaseModel):
    total_items:     int
    low_stock_count: int
    total_value:     float


class MovementWithUser(BaseModel):
    id:                UUID
    type:              str
    quantity_delta:    float
    quantity_before:   float
    quantity_after:    float
    reason:            Optional[str] = None
    performed_by_name: str
    created_at:        datetime

    class Config:
        from_attributes = True


class StockItemHistory(BaseModel):
    item:      StockItemOut
    movements: list[MovementWithUser]


# ── Internal helpers ──────────────────────────────────────────────────────────

def _compute_out(item: StockItem) -> StockItemOut:
    """Convierte un ORM StockItem en StockItemOut calculando is_low_stock."""
    out = StockItemOut.model_validate(item)
    out.is_low_stock = float(item.quantity) <= float(item.min_quantity)
    return out


async def _get_item_or_404(
    db:      AsyncSession,
    item_id: UUID,
    club_id: UUID,
) -> StockItem:
    """
    Carga el ítem verificando multi-tenant + que esté activo.
    Lanza HTTP 404 si no existe o no pertenece al club.
    """
    result = await db.execute(
        select(StockItem).where(
            StockItem.id        == item_id,
            StockItem.club_id   == club_id,
            StockItem.is_active == True,
        )
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ítem no encontrado o no pertenece a este club",
        )
    return item


# ── GET /stats ────────────────────────────────────────────────────────────────

@router.get("/stats", response_model=StockStats)
async def get_stock_stats(
    club_id: UUID         = Depends(get_current_club_id),
    db:      AsyncSession = Depends(get_db),
) -> StockStats:
    """Estadísticas del inventario: total ítems, stock bajo y valor total en costo."""
    result = await db.execute(
        select(StockItem).where(
            StockItem.club_id   == club_id,
            StockItem.is_active == True,
        )
    )
    items = result.scalars().all()

    low_stock   = [i for i in items if float(i.quantity) <= float(i.min_quantity)]
    total_value = sum(
        float(i.quantity) * float(i.unit_cost)
        for i in items
        if i.unit_cost is not None
    )

    return StockStats(
        total_items=len(items),
        low_stock_count=len(low_stock),
        total_value=total_value,
    )


# ── GET / ─────────────────────────────────────────────────────────────────────

@router.get("/", response_model=list[StockItemOut])
async def list_stock(
    search:    Optional[str]  = Query(None),
    category:  Optional[str]  = Query(None),
    low_stock: Optional[bool] = Query(None),
    club_id:   UUID           = Depends(get_current_club_id),
    db:        AsyncSession   = Depends(get_db),
) -> list[StockItemOut]:
    """
    Lista los ítems activos del inventario del club.
    Filtros opcionales: búsqueda por nombre/SKU/categoría, categoría exacta, bajo stock.
    """
    q = select(StockItem).where(
        StockItem.club_id   == club_id,
        StockItem.is_active == True,
    )

    if search:
        term = f"%{search.lower()}%"
        q = q.where(
            or_(
                func.lower(StockItem.name).like(term),
                func.lower(StockItem.sku).like(term),
                func.lower(StockItem.category).like(term),
            )
        )

    if category:
        q = q.where(StockItem.category == category)

    q = q.order_by(StockItem.category, StockItem.name)
    result = await db.execute(q)
    items  = result.scalars().all()

    out = []
    for item in items:
        is_low = float(item.quantity) <= float(item.min_quantity)
        if low_stock is True  and not is_low: continue
        if low_stock is False and     is_low: continue
        d = StockItemOut.model_validate(item)
        d.is_low_stock = is_low
        out.append(d)

    return out


# ── POST / ────────────────────────────────────────────────────────────────────

@router.post("/", response_model=StockItemOut, status_code=status.HTTP_201_CREATED)
async def create_stock_item(
    payload: StockItemCreate,
    club_id: UUID         = Depends(get_current_club_id),
    user_id: UUID         = Depends(get_current_user_id),
    _roles:  list         = Depends(require_role("OWNER", "STOCK_MANAGER")),
    db:      AsyncSession = Depends(get_db),
) -> StockItemOut:
    """
    Crea un nuevo ítem en el inventario.
    Si la cantidad inicial es > 0, registra un movimiento 'in' de inventario inicial
    en la misma transacción (audit trail).
    Requiere OWNER o STOCK_MANAGER.
    """
    try:
        item = StockItem(club_id=club_id, **payload.model_dump())
        db.add(item)
        # flush() envía el INSERT a la BD (dentro de la transacción abierta)
        # para que item.id quede disponible en Python antes de crear el movimiento.
        await db.flush()

        initial_qty = float(item.quantity)
        if initial_qty > 0:
            movement = StockMovement(
                club_id         = club_id,
                item_id         = item.id,
                performed_by    = user_id,
                type            = "in",
                quantity_delta  = initial_qty,
                quantity_before = 0.0,
                quantity_after  = initial_qty,
                reason          = "Inventario Inicial",
            )
            db.add(movement)

        await db.commit()
        await db.refresh(item)
        logger.info(
            "Stock: ítem '%s' creado [club=%s id=%s qty_inicial=%s]",
            item.name, club_id, item.id, initial_qty,
        )
        return _compute_out(item)

    except IntegrityError as exc:
        await db.rollback()
        logger.error(
            "Stock: IntegrityError al crear ítem '%s' [club=%s]: %s",
            payload.name, club_id, exc,
        )
        orig = str(exc.orig) if exc.orig else str(exc)
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Error de integridad al guardar: {orig}",
        )

    except Exception as exc:
        await db.rollback()
        logger.error(
            "Stock: error al crear ítem '%s' [club=%s]: %s",
            payload.name, club_id, exc,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al guardar el ítem: {type(exc).__name__}: {exc}",
        )


# ── PUT /{item_id} ────────────────────────────────────────────────────────────

@router.put("/{item_id}", response_model=StockItemOut)
async def update_stock_item(
    item_id: UUID,
    payload: StockItemUpdate,
    club_id: UUID         = Depends(get_current_club_id),
    _roles:  list         = Depends(require_role("OWNER", "STOCK_MANAGER")),
    db:      AsyncSession = Depends(get_db),
) -> StockItemOut:
    """
    Actualiza campos del ítem. Solo se modifican los incluidos en el payload.
    Requiere OWNER o STOCK_MANAGER.
    """
    item = await _get_item_or_404(db, item_id, club_id)

    try:
        updates = payload.model_dump(exclude_unset=True)
        for field, value in updates.items():
            setattr(item, field, value)

        await db.commit()
        await db.refresh(item)
        logger.info(
            "Stock: ítem '%s' actualizado [club=%s id=%s campos=%s]",
            item.name, club_id, item_id, list(updates.keys()),
        )
        return _compute_out(item)

    except Exception as exc:
        logger.error(
            "Stock: error al actualizar ítem [club=%s id=%s]: %s",
            club_id, item_id, exc,
        )
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al actualizar el ítem. Intente de nuevo.",
        )


# ── DELETE /{item_id} ─────────────────────────────────────────────────────────

@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_stock_item(
    item_id: UUID,
    club_id: UUID         = Depends(get_current_club_id),
    _roles:  list         = Depends(require_role("OWNER", "STOCK_MANAGER")),
    db:      AsyncSession = Depends(get_db),
) -> None:
    """
    Soft-delete del ítem (is_active=False).
    Se preserva el historial de movimientos para auditoría.
    Requiere OWNER o STOCK_MANAGER.
    """
    item = await _get_item_or_404(db, item_id, club_id)
    item_name = item.name   # capturar antes del commit

    try:
        item.is_active = False
        await db.commit()
        logger.info(
            "Stock: ítem '%s' eliminado (soft) [club=%s id=%s]",
            item_name, club_id, item_id,
        )

    except Exception as exc:
        logger.error(
            "Stock: error al eliminar ítem '%s' [club=%s id=%s]: %s",
            item_name, club_id, item_id, exc,
        )
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al eliminar el ítem. Intente de nuevo.",
        )


# ── POST /{item_id}/movements ─────────────────────────────────────────────────

@router.post("/{item_id}/movements", status_code=status.HTTP_201_CREATED)
async def register_movement(
    item_id: UUID,
    payload: MovementCreate,
    club_id: UUID         = Depends(get_current_club_id),
    user_id: UUID         = Depends(get_current_user_id),
    _roles:  list         = Depends(require_role("OWNER", "STOCK_MANAGER")),
    db:      AsyncSession = Depends(get_db),
) -> dict:
    """
    Registra un movimiento de stock y actualiza `quantity` del ítem atómicamente.
    Requiere OWNER o STOCK_MANAGER.
    """
    item = await _get_item_or_404(db, item_id, club_id)

    before = float(item.quantity)
    after  = before + payload.quantity_delta

    if after < 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Stock insuficiente. Actual: {before}, variación: {payload.quantity_delta}",
        )

    try:
        movement = StockMovement(
            club_id         = club_id,
            item_id         = item_id,
            performed_by    = user_id,
            type            = payload.type,
            quantity_delta  = payload.quantity_delta,
            quantity_before = before,
            quantity_after  = after,
            reason          = payload.reason,
        )
        item.quantity = after
        db.add(movement)
        await db.commit()
        logger.info(
            "Stock: movimiento '%s' en '%s' [Δ=%s %s→%s club=%s]",
            payload.type, item.name, payload.quantity_delta, before, after, club_id,
        )
        return {"quantity_before": before, "quantity_after": after}

    except Exception as exc:
        logger.error(
            "Stock: error al registrar movimiento [club=%s item=%s]: %s",
            club_id, item_id, exc,
        )
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al registrar el movimiento. Intente de nuevo.",
        )


# ── POST /{item_id}/adjust ────────────────────────────────────────────────────

@router.post("/{item_id}/adjust", status_code=status.HTTP_200_OK)
async def adjust_stock(
    item_id: UUID,
    payload: AdjustPayload,
    club_id: UUID         = Depends(get_current_club_id),
    user_id: UUID         = Depends(get_current_user_id),
    _roles:  list         = Depends(require_role("OWNER", "STOCK_MANAGER")),
    db:      AsyncSession = Depends(get_db),
) -> dict:
    """
    Ajusta la cantidad de un ítem (entrada o salida) y registra el movimiento
    de auditoría en la misma transacción.

    - movement_type='IN'  → suma quantity_change al stock.
    - movement_type='OUT' → resta quantity_change al stock (falla si resulta negativo).

    Requiere OWNER o STOCK_MANAGER.
    """
    item = await _get_item_or_404(db, item_id, club_id)

    before = float(item.quantity)
    delta  = payload.quantity_change if payload.movement_type == "IN" else -payload.quantity_change
    after  = before + delta

    if after < 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Stock insuficiente. Actual: {before}, variación: {delta}",
        )

    try:
        movement = StockMovement(
            club_id         = club_id,
            item_id         = item_id,
            performed_by    = user_id,
            type            = payload.movement_type.lower(),  # "in" | "out"
            quantity_delta  = delta,
            quantity_before = before,
            quantity_after  = after,
            reason          = payload.reason,
        )
        item.quantity = after
        db.add(movement)
        logger.info(
            "Stock: [pre-commit] ajuste %s — ítem=%s Δ=%.2f %.2f→%.2f club=%s user=%s",
            payload.movement_type, item_id, delta, before, after, club_id, user_id,
        )
        await db.commit()
        logger.info(
            "Stock: ajuste '%s' en '%s' [Δ=%s %s→%s club=%s]",
            payload.movement_type, item.name, delta, before, after, club_id,
        )
        return {"quantity_before": before, "quantity_after": after}

    except Exception as exc:
        logger.error(
            "Stock: error al ajustar stock [club=%s item=%s]: %s",
            club_id, item_id, exc,
        )
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al ajustar el stock. Intente de nuevo.",
        )


# ── GET /export/csv ───────────────────────────────────────────────────────────

@router.get("/export/csv")
async def export_stock_csv(
    item_id: Optional[UUID] = Query(None),
    period:  Optional[str]  = Query(None, pattern="^(day|month|year)$"),
    club_id: UUID           = Depends(get_current_club_id),
    db:      AsyncSession   = Depends(get_db),
) -> StreamingResponse:
    """
    Exporta los movimientos de stock como CSV con columnas financieras.
    Filtros opcionales: item_id (ítem concreto) y period (day | month | year).
    Incluye Descripción y Gasto del Movimiento (quantity_delta * unit_cost para ingresos).
    Última fila: GASTO TOTAL REALIZADO.
    """
    from app.models.user import User

    q = (
        select(
            StockMovement,
            StockItem.name,
            StockItem.description,
            StockItem.unit_cost,
            User.first_name,
            User.last_name,
        )
        .join(StockItem, StockMovement.item_id == StockItem.id)
        .join(User, StockMovement.performed_by == User.id)
        .where(StockMovement.club_id == club_id)
    )

    if item_id:
        q = q.where(StockMovement.item_id == item_id)

    if period:
        now = datetime.now(timezone.utc)
        if period == "day":
            start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        elif period == "month":
            start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        else:  # year
            start = now.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
        q = q.where(StockMovement.created_at >= start)

    q = q.order_by(StockMovement.created_at.desc())
    result = await db.execute(q)
    rows = result.all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Fecha", "Producto", "Descripción", "Acción", "Cantidad", "Usuario", "Razón", "Gasto del Movimiento"])

    total_expense = 0.0
    for movement, item_name, item_desc, unit_cost, first_name, last_name in rows:
        delta = float(movement.quantity_delta)
        # Solo los ingresos generan gasto de compra
        expense = round(delta * float(unit_cost), 2) if delta > 0 and unit_cost is not None else ""
        if isinstance(expense, float):
            total_expense += expense

        writer.writerow([
            movement.created_at.strftime("%Y-%m-%d %H:%M"),
            item_name,
            item_desc or "",
            movement.type,
            delta,
            f"{first_name} {last_name}",
            movement.reason or "",
            expense,
        ])

    # Fila de total financiero
    writer.writerow(["", "", "", "", "", "", "GASTO TOTAL REALIZADO", round(total_expense, 2)])

    output.seek(0)
    filename = f"stock_{datetime.now().strftime('%Y%m%d')}.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ── GET /{item_id}/history ────────────────────────────────────────────────────

@router.get("/{item_id}/history", response_model=StockItemHistory)
async def get_item_history(
    item_id: UUID,
    club_id: UUID         = Depends(get_current_club_id),
    db:      AsyncSession = Depends(get_db),
) -> StockItemHistory:
    """
    Devuelve el ítem con su historial completo de movimientos, incluyendo
    el nombre del usuario que realizó cada uno (JOIN con users).
    """
    from app.models.user import User

    item = await _get_item_or_404(db, item_id, club_id)

    result = await db.execute(
        select(StockMovement, User.first_name, User.last_name)
        .join(User, StockMovement.performed_by == User.id)
        .where(
            StockMovement.item_id == item_id,
            StockMovement.club_id == club_id,
        )
        .order_by(StockMovement.created_at.desc())
    )
    rows = result.all()

    movements = [
        MovementWithUser(
            id                = m.id,
            type              = m.type,
            quantity_delta    = float(m.quantity_delta),
            quantity_before   = float(m.quantity_before),
            quantity_after    = float(m.quantity_after),
            reason            = m.reason,
            performed_by_name = f"{first_name} {last_name}",
            created_at        = m.created_at,
        )
        for m, first_name, last_name in rows
    ]

    return StockItemHistory(item=_compute_out(item), movements=movements)
