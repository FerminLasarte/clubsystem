import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.domain.enums import StockMovementType, StockUnit
from app.models.base import Base, Timestamps, UUIDPk, str_enum


class StockItem(UUIDPk, Timestamps, Base):
    __tablename__ = "stock_items"
    __table_args__ = (
        UniqueConstraint("id", "club_id"),
        CheckConstraint("quantity >= 0", name="quantity_non_negative"),
        CheckConstraint("min_quantity >= 0", name="min_quantity_non_negative"),
        Index("ix_stock_items_club", "club_id"),
    )

    club_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("clubs.id", ondelete="CASCADE")
    )
    sku: Mapped[str | None] = mapped_column(String(100))
    name: Mapped[str] = mapped_column(String(255))
    description: Mapped[str | None] = mapped_column(Text)
    category: Mapped[str | None] = mapped_column(String(100))
    unit: Mapped[StockUnit] = mapped_column(
        str_enum(StockUnit, "stock_unit"), default=StockUnit.UNIT
    )
    # Solo cambia a través de movimientos (services/stock.py), nunca con un update directo.
    quantity: Mapped[Decimal] = mapped_column(Numeric(12, 3), default=0, server_default="0")
    min_quantity: Mapped[Decimal] = mapped_column(Numeric(12, 3), default=0, server_default="0")
    unit_cost: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))
    unit_price: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))
    supplier: Mapped[str | None] = mapped_column(String(255))
    location: Mapped[str | None] = mapped_column(String(100))
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class StockMovement(UUIDPk, Base):
    __tablename__ = "stock_movements"
    __table_args__ = (
        ForeignKeyConstraint(
            ["item_id", "club_id"],
            ["stock_items.id", "stock_items.club_id"],
            name="fk_stock_movements_item_same_club",
        ),
        CheckConstraint("quantity_delta <> 0", name="delta_not_zero"),
        CheckConstraint("quantity_after = quantity_before + quantity_delta", name="consistent"),
        Index("ix_stock_movements_item_created", "item_id", "created_at"),
    )

    club_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("clubs.id", ondelete="CASCADE")
    )
    item_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True))
    performed_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL")
    )
    type: Mapped[StockMovementType] = mapped_column(
        str_enum(StockMovementType, "stock_movement_type")
    )
    quantity_delta: Mapped[Decimal] = mapped_column(Numeric(12, 3))
    quantity_before: Mapped[Decimal] = mapped_column(Numeric(12, 3))
    quantity_after: Mapped[Decimal] = mapped_column(Numeric(12, 3))
    unit_cost: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))
    reason: Mapped[str | None] = mapped_column(String(500))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
