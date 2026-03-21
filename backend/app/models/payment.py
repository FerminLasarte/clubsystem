# backend/app/models/payment.py
"""
ClubSync — Payment ORM Model
============================
Registra cada cobro/ingreso (INCOME) o retiro/vale de caja chica (OUTFLOW).
Soft-delete via is_active = False.
"""
import uuid
from datetime import datetime
from sqlalchemy import Boolean, DateTime, Numeric, String, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from .base import Base


VALID_PAYMENT_METHODS   = frozenset({"EFECTIVO", "TARJETA", "TRANSFERENCIA", "MERCADOPAGO"})
VALID_TRANSACTION_TYPES = frozenset({"INCOME", "OUTFLOW"})


class Payment(Base):
    __tablename__ = "payments"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    club_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("clubs.id", ondelete="CASCADE"), nullable=False
    )

    # Tipo de transacción: INCOME (cobro entrante) | OUTFLOW (retiro/caja chica)
    transaction_type: Mapped[str] = mapped_column(
        String(10), default="INCOME", server_default="INCOME", nullable=False
    )

    # Importes
    amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    payment_method: Mapped[str] = mapped_column(String(30), nullable=False)
    description: Mapped[str] = mapped_column(String(255), nullable=False)

    # Relaciones opcionales
    member_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    reservation_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("reservations.id", ondelete="SET NULL"), nullable=True
    )

    # Timestamps
    payment_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=func.now(), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=func.now(), nullable=False
    )

    # Soft-delete
    is_active: Mapped[bool] = mapped_column(
        Boolean, default=True, server_default="true", nullable=False
    )
