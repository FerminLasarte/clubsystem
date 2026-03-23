# backend/app/models/fee.py
"""
ClubSystem — MembershipFee ORM Model
====================================
Registra la cuota periódica de cada socio.

Ciclo de vida:
  PENDING   → cuota generada, aún no cobrada
  PAID      → cobrada; el cobro se cruzó con un Payment (INCOME en caja)
  CANCELLED → anulada manualmente (no impacta en caja)

Multi-tenant: cada registro pertenece a un club_id; todos los queries
filtran por club_id extraído del JWT.
"""
import uuid
from datetime import datetime, date

from sqlalchemy import Boolean, Date, DateTime, Integer, Numeric, String, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from .base import Base


# Valores válidos para status (usamos VARCHAR + CHECK para evitar PgEnum)
VALID_FEE_STATUSES = frozenset({"PENDING", "PAID", "CANCELLED"})


class MembershipFee(Base):
    __tablename__ = "membership_fees"

    # ── PK ────────────────────────────────────────────────────────────────────
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    # ── Tenant ────────────────────────────────────────────────────────────────
    club_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("clubs.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # ── Relación con socio ────────────────────────────────────────────────────
    member_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # ── Descripción de la cuota ───────────────────────────────────────────────
    fee_name: Mapped[str] = mapped_column(String(255), nullable=False)

    # ── Período ───────────────────────────────────────────────────────────────
    month: Mapped[int] = mapped_column(Integer, nullable=False)   # 1–12
    year:  Mapped[int] = mapped_column(Integer, nullable=False)

    # ── Importe ───────────────────────────────────────────────────────────────
    amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)

    # ── Estado ────────────────────────────────────────────────────────────────
    # VARCHAR + CHECK en vez de PgEnum para compatibilidad con asyncpg
    status: Mapped[str] = mapped_column(
        String(10),
        default="PENDING",
        server_default="PENDING",
        nullable=False,
    )

    # ── Fechas ────────────────────────────────────────────────────────────────
    due_date: Mapped[date] = mapped_column(Date, nullable=False)

    # ── Cruce con Caja Diaria (opcional; se puebla al cobrar) ─────────────────
    payment_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("payments.id", ondelete="SET NULL"),
        nullable=True,
    )

    # ── Soft-delete ───────────────────────────────────────────────────────────
    is_active: Mapped[bool] = mapped_column(
        Boolean, default=True, server_default="true", nullable=False
    )

    # ── Timestamps ────────────────────────────────────────────────────────────
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
