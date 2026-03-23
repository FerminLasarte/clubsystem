"""
ClubSystem — Memberships Router
================================
Gestión de membresías de socios/visitantes en clubs.

Rutas (montadas en /api/v1/clubs):
  POST /{club_id}/request-membership
      → Cualquier usuario autenticado (mobile o staff).
        Crea un registro ClubMembership con status=PENDING.
        Si se provee DNI, actualiza el perfil del usuario.
        Idempotente: si ya existe una membresía, devuelve la existente.

  GET  /{club_id}/memberships
      → Solo OWNER. Lista todas las membresías del club con paginación.

  PATCH /{club_id}/memberships/{membership_id}
      → Solo OWNER. Cambia el status (APPROVED / REJECTED) y asigna plan.

Lógica de precios diferenciales:
  - APPROVED → price_member de la cancha (o hourly_rate si es NULL)
  - Otros    → price_guest  de la cancha (o hourly_rate si es NULL)
"""

import logging
from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.middleware.tenant import get_current_user_id, require_role, get_current_club_id
from app.models.club import Club
from app.models.club_membership import ClubMembership
from app.models.user import User

router = APIRouter()
logger = logging.getLogger(__name__)


# ── Schemas ────────────────────────────────────────────────────────────────

class MembershipRequestIn(BaseModel):
    """
    Payload para solicitar membresía en un club.
    `dni` es opcional: si se provee, actualiza el perfil del usuario autenticado.
    """
    dni: Optional[str] = Field(None, max_length=20, description="Número de documento (actualiza perfil)")


class MembershipOut(BaseModel):
    id:                 UUID
    user_id:            UUID
    club_id:            UUID
    status:             str
    membership_plan_id: Optional[str]
    request_date:       datetime
    approved_at:        Optional[datetime]
    rejected_at:        Optional[datetime]

    model_config = {"from_attributes": True}


class MembershipPatch(BaseModel):
    """
    Payload para que el admin cambie el estado de una membresía.
    """
    status:             str             = Field(..., pattern="^(APPROVED|REJECTED|PENDING)$")
    membership_plan_id: Optional[str]  = Field(None, max_length=100)


# ── POST /{club_id}/request-membership ────────────────────────────────────

@router.post(
    "/{club_id}/request-membership",
    response_model=MembershipOut,
    status_code=status.HTTP_201_CREATED,
    summary="Solicitar membresía en un club",
    tags=["Memberships"],
)
async def request_membership(
    club_id:  UUID,
    body:     MembershipRequestIn,
    user_id:  UUID         = Depends(get_current_user_id),
    db:       AsyncSession = Depends(get_db),
) -> MembershipOut:
    """
    Crea una solicitud de membresía con status=PENDING.

    Flujo:
      1. Verifica que el club exista y esté activo.
      2. Si se envía DNI, actualiza users.dni del solicitante.
      3. Si ya existe una membresía (cualquier status), la devuelve sin crear duplicado.
      4. Crea ClubMembership(status=PENDING) y retorna el registro.
    """
    # 1. Verificar que el club exista y esté activo
    club = await db.get(Club, club_id)
    if not club or not club.is_active:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Club no encontrado o inactivo",
        )

    # 2. Actualizar DNI en el perfil si se proveyó
    if body.dni:
        user = await db.get(User, user_id)
        if user and user.dni != body.dni:
            user.dni = body.dni.strip()
            logger.info("request_membership | DNI actualizado user_id=%s", user_id)

    # 3. Idempotencia: si ya existe membresía, devolverla
    existing_result = await db.execute(
        select(ClubMembership).where(
            ClubMembership.user_id == user_id,
            ClubMembership.club_id == club_id,
        )
    )
    existing = existing_result.scalar_one_or_none()
    if existing:
        logger.info(
            "request_membership | membresía ya existe id=%s status=%s",
            existing.id, existing.status,
        )
        # Si fue rechazada, permitir re-solicitud reseteando a PENDING
        if existing.status == "REJECTED":
            existing.status      = "PENDING"
            existing.rejected_at = None
            existing.request_date = datetime.now(timezone.utc)
            await db.commit()
            await db.refresh(existing)
        return existing  # type: ignore[return-value]

    # 4. Crear nueva membresía con status=PENDING
    membership = ClubMembership(
        user_id      = user_id,
        club_id      = club_id,
        status       = "PENDING",
        request_date = datetime.now(timezone.utc),
    )

    try:
        db.add(membership)
        await db.commit()
        await db.refresh(membership)
        logger.info(
            "request_membership | creada id=%s user_id=%s club_id=%s",
            membership.id, user_id, club_id,
        )
        return membership  # type: ignore[return-value]
    except Exception as exc:
        await db.rollback()
        logger.error("request_membership | error: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al crear la solicitud de membresía",
        )


# ── GET /{club_id}/memberships — listar (admin) ────────────────────────────

@router.get(
    "/{club_id}/memberships",
    response_model=list[MembershipOut],
    summary="Listar membresías del club (admin)",
    tags=["Memberships"],
)
async def list_memberships(
    club_id:        UUID,
    status_filter:  Optional[str] = None,
    limit:          int           = 50,
    offset:         int           = 0,
    _roles:         list          = Depends(require_role("OWNER", "RESERVATIONS_MANAGER")),
    _club_id_check: UUID          = Depends(get_current_club_id),
    db:             AsyncSession  = Depends(get_db),
) -> list[MembershipOut]:
    """
    Lista las membresías del club. Solo accesible para OWNER o RESERVATIONS_MANAGER.

    Filtros opcionales:
      - status_filter: PENDING | APPROVED | REJECTED
    """
    stmt = (
        select(ClubMembership)
        .where(ClubMembership.club_id == club_id)
        .order_by(ClubMembership.request_date.desc())
        .limit(limit)
        .offset(offset)
    )
    if status_filter:
        stmt = stmt.where(ClubMembership.status == status_filter.upper())

    result = await db.execute(stmt)
    return result.scalars().all()  # type: ignore[return-value]


# ── PATCH /{club_id}/memberships/{membership_id} — aprobar/rechazar ────────

@router.patch(
    "/{club_id}/memberships/{membership_id}",
    response_model=MembershipOut,
    summary="Aprobar o rechazar una membresía (admin)",
    tags=["Memberships"],
)
async def update_membership_status(
    club_id:       UUID,
    membership_id: UUID,
    body:          MembershipPatch,
    _roles:        list         = Depends(require_role("OWNER")),
    _club_id_check: UUID        = Depends(get_current_club_id),
    db:            AsyncSession = Depends(get_db),
) -> MembershipOut:
    """
    Cambia el status de una membresía y opcionalmente asigna un plan.

    - APPROVED → registra approved_at con timestamp actual.
    - REJECTED → registra rejected_at con timestamp actual.
    """
    membership = await db.get(ClubMembership, membership_id)
    if not membership or membership.club_id != club_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Membresía no encontrada",
        )

    now = datetime.now(timezone.utc)
    membership.status = body.status

    if body.status == "APPROVED":
        membership.approved_at = now
        membership.rejected_at = None
    elif body.status == "REJECTED":
        membership.rejected_at = now
        membership.approved_at = None

    if body.membership_plan_id is not None:
        membership.membership_plan_id = body.membership_plan_id

    try:
        await db.commit()
        await db.refresh(membership)
        logger.info(
            "update_membership_status | id=%s → %s", membership_id, body.status
        )
        return membership  # type: ignore[return-value]
    except Exception as exc:
        await db.rollback()
        logger.error("update_membership_status | error: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al actualizar la membresía",
        )
