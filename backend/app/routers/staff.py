"""
ClubSync — Staff Router
========================
Gestión del equipo (staff) de un club.

Endpoints:
  GET  /api/v1/clubs/{club_id}/staff              → Lista miembros del equipo.
  POST /api/v1/clubs/{club_id}/staff/invite        → Invita a un usuario registrado.
  PUT  /api/v1/clubs/{club_id}/staff/{staff_id}    → Actualiza los roles de un miembro.

RBAC obligatorio:
  - GET:  OWNER o RESERVATIONS_MANAGER pueden ver el equipo.
  - POST: Solo OWNER puede invitar.
  - PUT:  Solo OWNER puede modificar roles.

Flujo de invitación:
  1. Verifica que el usuario exista por email → 404 si no está registrado.
  2. Verifica que no sea ya parte del staff de ese club → 409 si ya existe.
  3. Crea ClubStaff con roles=[...], status=PENDING, is_active=False.
  4. Crea Notification in-app para el usuario invitado.
  5. Simula envío de email con logger.info().

Roles invitables: RESERVATIONS_MANAGER, STOCK_MANAGER.
(OWNER requiere asignación directa en DB — no se puede asignar vía invite.)
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


class StaffUpdateRequest(BaseModel):
    """Payload para actualizar roles de un miembro existente."""
    roles: list[str]


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
    _role: str = Depends(require_role("OWNER", "RESERVATIONS_MANAGER")),
    db: AsyncSession = Depends(get_db),
) -> list[StaffMemberOut]:
    """
    Devuelve todos los miembros del equipo (PENDING + ACTIVE).
    Protegido: requiere rol OWNER o RESERVATIONS_MANAGER.
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
    _role: str = Depends(require_role("OWNER")),
    db: AsyncSession = Depends(get_db),
) -> StaffMemberOut:
    """
    Invita a un usuario existente en ClubSync al equipo del club.

    Reglas:
      - El usuario debe estar registrado (email en tabla users).
      - No puede ser ya parte del staff de este club.
      - Los roles enviados deben ser subconjunto de INVITABLE_ROLES.
        (OWNER no puede asignarse vía invitación).
    """
    if club_id != current_club_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tenés acceso a ese club",
        )

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


# ── PUT /{club_id}/staff/{staff_id} ──────────────────────────


@router.put("/{club_id}/staff/{staff_id}", response_model=StaffMemberOut)
async def update_staff_roles(
    club_id: UUID,
    staff_id: UUID,
    payload: StaffUpdateRequest,
    current_club_id: UUID = Depends(get_current_club_id),
    _role: str = Depends(require_role("OWNER")),
    db: AsyncSession = Depends(get_db),
) -> StaffMemberOut:
    """
    Actualiza el array de roles de un miembro del equipo.
    Solo el OWNER puede ejecutar esta acción.

    Reglas:
      - Al menos un rol debe enviarse.
      - Los roles deben ser un subconjunto de INVITABLE_ROLES
        (el rol OWNER no puede asignarse vía este endpoint).
      - No se puede modificar los roles del propio OWNER a través de este endpoint
        (previene auto-degradación accidental).
    """
    if club_id != current_club_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tenés acceso a ese club",
        )

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
                f"Roles modificables: {sorted(INVITABLE_ROLES)}"
            ),
        )

    # Cargar el registro de staff y validar que pertenece al club
    staff_result = await db.execute(
        select(ClubStaff, User)
        .outerjoin(User, User.id == ClubStaff.user_id)
        .where(ClubStaff.id == staff_id, ClubStaff.club_id == club_id)
    )
    row = staff_result.one_or_none()
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Miembro del equipo no encontrado",
        )

    staff, user = row

    # Proteger al OWNER de auto-degradación accidental
    if "OWNER" in staff.roles:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No se pueden modificar los roles del OWNER desde este endpoint.",
        )

    staff.roles = list(payload.roles)

    try:
        await db.commit()
        await db.refresh(staff)
    except Exception as exc:
        await db.rollback()
        logger.error("Error al actualizar roles de staff %s: %s", staff_id, exc)
        raise HTTPException(status_code=500, detail="Error al guardar los cambios.")

    logger.info(
        "Roles de %s en club %s actualizados a: %s",
        staff.email, club_id, payload.roles,
    )

    return StaffMemberOut(
        id=staff.id,
        email=staff.email,
        roles=staff.roles,
        status=staff.status,
        is_active=staff.is_active,
        user_first_name=user.first_name if user else None,
        user_last_name=user.last_name  if user else None,
        created_at=staff.created_at.isoformat(),
    )
