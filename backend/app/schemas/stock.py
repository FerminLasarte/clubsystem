from datetime import datetime
from decimal import Decimal
from typing import Annotated, Self
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, model_validator

from app.domain.enums import StockMovementType, StockUnit
from app.schemas.common import Money, OptionalText, Schema

Quantity = Annotated[Decimal, Field(max_digits=12, decimal_places=3, ge=0)]
PositiveQuantity = Annotated[Decimal, Field(max_digits=12, decimal_places=3, gt=0)]
ItemName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=255)]
Text100 = Annotated[str, StringConstraints(strip_whitespace=True, max_length=100)]
Text255 = Annotated[str, StringConstraints(strip_whitespace=True, max_length=255)]
Reason = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=500)]


class StockItemOut(Schema):
    id: UUID
    sku: str | None
    name: str
    description: str | None
    category: str | None
    unit: StockUnit
    quantity: Decimal
    min_quantity: Decimal
    unit_cost: Decimal | None
    unit_price: Decimal | None
    supplier: str | None
    location: str | None
    is_low_stock: bool
    created_at: datetime
    updated_at: datetime


class StockItemCreate(BaseModel):
    name: ItemName
    sku: Text100 | None = None
    description: OptionalText | None = None
    category: Text100 | None = None
    unit: StockUnit = StockUnit.UNIT
    # Si es > 0 se registra como movimiento de entrada inicial.
    quantity: Quantity = Decimal(0)
    min_quantity: Quantity = Decimal(0)
    unit_cost: Money | None = None
    unit_price: Money | None = None
    supplier: Text255 | None = None
    location: Text100 | None = None


class StockItemUpdate(BaseModel):
    """Solo se modifican los campos enviados. La cantidad cambia únicamente con movimientos."""

    model_config = ConfigDict(extra="forbid")

    name: ItemName | None = None
    sku: Text100 | None = None
    description: OptionalText | None = None
    category: Text100 | None = None
    unit: StockUnit | None = None
    min_quantity: Quantity | None = None
    unit_cost: Money | None = None
    unit_price: Money | None = None
    supplier: Text255 | None = None
    location: Text100 | None = None


class StockItemFilters(BaseModel):
    search: Annotated[str, StringConstraints(strip_whitespace=True, max_length=100)] | None = None
    category: Text100 | None = None
    # true: solo ítems con cantidad <= mínimo; false: solo los que están por encima.
    low_stock: bool | None = None


class StockStatsOut(BaseModel):
    total_items: int
    low_stock_count: int
    # Suma de cantidad × costo unitario (los ítems sin costo no suman).
    inventory_value: Decimal


class MovementCreate(BaseModel):
    """IN/OUT llevan `quantity` (> 0); ADJUSTMENT lleva `target_quantity` (lo contado)."""

    type: StockMovementType
    quantity: PositiveQuantity | None = None
    target_quantity: Quantity | None = None
    reason: Reason
    unit_cost: Money | None = None

    @model_validator(mode="after")
    def _amount_matches_type(self) -> Self:
        if self.type == StockMovementType.ADJUSTMENT:
            if self.target_quantity is None or self.quantity is not None:
                raise ValueError("Un ajuste lleva target_quantity (y no quantity).")
        elif self.quantity is None or self.target_quantity is not None:
            raise ValueError("Una entrada o salida lleva quantity (y no target_quantity).")
        return self


class MovementOut(Schema):
    id: UUID
    item_id: UUID
    type: StockMovementType
    quantity_delta: Decimal
    quantity_before: Decimal
    quantity_after: Decimal
    unit_cost: Decimal | None
    reason: str | None
    performed_by_name: str | None
    created_at: datetime


class MovementResultOut(BaseModel):
    movement: MovementOut
    item: StockItemOut
