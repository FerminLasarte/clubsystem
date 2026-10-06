"""Identidad global: usuarios, sesiones de refresh y tokens de un solo uso."""

import uuid
from datetime import date, datetime

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import INET, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.domain.enums import Gender, OneTimeTokenPurpose
from app.models.base import Base, Timestamps, UUIDPk, str_enum


class User(UUIDPk, Timestamps, Base):
    """
    Persona con cuenta en el sistema. Es global: no pertenece a un club.
    Lo que es propio de cada club (staff, socio, plan) vive en ClubStaff / ClubMembership.
    Solo el propio usuario (o el sistema) modifica estos datos.
    """

    __tablename__ = "users"
    __table_args__ = (CheckConstraint("email = lower(email)", name="email_lowercase"),)

    email: Mapped[str] = mapped_column(String(255), unique=True)
    password_hash: Mapped[str] = mapped_column(Text)
    first_name: Mapped[str] = mapped_column(String(100))
    last_name: Mapped[str] = mapped_column(String(100))
    phone: Mapped[str | None] = mapped_column(String(50))
    dni: Mapped[str | None] = mapped_column(String(20), unique=True)
    birth_date: Mapped[date | None] = mapped_column(Date)
    gender: Mapped[Gender | None] = mapped_column(str_enum(Gender, "gender"))
    avatar_url: Mapped[str | None] = mapped_column(Text)
    email_verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    # Se incrementa para invalidar todos los access tokens emitidos (logout global).
    token_version: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    @property
    def full_name(self) -> str:
        return f"{self.first_name} {self.last_name}"


class AuthSession(UUIDPk, Base):
    """
    Refresh token (opaco, guardado como hash). Rotación en cada uso: si se presenta un
    token ya rotado, se revoca toda la familia (detección de robo).
    """

    __tablename__ = "auth_sessions"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    family_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), index=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    # Club activo de la sesión del panel (None en mobile).
    active_club_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("clubs.id", ondelete="SET NULL")
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    rotated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    user_agent: Mapped[str | None] = mapped_column(String(255))
    ip: Mapped[str | None] = mapped_column(INET)


class OneTimeToken(UUIDPk, Base):
    """Tokens de verificación de email y reset de contraseña (hash, un solo uso)."""

    __tablename__ = "one_time_tokens"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    purpose: Mapped[OneTimeTokenPurpose] = mapped_column(
        str_enum(OneTimeTokenPurpose, "one_time_token_purpose")
    )
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
