# backend/models/user.py
import uuid
from datetime import datetime, date

from sqlalchemy import Boolean, DateTime, Date, String, Text, ForeignKey, UniqueConstraint
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from .base import Base


class User(Base):
    __tablename__ = "users"

    # Garantiza unicidad de email por club a nivel de DB.
    # Un mismo email puede existir en clubs distintos (multi-tenant).
    __table_args__ = (
        UniqueConstraint("email", "club_id", name="uq_users_email_club"),
    )

    # ── Identity ──────────────────────────────────────────────
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    # nullable=True: usuarios registrados vía app móvil aún no pertenecen a un club.
    # El admin los asigna posteriormente. Requiere migración Alembic para DBs existentes:
    #   ALTER TABLE users ALTER COLUMN club_id DROP NOT NULL;
    club_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("clubs.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    role: Mapped[str] = mapped_column(
        SAEnum("admin", "staff", "member", name="user_role", create_type=False),
        nullable=False,
        default="member",
    )

    # ── Credentials ───────────────────────────────────────────
    # email indexado para búsquedas rápidas durante el login.
    email: Mapped[str] = mapped_column(
        String(255), nullable=False, index=True
    )
    password_hash: Mapped[str] = mapped_column(Text, nullable=False)

    # ── Profile ───────────────────────────────────────────────
    first_name: Mapped[str]      = mapped_column(String(100), nullable=False)
    last_name:  Mapped[str]      = mapped_column(String(100), nullable=False)
    phone:      Mapped[str | None] = mapped_column(String(50))
    avatar_url: Mapped[str | None] = mapped_column(Text)
    dni:        Mapped[str | None] = mapped_column(String(20))
    birth_date: Mapped[date | None] = mapped_column(Date)

    # ── Membership ────────────────────────────────────────────
    member_number: Mapped[str | None]  = mapped_column(String(50))
    joined_at:     Mapped[date | None] = mapped_column(Date)
    is_active:     Mapped[bool]        = mapped_column(Boolean, nullable=False, default=True)

    # ── Auth state ────────────────────────────────────────────
    email_verified: Mapped[bool]           = mapped_column(Boolean, nullable=False, default=False)
    last_login_at:  Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    # ── Timestamps ────────────────────────────────────────────
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
