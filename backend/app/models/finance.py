"""
Finanzas del club.

`payments` es el único libro de caja: todo ingreso (cobro de reserva, cuota, venta) y todo
egreso de caja es un Payment. Las cuotas y reservas pagadas apuntan a su Payment.
`expenses` registra gastos operativos (con detección de anomalías).
"""

import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    CheckConstraint,
    Date,
    DateTime,
    Float,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.domain.enums import (
    AnomalySeverity,
    ExpenseCategory,
    FeeStatus,
    PaymentMethod,
    TransactionType,
)
from app.models.base import Base, Timestamps, UUIDPk, str_enum


class Payment(UUIDPk, Base):
    __tablename__ = "payments"
    __table_args__ = (
        UniqueConstraint("id", "club_id"),
        ForeignKeyConstraint(
            ["membership_id", "club_id"],
            ["club_memberships.id", "club_memberships.club_id"],
            name="fk_payments_membership_same_club",
        ),
        ForeignKeyConstraint(
            ["reservation_id", "club_id"],
            ["reservations.id", "reservations.club_id"],
            name="fk_payments_reservation_same_club",
        ),
        CheckConstraint("amount > 0", name="amount_positive"),
        Index("ix_payments_club_occurred", "club_id", "occurred_at"),
        Index("ix_payments_reservation", "reservation_id"),
    )

    club_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("clubs.id", ondelete="CASCADE")
    )
    type: Mapped[TransactionType] = mapped_column(str_enum(TransactionType, "transaction_type"))
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    method: Mapped[PaymentMethod] = mapped_column(str_enum(PaymentMethod, "payment_method"))
    description: Mapped[str] = mapped_column(String(255))
    membership_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    reservation_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    created_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL")
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    voided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    voided_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL")
    )
    void_reason: Mapped[str | None] = mapped_column(String(255))


class MembershipFee(UUIDPk, Timestamps, Base):
    __tablename__ = "membership_fees"
    __table_args__ = (
        ForeignKeyConstraint(
            ["membership_id", "club_id"],
            ["club_memberships.id", "club_memberships.club_id"],
            name="fk_membership_fees_membership_same_club",
            ondelete="CASCADE",
        ),
        ForeignKeyConstraint(
            ["payment_id", "club_id"],
            ["payments.id", "payments.club_id"],
            name="fk_membership_fees_payment_same_club",
        ),
        CheckConstraint("month BETWEEN 1 AND 12", name="month_range"),
        CheckConstraint("amount >= 0", name="amount_non_negative"),
        CheckConstraint("(status = 'PAID') = (payment_id IS NOT NULL)", name="paid_has_payment"),
        # Una cuota vigente por socio y período.
        Index(
            "uq_membership_fees_period_active",
            "membership_id",
            "year",
            "month",
            unique=True,
            postgresql_where=text("status <> 'CANCELLED'"),
        ),
        Index("ix_membership_fees_club_period", "club_id", "year", "month"),
    )

    club_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("clubs.id", ondelete="CASCADE")
    )
    membership_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True))
    plan_name: Mapped[str] = mapped_column(String(100))
    year: Mapped[int] = mapped_column(Integer)
    month: Mapped[int] = mapped_column(Integer)
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    status: Mapped[FeeStatus] = mapped_column(
        str_enum(FeeStatus, "fee_status"), default=FeeStatus.PENDING
    )
    due_date: Mapped[date] = mapped_column(Date)
    payment_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), unique=True)
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class Expense(UUIDPk, Timestamps, Base):
    __tablename__ = "expenses"
    __table_args__ = (
        CheckConstraint("amount > 0", name="amount_positive"),
        CheckConstraint(
            "anomaly_score IS NULL OR (anomaly_score >= 0 AND anomaly_score <= 1)",
            name="anomaly_score_range",
        ),
        Index("ix_expenses_club_date", "club_id", "expense_date"),
        Index("ix_expenses_club_category", "club_id", "category"),
        # Lo que el job de explicaciones busca cada minuto en cada club.
        Index(
            "ix_expenses_pending_explanation",
            "club_id",
            postgresql_where=text(
                "deleted_at IS NULL AND anomaly_explained_at IS NULL"
                " AND anomaly_severity IN ('medium', 'high', 'critical')"
            ),
        ),
    )

    club_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("clubs.id", ondelete="CASCADE")
    )
    created_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL")
    )
    category: Mapped[ExpenseCategory] = mapped_column(str_enum(ExpenseCategory, "expense_category"))
    description: Mapped[str] = mapped_column(String(500))
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    currency: Mapped[str] = mapped_column(String(3), default="ARS", server_default="ARS")
    expense_date: Mapped[date] = mapped_column(Date)
    vendor_name: Mapped[str | None] = mapped_column(String(255))
    vendor_tax_id: Mapped[str | None] = mapped_column(String(50))
    receipt_url: Mapped[str | None] = mapped_column(Text)
    notes: Mapped[str | None] = mapped_column(Text)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    # Detección de anomalías: la parte estadística se calcula al guardar;
    # la explicación del LLM llega después, en background.
    anomaly_score: Mapped[float | None] = mapped_column(Float)
    anomaly_severity: Mapped[AnomalySeverity | None] = mapped_column(
        str_enum(AnomalySeverity, "anomaly_severity")
    )
    anomaly_reasons: Mapped[str | None] = mapped_column(Text)
    anomaly_analyzed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    anomaly_explanation: Mapped[str | None] = mapped_column(Text)
    anomaly_recommended_action: Mapped[str | None] = mapped_column(Text)
    # Con explained_at y sin explicación: el LLM no la pudo dar (no se reintenta).
    anomaly_explained_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    # Batch de Anthropic en curso que va a traer la explicación.
    anomaly_batch_id: Mapped[str | None] = mapped_column(String(100))
    reviewed_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL")
    )
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
