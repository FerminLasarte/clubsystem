"""Club (tenant) y sus vínculos con personas: staff del panel, planes y membresías de socios."""

import uuid
from datetime import date, datetime, time
from decimal import Decimal

from sqlalchemy import (
    ARRAY,
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    Numeric,
    String,
    Text,
    Time,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.domain.enums import MembershipStatus, Sport, StaffRole, StaffStatus
from app.models.base import Base, Timestamps, UUIDPk, str_enum
from app.models.identity import User


def _in_list(column: str, values: list[str]) -> str:
    quoted = ", ".join(f"'{v}'" for v in values)
    return f"{column} <@ ARRAY[{quoted}]::varchar[]"


class Club(UUIDPk, Timestamps, Base):
    __tablename__ = "clubs"
    __table_args__ = (
        CheckConstraint(_in_list("sport_types", [s.value for s in Sport]), name="sport_types"),
        CheckConstraint("primary_color ~ '^#[0-9A-Fa-f]{6}$'", name="primary_color_hex"),
        CheckConstraint("accent_color ~ '^#[0-9A-Fa-f]{6}$'", name="accent_color_hex"),
        CheckConstraint(
            "open_time IS NULL OR close_time IS NULL OR open_time < close_time", name="hours"
        ),
    )

    slug: Mapped[str] = mapped_column(String(100), unique=True)
    name: Mapped[str] = mapped_column(String(255))
    sport_types: Mapped[list[str]] = mapped_column(
        ARRAY(String(20)), default=list, server_default="{}"
    )
    logo_url: Mapped[str | None] = mapped_column(Text)
    primary_color: Mapped[str] = mapped_column(
        String(7), default="#111827", server_default="#111827"
    )
    accent_color: Mapped[str] = mapped_column(
        String(7), default="#3B82F6", server_default="#3B82F6"
    )
    address: Mapped[str | None] = mapped_column(Text)
    city: Mapped[str | None] = mapped_column(String(100))
    country: Mapped[str] = mapped_column(String(2), default="AR", server_default="AR")
    timezone: Mapped[str] = mapped_column(
        String(64),
        default="America/Argentina/Buenos_Aires",
        server_default="America/Argentina/Buenos_Aires",
    )
    phone: Mapped[str | None] = mapped_column(String(50))
    email: Mapped[str | None] = mapped_column(String(255))
    website: Mapped[str | None] = mapped_column(Text)
    # Horario operativo diario. NULL = sin restricción (se usa 00:00–24:00).
    open_time: Mapped[time | None] = mapped_column(Time)
    close_time: Mapped[time | None] = mapped_column(Time)
    plan: Mapped[str] = mapped_column(String(50), default="starter", server_default="starter")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")


class ClubStaff(UUIDPk, Timestamps, Base):
    """Acceso al panel de un club. Se invita por email; al aceptar se vincula el usuario."""

    __tablename__ = "club_staff"
    __table_args__ = (
        UniqueConstraint("club_id", "email"),
        CheckConstraint(_in_list("roles", [r.value for r in StaffRole]), name="roles_valid"),
        CheckConstraint("cardinality(roles) >= 1", name="roles_not_empty"),
        CheckConstraint("email = lower(email)", name="email_lowercase"),
    )

    club_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("clubs.id", ondelete="CASCADE"), index=True
    )
    email: Mapped[str] = mapped_column(String(255))
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    roles: Mapped[list[str]] = mapped_column(ARRAY(String(30)))
    status: Mapped[StaffStatus] = mapped_column(
        str_enum(StaffStatus, "staff_status"), default=StaffStatus.INVITED
    )
    invited_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL")
    )
    # Invitación pendiente: el link del email lleva el token; acá solo su hash.
    invite_token_hash: Mapped[str | None] = mapped_column(String(64), unique=True)
    invite_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    club: Mapped[Club] = relationship(lazy="raise")
    user: Mapped[User | None] = relationship(foreign_keys=[user_id], lazy="raise")


class MembershipPlan(UUIDPk, Timestamps, Base):
    __tablename__ = "membership_plans"
    __table_args__ = (
        UniqueConstraint("club_id", "name"),
        UniqueConstraint("id", "club_id"),
        CheckConstraint("monthly_fee >= 0", name="fee_non_negative"),
    )

    club_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("clubs.id", ondelete="CASCADE"), index=True
    )
    name: Mapped[str] = mapped_column(String(100))
    monthly_fee: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")


class ClubMembership(UUIDPk, Timestamps, Base):
    """Socio de un club. Plan, número de socio, alta y estado son propios de cada club."""

    __tablename__ = "club_memberships"
    __table_args__ = (
        UniqueConstraint("club_id", "user_id"),
        UniqueConstraint("club_id", "member_number"),
        UniqueConstraint("id", "club_id"),
        # El plan tiene que ser del mismo club.
        ForeignKeyConstraint(
            ["plan_id", "club_id"],
            ["membership_plans.id", "membership_plans.club_id"],
            name="fk_club_memberships_plan_same_club",
        ),
        Index("ix_club_memberships_club_status", "club_id", "status"),
    )

    club_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("clubs.id", ondelete="CASCADE"), index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    status: Mapped[MembershipStatus] = mapped_column(
        str_enum(MembershipStatus, "membership_status"), default=MembershipStatus.PENDING
    )
    plan_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    member_number: Mapped[str | None] = mapped_column(String(50))
    joined_on: Mapped[date | None] = mapped_column(Date)
    requested_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    invited_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    decided_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL")
    )
    notes: Mapped[str | None] = mapped_column(Text)

    user: Mapped[User] = relationship(foreign_keys=[user_id], lazy="raise")
    club: Mapped[Club] = relationship(lazy="raise")
    plan: Mapped[MembershipPlan | None] = relationship(
        primaryjoin="ClubMembership.plan_id == MembershipPlan.id",
        foreign_keys=[plan_id],
        viewonly=True,
        lazy="raise",
    )
