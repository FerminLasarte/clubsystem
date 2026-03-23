"""
ClubSystem — Notification Model
==============================
Notificaciones in-app para usuarios del sistema.

Casos de uso actuales:
  - Invitación al equipo: el usuario invitado recibe una notificación
    cuando un OWNER lo añade como staff de un club.

Columnas:
  id         → UUID PK
  user_id    → FK a users.id (CASCADE delete)
  title      → Título corto de la notificación
  message    → Cuerpo completo del mensaje
  is_read    → False hasta que el usuario la marque como leída
  created_at → Timestamp con timezone
"""

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base


class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    # Usuario destinatario de la notificación.
    # Si el usuario se elimina, la notificación también se borra (CASCADE).
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    title: Mapped[str] = mapped_column(String(255), nullable=False)

    message: Mapped[str] = mapped_column(Text, nullable=False)

    is_read: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow, nullable=False
    )
