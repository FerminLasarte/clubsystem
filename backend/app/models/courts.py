"""Canchas y reservas."""

import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.postgresql import UUID, ExcludeConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.domain.enums import (
    CancelReason,
    CourtSurface,
    CustomerType,
    ReservationSource,
    ReservationStatus,
    Sport,
)
from app.models.base import Base, Timestamps, UUIDPk, str_enum
from app.models.identity import User


class Court(UUIDPk, Timestamps, Base):
    __tablename__ = "courts"
    __table_args__ = (
        UniqueConstraint("club_id", "name"),
        UniqueConstraint("id", "club_id"),
        CheckConstraint("price_member >= 0 AND price_guest >= 0", name="prices_non_negative"),
        CheckConstraint("capacity > 0", name="capacity_positive"),
    )

    club_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("clubs.id", ondelete="CASCADE"), index=True
    )
    name: Mapped[str] = mapped_column(String(100))
    sport: Mapped[Sport] = mapped_column(str_enum(Sport, "sport"))
    surface: Mapped[CourtSurface | None] = mapped_column(str_enum(CourtSurface, "court_surface"))
    is_indoor: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    capacity: Mapped[int] = mapped_column(Integer, default=4, server_default="4")
    # Precio por hora. El precio de una reserva se calcula en domain/pricing.py.
    price_member: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    price_guest: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    description: Mapped[str | None] = mapped_column(Text)
    image_url: Mapped[str | None] = mapped_column(Text)


ACTIVE_RESERVATION_STATUSES = (ReservationStatus.PENDING, ReservationStatus.CONFIRMED)


class Reservation(UUIDPk, Timestamps, Base):
    """
    Reserva de una cancha. Un socio (user_id) o un invitado cargado por el staff (guest_name).
    La base impide solapamientos de reservas activas en la misma cancha (EXCLUDE GiST).
    """

    __tablename__ = "reservations"
    __table_args__ = (
        UniqueConstraint("id", "club_id"),
        ForeignKeyConstraint(
            ["court_id", "club_id"],
            ["courts.id", "courts.club_id"],
            name="fk_reservations_court_same_club",
        ),
        CheckConstraint("ends_at > starts_at", name="time_range"),
        CheckConstraint("total_price >= 0", name="price_non_negative"),
        CheckConstraint(
            "(customer_type = 'MEMBER' AND user_id IS NOT NULL)"
            " OR (customer_type = 'GUEST' AND guest_name IS NOT NULL)",
            name="customer",
        ),
        ExcludeConstraint(
            ("court_id", "="),
            (text("tstzrange(starts_at, ends_at, '[)')"), "&&"),
            name="no_overlap",
            using="gist",
            where=text("status IN ('pending', 'confirmed')"),
        ),
        Index("ix_reservations_club_starts", "club_id", "starts_at"),
        Index("ix_reservations_court_starts", "court_id", "starts_at"),
    )

    club_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("clubs.id", ondelete="CASCADE")
    )
    court_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True))
    customer_type: Mapped[CustomerType] = mapped_column(str_enum(CustomerType, "customer_type"))
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), index=True
    )
    guest_name: Mapped[str | None] = mapped_column(String(200))
    guest_phone: Mapped[str | None] = mapped_column(String(50))
    status: Mapped[ReservationStatus] = mapped_column(
        str_enum(ReservationStatus, "reservation_status"), default=ReservationStatus.PENDING
    )
    source: Mapped[ReservationSource] = mapped_column(
        str_enum(ReservationSource, "reservation_source")
    )
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    ends_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    total_price: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    notes: Mapped[str | None] = mapped_column(Text)
    created_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL")
    )
    confirmed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    # NULL con cancel_reason = EXPIRED_UNCONFIRMED: la canceló el sistema.
    cancelled_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL")
    )
    cancel_reason: Mapped[CancelReason | None] = mapped_column(
        str_enum(CancelReason, "cancel_reason")
    )

    court: Mapped[Court] = relationship(
        primaryjoin="Reservation.court_id == Court.id",
        foreign_keys=[court_id],
        viewonly=True,
        lazy="raise",
    )
    user: Mapped[User | None] = relationship(foreign_keys=[user_id], lazy="raise")
