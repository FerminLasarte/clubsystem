"""
ClubSync — ClubStaff Model
===========================
Tabla que implementa RBAC multi-tenant.

Un mismo usuario (identificado por email) puede pertenecer a MÚLTIPLES clubs,
con uno o varios roles en cada uno.

Roles permitidos (StaffRole enum):
  OWNER                → Acceso total al panel de administración.
  RESERVATIONS_MANAGER → Reservas y Socios.
  STOCK_MANAGER        → Inventario.

Diseño de roles:
  - `roles` es un ARRAY de staff_role → un operador puede ser
    RESERVATIONS_MANAGER y STOCK_MANAGER al mismo tiempo en el mismo club.
  - Solo un SuperAdmin puede asignar OWNER directamente en la DB.
  - Un OWNER puede invitar a otros con cualquier rol excepto OWNER.

Estados de invitación:
  PENDING → invitado, no puede iniciar sesión todavía (is_active=False)
  ACTIVE  → miembro activo del equipo (is_active=True)

Migración desde columna `role` (string único) a `roles` (array):
  -- 1. Crear columna nueva
  ALTER TABLE club_staff
    ADD COLUMN IF NOT EXISTS roles staff_role[]
    DEFAULT '{OWNER}'::staff_role[];

  -- 2. Poblar desde role existente
  UPDATE club_staff SET roles = ARRAY[role]::staff_role[]
    WHERE roles IS NULL OR roles = '{}';

  -- 3. Eliminar columna antigua
  ALTER TABLE club_staff DROP COLUMN IF EXISTS role;
"""

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String, UniqueConstraint
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.postgresql import ARRAY, UUID
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
    Un registro por combinación (email × club_id).
    El operador puede acumular múltiples roles en el mismo club.
    """

    __tablename__ = "club_staff"
    __table_args__ = (
        UniqueConstraint("email", "club_id", name="uq_club_staff_email_club"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    # Identidad cross-club: el mismo email puede aparecer en N clubs.
    email: Mapped[str] = mapped_column(String(255), nullable=False, index=True)

    club_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("clubs.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # ARRAY de roles — un operador puede tener múltiples roles en el mismo club.
    # Valores válidos: OWNER | RESERVATIONS_MANAGER | STOCK_MANAGER
    roles: Mapped[list[str]] = mapped_column(
        ARRAY(STAFF_ROLE_ENUM),
        nullable=False,
        default=lambda: ["OWNER"],
    )

    # FK opcional al registro User. NULL si el operador no tiene cuenta de
    # socio en este club.
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    # Estado de la invitación
    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="ACTIVE",
        server_default="ACTIVE",
    )

    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow
    )
