# backend/models/stock.py
import uuid
from datetime import datetime
from sqlalchemy import Boolean, DateTime, Numeric, String, Text, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base

# NOTA: La columna `unit` fue originalmente un PostgreSQL ENUM (stock_unit).
# asyncpg envía SIEMPRE los strings como $N::VARCHAR, lo que PostgreSQL
# rechaza para columnas ENUM. La migración en main.py (lifespan) convierte
# la columna a VARCHAR(20) + CHECK constraint en el primer arranque.
# Aquí mapeamos como String(20) que coincide exactamente con VARCHAR(20).


class StockItem(Base):
    __tablename__ = "stock_items"

    id:           Mapped[uuid.UUID]  = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    club_id:      Mapped[uuid.UUID]  = mapped_column(UUID(as_uuid=True), ForeignKey("clubs.id", ondelete="CASCADE"), nullable=False)

    sku:          Mapped[str | None] = mapped_column(String(100))
    name:         Mapped[str]        = mapped_column(String(255), nullable=False)
    description:  Mapped[str | None] = mapped_column(Text)
    category:     Mapped[str | None] = mapped_column(String(100))
    unit:         Mapped[str]        = mapped_column(String(20), default="unit")
    quantity:     Mapped[float]      = mapped_column(Numeric(10, 2), default=0)
    min_quantity: Mapped[float]      = mapped_column(Numeric(10, 2), default=0)
    unit_cost:    Mapped[float|None] = mapped_column(Numeric(10, 2))
    unit_price:   Mapped[float|None] = mapped_column(Numeric(10, 2))
    supplier:     Mapped[str | None] = mapped_column(String(255))
    location:     Mapped[str | None] = mapped_column(String(100))
    image_url:    Mapped[str | None] = mapped_column(Text)
    is_active:    Mapped[bool]       = mapped_column(Boolean, default=True)

    created_at:   Mapped[datetime]   = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at:   Mapped[datetime]   = mapped_column(DateTime(timezone=True), default=datetime.utcnow)


class StockMovement(Base):
    __tablename__ = "stock_movements"

    id:              Mapped[uuid.UUID]  = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    club_id:         Mapped[uuid.UUID]  = mapped_column(UUID(as_uuid=True), ForeignKey("clubs.id", ondelete="CASCADE"), nullable=False)
    item_id:         Mapped[uuid.UUID]  = mapped_column(UUID(as_uuid=True), ForeignKey("stock_items.id"), nullable=False)
    performed_by:    Mapped[uuid.UUID]  = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)

    type:            Mapped[str]        = mapped_column(String(20), nullable=False)
    quantity_delta:  Mapped[float]      = mapped_column(Numeric(10, 2), nullable=False)
    quantity_before: Mapped[float]      = mapped_column(Numeric(10, 2), nullable=False)
    quantity_after:  Mapped[float]      = mapped_column(Numeric(10, 2), nullable=False)
    unit_cost:       Mapped[float|None] = mapped_column(Numeric(10, 2))
    reason:          Mapped[str | None] = mapped_column(Text)
    reference_id:    Mapped[uuid.UUID|None] = mapped_column(UUID(as_uuid=True))

    created_at:      Mapped[datetime]   = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
