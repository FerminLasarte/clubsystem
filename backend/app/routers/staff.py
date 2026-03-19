"""
ClubSync — Staff Router
========================
Gestión del equipo (staff) de un club.

Endpoints:
  GET  /api/v1/clubs/{club_id}/staff          → Lista todos los miembros del equipo.
  POST /api/v1/clubs/{club_id}/staff/invite   → Invita a un usuario registrado.

Flujo de invitación:
  1. Verifica que el usuario exista por email → 404 si no está registrado.
  2. Verifica que no sea ya parte del staff de ese club → 409 si ya existe.
  3. Crea ClubStaff con roles=[...], status=PENDING, is_active=False.
  4. Crea Notification in-app para el usuario invitado.
  5. Simula envío de email con logger.info().

RBAC de roles (array):
  - Un operador puede recibir múltiples roles en la misma invitación.
  - Solo un OWNER puede invitar; los roles OWNER no se pueden asignar vía invite.
  - Roles invitables: RESERVATIONS_MANAGER, STOCK_MANAGER.

Seguridad:
  - JWT válido requerido (get_current_club_id).
  - club_id del path se valida contra club_id del JWT.
  - Invitar requiere rol OWNER (require_role).
"""

import logging
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.middleware.tenant import get_current_club_id, require_role
from app.models.club import Club
from app.models.club_staff import ClubStaff
from app.models.notification import Notification
from app.models.user import User

logger = logging.getLogger(__name__)

router = APIRouter()

# Roles que un OWNER puede asignar vía invitación (OWNER requiere acceso directo a DB)
INVITABLE_ROLES = frozenset({"RESERVATIONS_MANAGER", "STOCK_MANAGER"})


# ── Schemas ───────────────────────────────────────────────────

class InviteRequest(BaseModel):
    email: EmailStr
    roles: list[str]   # ["RESERVATIONS_MANAGER"] o ["RESERVATIONS_MANAGER", "STOCK_MANAGER"]


class StaffMemberOut(BaseModel):
    id:              UUID
    email:           str
    roles:           list[str]
    status:          str
    is_active:       bool
    user_first_name: Optional[str] = None
    user_last_name:  Optional[str] = None
    created_at:      str

    class Config:
        from_attributes = True


# ── GET /{club_id}/staff ──────────────────────────────────────

@router.get("/{club_id}/staff", response_model=list[StaffMemberOut])
async def list_staff(
    club_id: UUID,
    current_club_id: UUID = Depends(get_current_club_id),
    db: AsyncSession = Depends(get_db),
) -> list[StaffMemberOut]:
    """
    Devuelve todos los miembros del equipo (PENDING + ACTIVE).
    El club_id del path se valida contra el JWT para aislamiento multi-tenant.
    """
    if club_id != current_club_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tenés acceso a ese club",
        )

    result = await db.execute(
        select(ClubStaff, User)
        .outerjoin(User, User.id == ClubStaff.user_id)
        .where(ClubStaff.club_id == club_id)
        .order_by(ClubStaff.created_at)
    )
    rows = result.all()

    return [
        StaffMemberOut(
            id=staff.id,
            email=staff.email,
            roles=staff.roles,
            status=staff.status,
            is_active=staff.is_active,
            user_first_name=user.first_name if user else None,
            user_last_name=user.last_name  if user else None,
            created_at=staff.created_at.isoformat(),
        )
        for staff, user in rows
    ]


# ── POST /{club_id}/staff/invite ──────────────────────────────

@router.post(
    "/{club_id}/staff/invite",
    response_model=StaffMemberOut,
    status_code=status.HTTP_201_CREATED,
)
async def invite_staff(
    club_id: UUID,
    payload: InviteRequest,
    current_club_id: UUID = Depends(get_current_club_id),
    _roles: list = Depends(require_role("OWNER")),
    db: AsyncSession = Depends(get_db),
) -> StaffMemberOut:
    """
    Invita a un usuario existente en ClubSync al equipo del club.

    Reglas:
      - El usuario debe estar registrado (email en tabla users).
      - No puede ser ya parte del staff de este club.
      - Los roles enviados deben ser un subconjunto de INVITABLE_ROLES.
        (OWNER no puede ser asignado vía invitación).
    """
    if club_id != current_club_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tenés acceso a ese club",
        )

    # Validar que la lista de roles no esté vacía y sea válida
    if not payload.roles:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Debés especificar al menos un rol",
        )

    invalid_roles = set(payload.roles) - INVITABLE_ROLES
    if invalid_roles:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                f"Roles inválidos: {sorted(invalid_roles)}. "
                f"Roles permitidos vía invitación: {sorted(INVITABLE_ROLES)}"
            ),
        )

    # 1. Verificar que el usuario existe en ClubSync
    user_result = await db.execute(
        select(User).where(User.email == payload.email).limit(1)
    )
    user = user_result.scalar_one_or_none()

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="El usuario no está registrado en ClubSync",
        )

    # 2. Verificar que no sea ya parte del staff de este club
    existing_result = await db.execute(
        select(ClubStaff).where(
            ClubStaff.email == payload.email,
            ClubStaff.club_id == club_id,
        )
    )
    if existing_result.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="El usuario ya forma parte del equipo de este club",
        )

    # Obtener nombre del club para la notificación
    club_result = await db.execute(select(Club).where(Club.id == club_id))
    club = club_result.scalar_one_or_none()
    club_name = club.name if club else "el club"

    roles_label = " y ".join(
        {"RESERVATIONS_MANAGER": "Gestor de Reservas", "STOCK_MANAGER": "Gestor de Stock"}.get(r, r)
        for r in payload.roles
    )

    # 3. Crear ClubStaff con status PENDING
    new_staff = ClubStaff(
        email=payload.email,
        club_id=club_id,
        roles=list(payload.roles),
        user_id=user.id,
        status="PENDING",
        is_active=False,
    )
    db.add(new_staff)

    # 4. Notificación in-app
    notification = Notification(
        user_id=user.id,
        title="Invitación al equipo",
        message=(
            f"Has sido invitado como {roles_label} en {club_name}. "
            "Aceptá la invitación desde la app para acceder al panel de administración."
        ),
    )
    db.add(notification)

    await db.commit()
    await db.refresh(new_staff)

    # 5. Simular envío de email
    logger.info(
        "📧 Simulando envío de email a %s — Invitación como [%s] en '%s'. "
        "Link de aceptación: https://app.clubsync.io/accept-invite?id=%s",
        payload.email,
        ", ".join(payload.roles),
        club_name,
        new_staff.id,
    )

    return StaffMemberOut(
        id=new_staff.id,
        email=new_staff.email,
        roles=new_staff.roles,
        status=new_staff.status,
        is_active=new_staff.is_active,
        user_first_name=user.first_name,
        user_last_name=user.last_name,
        created_at=new_staff.created_at.isoformat(),
    )
