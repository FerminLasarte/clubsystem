# backend/models/user.py
import uuid
from datetime import datetime, date
from sqlalchemy import Boolean, DateTime, Date, String, Text, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from .base import Base
from sqlalchemy import Enum as SAEnum



class User(Base):
    __tablename__ = "users"

    id:             Mapped[uuid.UUID]      = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    club_id:        Mapped[uuid.UUID]      = mapped_column(UUID(as_uuid=True), ForeignKey("clubs.id", ondelete="CASCADE"), nullable=False)
    role: Mapped[str] = mapped_column(SAEnum("admin", "staff", "member", name="user_role"), default="member")

    email:          Mapped[str]            = mapped_column(String(255), nullable=False)
    password_hash:  Mapped[str]            = mapped_column(Text, nullable=False)
    first_name:     Mapped[str]            = mapped_column(String(100), nullable=False)
    last_name:      Mapped[str]            = mapped_column(String(100), nullable=False)
    phone:          Mapped[str | None]     = mapped_column(String(50))
    avatar_url:     Mapped[str | None]     = mapped_column(Text)
    dni:            Mapped[str | None]     = mapped_column(String(20))
    birth_date:     Mapped[date | None]    = mapped_column(Date)

    member_number:  Mapped[str | None]     = mapped_column(String(50))
    joined_at:      Mapped[date | None]    = mapped_column(Date)
    is_active:      Mapped[bool]           = mapped_column(Boolean, default=True)

    email_verified: Mapped[bool]           = mapped_column(Boolean, default=False)
    last_login_at:  Mapped[datetime | None]= mapped_column(DateTime(timezone=True))

    created_at:     Mapped[datetime]       = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at:     Mapped[datetime]       = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
