# backend/app/routers/stock.py
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.middleware.tenant import get_current_club_id, get_current_user_id
from app.models.stock import StockItem, StockMovement

router = APIRouter()


class StockItemOut(BaseModel):
    id: UUID
    sku: Optional[str]
    name: str
    category: Optional[str]
    unit: str
    quantity: float
    min_quantity: float
    unit_cost: Optional[float]
    unit_price: Optional[float]
    supplier: Optional[str]
    is_active: bool
    is_low_stock: bool = False

    class Config:
        from_attributes = True


class StockItemCreate(BaseModel):
    sku: Optional[str] = None
    name: str = Field(..., min_length=2)
    category: Optional[str] = None
    unit: str = "unit"
    quantity: float = Field(0, ge=0)
    min_quantity: float = Field(0, ge=0)
    unit_cost: Optional[float] = None
    unit_price: Optional[float] = None
    supplier: Optional[str] = None


class MovementCreate(BaseModel):
    type: str = Field(..., pattern="^(in|out|adjustment)$")
    quantity_delta: float
    reason: Optional[str] = None


class StockStats(BaseModel):
    total_items: int
    low_stock_count: int
    total_value: float


@router.get("/stats", response_model=StockStats)
async def get_stock_stats(
    club_id: UUID = Depends(get_current_club_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(StockItem).where(StockItem.club_id == club_id, StockItem.is_active == True)
    )
    items = result.scalars().all()

    low_stock = [i for i in items if float(i.quantity) <= float(i.min_quantity)]
    total_value = sum(
        float(i.quantity) * float(i.unit_cost)
        for i in items if i.unit_cost is not None
    )

    return StockStats(
        total_items=len(items),
        low_stock_count=len(low_stock),
        total_value=total_value,
    )


@router.get("/", response_model=list[StockItemOut])
async def list_stock(
    search: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    low_stock: Optional[bool] = Query(None),
    club_id: UUID = Depends(get_current_club_id),
    db: AsyncSession = Depends(get_db),
):
    q = select(StockItem).where(
        StockItem.club_id == club_id,
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
    items = result.scalars().all()

    # Calcular is_low_stock en Python (evita problemas con NUMERIC)
    out = []
    for item in items:
        is_low = float(item.quantity) <= float(item.min_quantity)
        if low_stock is True and not is_low:
            continue
        if low_stock is False and is_low:
            continue
        d = StockItemOut.model_validate(item)
        d.is_low_stock = is_low
        out.append(d)

    return out


@router.post("/", response_model=StockItemOut, status_code=201)
async def create_stock_item(
    payload: StockItemCreate,
    club_id: UUID = Depends(get_current_club_id),
    db: AsyncSession = Depends(get_db),
):
    item = StockItem(club_id=club_id, **payload.model_dump())
    db.add(item)
    await db.commit()
    await db.refresh(item)
    d = StockItemOut.model_validate(item)
    d.is_low_stock = float(item.quantity) <= float(item.min_quantity)
    return d


@router.post("/{item_id}/movements", status_code=201)
async def register_movement(
    item_id: UUID,
    payload: MovementCreate,
    club_id: UUID = Depends(get_current_club_id),
    user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(StockItem).where(StockItem.id == item_id, StockItem.club_id == club_id)
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Ítem no encontrado")

    before = float(item.quantity)
    after = before + payload.quantity_delta

    if after < 0:
        raise HTTPException(status_code=400, detail="Stock insuficiente")

    movement = StockMovement(
        club_id=club_id,
        item_id=item_id,
        performed_by=user_id,
        type=payload.type,
        quantity_delta=payload.quantity_delta,
        quantity_before=before,
        quantity_after=after,
        reason=payload.reason,
    )
    item.quantity = after
    db.add(movement)
    await db.commit()
    return {"quantity_before": before, "quantity_after": after}
