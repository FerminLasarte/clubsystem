"""
ClubSystem — ClubMembership Model
===================================
Tabla de membresía que relaciona usuarios (socios/visitantes) con clubs.

Diferencia con ClubStaff:
  ClubStaff      → usuarios con acceso al panel de administración (OWNER, MANAGER).
  ClubMembership → socios/visitantes del club (jugadores sin panel de admin).

Un mismo usuario puede:
  - Ser APPROVED en el Club A y PENDING en el Club B.
  - Ser socio en varios clubs simultáneamente.

Estados:
  PENDING  → solicitó membresía, espera aprobación del admin.
  APPROVED → socio activo; accede al precio `price_member` en canchas.
  REJECTED → rechazado; accede al precio `price_guest`.

Migración automática:
  La tabla se crea vía Base.metadata.create_all en el lifespan de main.py.
  No requiere migración manual para instalaciones nuevas.
  Para bases existentes, ver el bloque idempotente en main.py.

Alembic (si aplica en producción):
  alembic revision --autogenerate -m "add_club_memberships"
  alembic upgrade head
"""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from .base import Base


class ClubMembership(Base):
    __tablename__ = "club_memberships"
    __table_args__ = (
        UniqueConstraint("user_id", "club_id", name="uq_club_membership_user_club"),
    )

    # ── Primary key ───────────────────────────────────────────
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    # ── Relación usuario ↔ club ───────────────────────────────
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    club_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("clubs.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # ── Estado de membresía ───────────────────────────────────
    # PENDING  → solicitud pendiente de aprobación del admin
    # APPROVED → socio activo (accede a price_member en canchas)
    # REJECTED → rechazado (accede a price_guest)
    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="PENDING",
        server_default="PENDING",
    )

    # ── Plan de membresía (asignado opcionalmente por el admin) ──
    # Texto libre: "Socio Mensual", "Socio Anual", "Socio Vitalicio"…
    membership_plan_id: Mapped[str | None] = mapped_column(
        String(100), nullable=True
    )

    # ── Timestamps de ciclo de vida ───────────────────────────
    request_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    approved_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    rejected_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
