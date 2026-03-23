"""
ClubSystem — Notifications Router
=================================
Endpoints in-app para el usuario autenticado (funciona con JWT limitado,
es decir: usuarios mobile que aún no tienen club activo pueden consultarlas).

Endpoints:
  GET  /api/v1/notifications           → Lista notificaciones del usuario.
  PATCH /api/v1/notifications/{id}/read → Marca una notificación como leída.
"""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.middleware.tenant import get_current_user_id
from app.models.notification import Notification

router = APIRouter()


# ── Schema ────────────────────────────────────────────────────

class NotificationOut(BaseModel):
    id: UUID
    title: str
    message: str
    is_read: bool
    created_at: str  # ISO 8601


# ── GET / ─────────────────────────────────────────────────────

@router.get("/", response_model=list[NotificationOut])
async def list_notifications(
    user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> list[NotificationOut]:
    """
    Devuelve todas las notificaciones del usuario autenticado,
    ordenadas de más reciente a más antigua.
    Accesible con JWT limitado (usuarios sin club asignado).
    """
    result = await db.execute(
        select(Notification)
        .where(Notification.user_id == user_id)
        .order_by(Notification.created_at.desc())
    )
    notifs = result.scalars().all()

    return [
        NotificationOut(
            id=n.id,
            title=n.title,
            message=n.message,
            is_read=n.is_read,
            created_at=n.created_at.isoformat(),
        )
        for n in notifs
    ]


# ── PATCH /{id}/read ──────────────────────────────────────────

@router.patch("/{notification_id}/read", status_code=status.HTTP_204_NO_CONTENT)
async def mark_as_read(
    notification_id: UUID,
    user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> None:
    """
    Marca una notificación como leída.
    Solo el propietario puede marcarla (user_id validado contra el JWT).
    """
    result = await db.execute(
        select(Notification).where(
            Notification.id == notification_id,
            Notification.user_id == user_id,
        )
    )
    notif = result.scalar_one_or_none()

    if notif is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notificación no encontrada",
        )

    notif.is_read = True
    await db.commit()
