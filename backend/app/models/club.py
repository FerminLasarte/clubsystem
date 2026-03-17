# backend/models/club.py
import uuid
from datetime import datetime
from sqlalchemy import Boolean, DateTime, String, Text, ARRAY
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from .base import Base


class Club(Base):
    __tablename__ = "clubs"

    id:            Mapped[uuid.UUID]  = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    slug:          Mapped[str]        = mapped_column(String(100), unique=True, nullable=False)
    name:          Mapped[str]        = mapped_column(String(255), nullable=False)
    sport_types:   Mapped[list]       = mapped_column(ARRAY(String), nullable=False, default=list)

    # Branding
    logo_url:      Mapped[str | None] = mapped_column(Text)
    primary_color: Mapped[str]        = mapped_column(String(7), default="#111827")
    accent_color:  Mapped[str]        = mapped_column(String(7), default="#3B82F6")
    font_family:   Mapped[str]        = mapped_column(String(100), default="Inter")

    # Contact
    address:       Mapped[str | None] = mapped_column(Text)
    city:          Mapped[str | None] = mapped_column(String(100))
    country:       Mapped[str]        = mapped_column(String(100), default="AR")
    phone:         Mapped[str | None] = mapped_column(String(50))
    email:         Mapped[str | None] = mapped_column(String(255))
    website:       Mapped[str | None] = mapped_column(Text)

    # Subscription
    is_active:     Mapped[bool]       = mapped_column(Boolean, default=True)
    plan:          Mapped[str]        = mapped_column(String(50), default="starter")

    created_at:    Mapped[datetime]   = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at:    Mapped[datetime]   = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
