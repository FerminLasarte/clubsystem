"""
ClubSystem — Invitations Router
================================
Gestiona las invitaciones pendientes de un usuario a clubs.

Al aceptar:
  1. Se activa el ClubStaff (status ACTIVE, is_active True).
  2. Se marcan como leídas las notificaciones relacionadas.
  3. Se emite un nuevo JWT completo (con club_id y role) para que la app
     pueda redirigir al panel principal sin pedir credenciales de nuevo.

Accesible con JWT limitado → usuarios sin club pueden consultar y aceptar.

Endpoints:
  GET  /api/v1/invitations           → Lista invitaciones PENDING del usuario.
  POST /api/v1/invitations/{id}/accept → Acepta una invitación.
"""

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import create_access_token
from app.middleware.tenant import get_current_user_id
from app.models.club import Club
from app.models.club_staff import ClubStaff
from app.models.notification import Notification
from app.models.user import User

router = APIRouter()


# ── Schemas ───────────────────────────────────────────────────

class PendingInvitationOut(BaseModel):
    id: UUID          # ClubStaff.id — se usa para aceptar
    club_id: UUID
    club_name: str
    club_slug: str
    role: str
    primary_color: str
    logo_url: Optional[str] = None
    created_at: str


class AcceptInviteResponse(BaseModel):
    """
    Respuesta al aceptar una invitación.
    Incluye un nuevo JWT completo (con club_id) listo para usar:
    la app mobile debe reemplazar el token limitado con este.
    """
    access_token: str
    token_type: str = "bearer"
    club_id: str
    club_name: str
    club_slug: str
    user_role: str
    primary_color: str
    accent_color: str
    logo_url: Optional[str] = None


# ── GET / ─────────────────────────────────────────────────────

@router.get("/", response_model=list[PendingInvitationOut])
async def list_pending_invitations(
    user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> list[PendingInvitationOut]:
    """
    Lista todas las invitaciones PENDING del usuario autenticado.
    Accesible con JWT limitado.
    """
    # Buscar el email del usuario para hacer JOIN con ClubStaff (que usa email)
    user_result = await db.execute(select(User).where(User.id == user_id))
    user = user_result.scalar_one_or_none()

    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)

    result = await db.execute(
        select(ClubStaff, Club)
        .join(Club, Club.id == ClubStaff.club_id)
        .where(
            ClubStaff.email == user.email,
            ClubStaff.status == "PENDING",
        )
        .order_by(ClubStaff.created_at.desc())
    )
    rows = result.all()

    return [
        PendingInvitationOut(
            id=staff.id,
            club_id=club.id,
            club_name=club.name,
            club_slug=club.slug,
            role=staff.role,
            primary_color=club.primary_color,
            logo_url=club.logo_url,
            created_at=staff.created_at.isoformat(),
        )
        for staff, club in rows
    ]


# ── POST /{id}/accept ─────────────────────────────────────────

@router.post("/{staff_id}/accept", response_model=AcceptInviteResponse)
async def accept_invitation(
    staff_id: UUID,
    user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> AcceptInviteResponse:
    """
    Acepta una invitación pendiente.

    Acciones:
      1. Valida que el ClubStaff pertenezca al usuario autenticado y esté PENDING.
      2. Activa el registro (status ACTIVE, is_active True).
      3. Marca como leídas todas las notificaciones de invitación del usuario.
      4. Emite un nuevo JWT completo con club_id y role para que la app
         pueda navegar al panel sin pedir las credenciales de nuevo.
    """
    # Obtener usuario para verificar email cross-reference con ClubStaff
    user_result = await db.execute(select(User).where(User.id == user_id))
    user = user_result.scalar_one_or_none()

    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)

    # Buscar y validar el ClubStaff pendiente
    row_result = await db.execute(
        select(ClubStaff, Club)
        .join(Club, Club.id == ClubStaff.club_id)
        .where(
            ClubStaff.id == staff_id,
            ClubStaff.email == user.email,
            ClubStaff.status == "PENDING",
        )
    )
    row = row_result.one_or_none()

    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invitación no encontrada o ya procesada",
        )

    staff, club = row

    # 1. Activar el ClubStaff
    staff.status = "ACTIVE"
    staff.is_active = True

    # 2. Marcar notificaciones relacionadas como leídas
    notifs_result = await db.execute(
        select(Notification).where(
            Notification.user_id == user_id,
            Notification.is_read == False,
        )
    )
    for notif in notifs_result.scalars().all():
        notif.is_read = True

    await db.commit()

    # 3. Emitir nuevo JWT completo
    new_token = create_access_token(
        sub=str(user_id),
        email=user.email,
        club_id=club.id,
        role=staff.role,
    )

    return AcceptInviteResponse(
        access_token=new_token,
        club_id=str(club.id),
        club_name=club.name,
        club_slug=club.slug,
        user_role=staff.role,
        primary_color=club.primary_color,
        accent_color=club.accent_color,
        logo_url=club.logo_url,
    )
