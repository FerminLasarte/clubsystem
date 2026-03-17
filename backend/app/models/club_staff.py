"""
ClubSync — ClubStaff Model
===========================
Tabla asociativa que implementa RBAC multi-tenant.

Un mismo operador (identificado por email) puede pertenecer a MÚLTIPLES clubs,
con un rol distinto en cada uno. La contraseña se verifica contra el registro
User del operador (cualquier club en el que esté dado de alta).

Roles soportados (StaffRole):
  OWNER                → Acceso total al panel de administración.
  RESERVATIONS_MANAGER → Solo puede ver/gestionar Reservas y Socios.
  STOCK_MANAGER        → Solo puede ver/gestionar Inventario.

Relaciones:
  ClubStaff.email    → identidad cross-club del operador
  ClubStaff.club_id  → FK a clubs.id (CASCADE delete)
  ClubStaff.user_id  → FK nullable a users.id (SET NULL)
                        Presente cuando el operador también es socio del club.
"""

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String, UniqueConstraint
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base

# ── PostgreSQL Enum ───────────────────────────────────────────
# create_type=True: SQLAlchemy crea el TYPE en Postgres si no existe.
STAFF_ROLE_ENUM = SAEnum(
    "OWNER",
    "RESERVATIONS_MANAGER",
    "STOCK_MANAGER",
    name="staff_role",
    create_type=True,
)


class ClubStaff(Base):
    """
    Un registro por combinación (email × club_id) — restricción UNIQUE.
    """

    __tablename__ = "club_staff"
    __table_args__ = (
        UniqueConstraint("email", "club_id", name="uq_club_staff_email_club"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    # Identidad cross-club: el mismo email puede aparecer en N clubes.
    email: Mapped[str] = mapped_column(
        String(255), nullable=False, index=True
    )

    club_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("clubs.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    role: Mapped[str] = mapped_column(
        STAFF_ROLE_ENUM, nullable=False, default="OWNER"
    )

    # FK opcional al registro User de ESE club específico.
    # NULL si el operador no tiene cuenta de socio en el club.
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow
    )
