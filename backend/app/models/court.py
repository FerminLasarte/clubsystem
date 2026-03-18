# backend/app/models/court.py
import uuid
from datetime import datetime
from sqlalchemy import Boolean, DateTime, Integer, Numeric, String, Text, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from .base import Base


class Court(Base):
    __tablename__ = "courts"

    # ── Primary key ───────────────────────────────────────────
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    # ── Tenant FK ─────────────────────────────────────────────
    club_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("clubs.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # ── Características ───────────────────────────────────────
    name:      Mapped[str]        = mapped_column(String(100), nullable=False)
    # `sport` mapea la columna sport_type ENUM de PostgreSQL.
    # Se usa String para evitar que SQLAlchemy intente CREATE TYPE — la DB
    # ya tiene el ENUM definido en 01_schema.sql y lo valida a nivel físico.
    sport:     Mapped[str]        = mapped_column(String(50), nullable=False)
    surface:   Mapped[str | None] = mapped_column(String(50))
    is_indoor: Mapped[bool]       = mapped_column(Boolean, nullable=False, default=False)
    is_active: Mapped[bool]       = mapped_column(Boolean, nullable=False, default=True)
    capacity:  Mapped[int]        = mapped_column(Integer, default=2)
    hourly_rate: Mapped[float]    = mapped_column(Numeric(10, 2), nullable=False, default=0)

    description: Mapped[str | None] = mapped_column(Text)
    image_url:   Mapped[str | None] = mapped_column(Text)

    # Horarios de operación como JSON flexible:
    # {"mon": {"open": "08:00", "close": "22:00"}, "tue": {...}, ...}
    operating_hours: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)

    # ── Timestamps ────────────────────────────────────────────
    # server_default=func.now() → NOW() resuelto por PostgreSQL (siempre UTC).
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
