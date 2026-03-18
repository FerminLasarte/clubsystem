# backend/app/models/reservation.py
import uuid
from datetime import datetime
from sqlalchemy import DateTime, Numeric, Text, ForeignKey
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from .base import Base


class Reservation(Base):
    __tablename__ = "reservations"

    # ── Primary key ───────────────────────────────────────────
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    # ── Foreign keys (tenant + court + user) ─────────────────
    club_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("clubs.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    court_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("courts.id"),
        nullable=False,
        index=True,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False,
        index=True,
    )

    # ── Status ────────────────────────────────────────────────
    # create_type=False → no intenta CREATE TYPE si el ENUM ya existe en la DB.
    # El esquema físico (01_schema.sql) ya creó `reservation_status`.
    status: Mapped[str] = mapped_column(
        SAEnum(
            "pending", "confirmed", "cancelled", "completed",
            name="reservation_status",
            create_type=False,          # ← crítico para DBs pre-existentes
        ),
        nullable=False,
        default="pending",
    )

    # ── Schedule ──────────────────────────────────────────────
    # Almacenados con timezone=True (UTC en PostgreSQL).
    # El constraint GiST `no_overlap` vive en la DB — no se modela aquí.
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    ends_at:   Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    # ── Payments ──────────────────────────────────────────────
    total_price:  Mapped[float] = mapped_column(Numeric(10, 2), nullable=False, default=0)
    paid_amount:  Mapped[float] = mapped_column(Numeric(10, 2), nullable=False, default=0)

    # ── Metadata ──────────────────────────────────────────────
    notes:        Mapped[str | None]         = mapped_column(Text)
    cancelled_at: Mapped[datetime | None]    = mapped_column(DateTime(timezone=True))
    cancelled_by: Mapped[uuid.UUID | None]   = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id")
    )

    # ── Timestamps ────────────────────────────────────────────
    # server_default=func.now() → SQL NOW() resuelto por PostgreSQL (siempre UTC).
    # El trigger `set_updated_at` del esquema físico también actualiza updated_at;
    # onupdate=func.now() lo sincroniza desde SQLAlchemy en updates explícitos.
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
