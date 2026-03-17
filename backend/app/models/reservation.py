# backend/app/models/reservation.py
import uuid
from datetime import datetime
from sqlalchemy import Boolean, DateTime, Numeric, String, Text, ForeignKey, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from .base import Base
from sqlalchemy import Enum as SAEnum


class Reservation(Base):
    __tablename__ = "reservations"

    id:           Mapped[uuid.UUID]     = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    club_id:      Mapped[uuid.UUID]     = mapped_column(UUID(as_uuid=True), ForeignKey("clubs.id", ondelete="CASCADE"), nullable=False)
    court_id:     Mapped[uuid.UUID]     = mapped_column(UUID(as_uuid=True), ForeignKey("courts.id"), nullable=False)
    user_id:      Mapped[uuid.UUID]     = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)

    status: Mapped[str] = mapped_column(SAEnum("pending", "confirmed", "cancelled", "completed", name="reservation_status"), default="pending")
    starts_at:    Mapped[datetime]      = mapped_column(DateTime(timezone=True), nullable=False)
    ends_at:      Mapped[datetime]      = mapped_column(DateTime(timezone=True), nullable=False)

    total_price:  Mapped[float]         = mapped_column(Numeric(10, 2), default=0)
    paid_amount:  Mapped[float]         = mapped_column(Numeric(10, 2), default=0)

    notes:        Mapped[str | None]    = mapped_column(Text)
    cancelled_at: Mapped[datetime|None] = mapped_column(DateTime(timezone=True))
    cancelled_by: Mapped[uuid.UUID|None]= mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))

    created_at:   Mapped[datetime]      = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at:   Mapped[datetime]      = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
