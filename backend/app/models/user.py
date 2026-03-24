# backend/app/models/user.py
"""
Modelo global de usuario (B2B2C).

Reglas de negocio:
  - Un User es una entidad GLOBAL sin rol propio. No existe "admin global".
  - Los roles de staff se definen en ClubStaff (tabla User ↔ Club con RBAC).
  - La membresía de socio se define en ClubMembership (User ↔ Club con status).
  - Un usuario puede pertenecer a 0, 1 o N clubs a través de esas tablas.
"""

import uuid
from datetime import datetime, date

from sqlalchemy import Boolean, DateTime, Date, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from .base import Base


class User(Base):
    __tablename__ = "users"

    # Los usuarios son entidades globales (B2B2C).
    # El email es único a nivel mundial — no existe el mismo usuario en dos clubs.

    # ── Identity ──────────────────────────────────────────────
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    # ── Credentials ───────────────────────────────────────────
    email: Mapped[str] = mapped_column(
        String(255), nullable=False, unique=True, index=True
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
    member_number:   Mapped[str | None]  = mapped_column(String(50))
    joined_at:       Mapped[date | None] = mapped_column(Date)
    is_active:       Mapped[bool]        = mapped_column(Boolean, nullable=False, default=True)
    gender:          Mapped[str | None]  = mapped_column(String(20))
    membership_plan: Mapped[str | None]  = mapped_column(String(100))

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
