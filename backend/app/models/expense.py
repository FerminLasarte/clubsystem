# backend/models/expense.py
import uuid
from datetime import datetime, date
from sqlalchemy import Date, DateTime, Float, Numeric, String, Text, ForeignKey, ARRAY
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from .base import Base
from sqlalchemy import Enum as SAEnum


class Expense(Base):
    __tablename__ = "expenses"

    id:               Mapped[uuid.UUID]      = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    club_id:          Mapped[uuid.UUID]      = mapped_column(UUID(as_uuid=True), ForeignKey("clubs.id", ondelete="CASCADE"), nullable=False)
    created_by:       Mapped[uuid.UUID]      = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)

    category: Mapped[str] = mapped_column(
        SAEnum("maintenance", "utilities", "salaries", "equipment",
            "marketing", "supplies", "other", name="expense_category"),
        nullable=False
    )
    description:      Mapped[str]            = mapped_column(String(500), nullable=False)
    amount:           Mapped[float]          = mapped_column(Numeric(12, 2), nullable=False)
    currency:         Mapped[str]            = mapped_column(String(3), default="ARS")
    expense_date:     Mapped[date]           = mapped_column(Date, nullable=False)
    receipt_url:      Mapped[str | None]     = mapped_column(Text)

    vendor_name:      Mapped[str | None]     = mapped_column(String(255))
    vendor_tax_id:    Mapped[str | None]     = mapped_column(String(50))

    anomaly_score:    Mapped[float | None]   = mapped_column(Float)
    anomaly_severity: Mapped[str | None] = mapped_column(
        SAEnum("low", "medium", "high", "critical", name="anomaly_severity")
    )
    anomaly_reason:   Mapped[str | None]     = mapped_column(Text)
    anomaly_llm_explanation: Mapped[str | None] = mapped_column(Text)
    reviewed_by:      Mapped[uuid.UUID|None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    reviewed_at:      Mapped[datetime | None]= mapped_column(DateTime(timezone=True))

    tags:             Mapped[list]           = mapped_column(ARRAY(String), default=list)
    notes:            Mapped[str | None]     = mapped_column(Text)

    created_at:       Mapped[datetime]       = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at:       Mapped[datetime]       = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
