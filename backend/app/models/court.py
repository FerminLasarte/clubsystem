# backend/models/court.py
import uuid
from datetime import datetime
from sqlalchemy import Boolean, DateTime, Float, Integer, Numeric, String, Text, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column
from .base import Base


class Court(Base):
    __tablename__ = "courts"

    id:              Mapped[uuid.UUID]  = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    club_id:         Mapped[uuid.UUID]  = mapped_column(UUID(as_uuid=True), ForeignKey("clubs.id", ondelete="CASCADE"), nullable=False)

    name:            Mapped[str]        = mapped_column(String(100), nullable=False)
    sport:           Mapped[str]        = mapped_column(String(50), nullable=False)
    surface:         Mapped[str | None] = mapped_column(String(50))
    is_indoor:       Mapped[bool]       = mapped_column(Boolean, default=False)
    is_active:       Mapped[bool]       = mapped_column(Boolean, default=True)
    capacity:        Mapped[int]        = mapped_column(Integer, default=2)
    hourly_rate:     Mapped[float]      = mapped_column(Numeric(10, 2), default=0)
    description:     Mapped[str | None] = mapped_column(Text)
    image_url:       Mapped[str | None] = mapped_column(Text)
    operating_hours: Mapped[dict]       = mapped_column(JSONB, default=dict)

    created_at:      Mapped[datetime]   = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at:      Mapped[datetime]   = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
