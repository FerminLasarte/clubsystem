"""
ClubSync — Clubs Router
========================
Endpoints públicos (login/branding) + endpoints autenticados de configuración.

  GET  /api/v1/clubs/            → Lista todos los clubes activos (selector de login).
  GET  /api/v1/clubs/me          → Devuelve configuración del club activo del JWT.
  PUT  /api/v1/clubs/me          → Actualiza configuración del club activo (OWNER only).
  GET  /api/v1/clubs/{slug}      → Obtiene un club por slug (carga tema/branding).

NOTA: /me DEBE declararse antes de /{slug} para evitar que FastAPI lo capture como
      parámetro de ruta.
"""

import logging
from datetime import time
from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, field_serializer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.middleware.tenant import get_current_club_id, require_role
from app.models.club import Club

logger = logging.getLogger(__name__)

router = APIRouter()


# ── Schemas ───────────────────────────────────────────────────


class ClubOut(BaseModel):
    id: UUID
    slug: str
    name: str
    sport_types: list
    logo_url: str | None
    primary_color: str
    accent_color: str
    font_family: str
    city: str | None
    country: str
    plan: str
    is_active: bool

    class Config:
        from_attributes = True


class ClubSettingsOut(BaseModel):
    """
    Configuración completa del club para la pantalla de Ajustes.
    Los campos de tiempo (open_time, close_time) se serializan como "HH:MM".
    """
    id: UUID
    slug: str
    name: str
    phone: str | None = None
    address: str | None = None
    city: str | None = None
    country: str = "AR"
    open_time: time | None = None
    close_time: time | None = None
    cancellation_policy_hours: int = 24

    model_config = {"from_attributes": True}

    @field_serializer("open_time", "close_time")
    def _serialize_time(self, v: time | None) -> str | None:
        return v.strftime("%H:%M") if v else None


class ClubSettingsUpdate(BaseModel):
    """Campos actualizables por el OWNER en la pantalla de Ajustes."""
    name: str | None = None
    phone: str | None = None
    address: str | None = None
    city: str | None = None
    open_time: time | None = None
    close_time: time | None = None
    cancellation_policy_hours: int | None = None


# ── GET / ─────────────────────────────────────────────────────


@router.get("/", response_model=List[ClubOut])
async def list_clubs(db: AsyncSession = Depends(get_db)):
    """Lista todos los clubes activos. Usado por el selector de club en login."""
    result = await db.execute(
        select(Club).where(Club.is_active == True).order_by(Club.name)
    )
    return result.scalars().all()


# ── GET /me ───────────────────────────────────────────────────
# IMPORTANTE: declarado ANTES de /{slug} para que FastAPI no lo interprete
# como parámetro de ruta.


@router.get("/me", response_model=ClubSettingsOut)
async def get_club_settings(
    club_id: UUID = Depends(get_current_club_id),
    db: AsyncSession = Depends(get_db),
) -> ClubSettingsOut:
    """
    Devuelve la configuración completa del club activo del JWT.
    Accesible para cualquier miembro autenticado del club.
    """
    club = await db.get(Club, club_id)
    if not club:
        raise HTTPException(status_code=404, detail="Club no encontrado.")
    return ClubSettingsOut.model_validate(club)


# ── PUT /me ───────────────────────────────────────────────────


@router.put("/me", response_model=ClubSettingsOut)
async def update_club_settings(
    payload: ClubSettingsUpdate,
    club_id: UUID = Depends(get_current_club_id),
    _role: str = Depends(require_role("OWNER")),
    db: AsyncSession = Depends(get_db),
) -> ClubSettingsOut:
    """
    Actualiza la configuración operativa del club.
    Solo disponible para usuarios con rol OWNER.

    Actualizable: name, phone, address, city, open_time, close_time,
    cancellation_policy_hours.
    """
    club = await db.get(Club, club_id)
    if not club:
        raise HTTPException(status_code=404, detail="Club no encontrado.")

    update_data = payload.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(status_code=422, detail="No se enviaron campos para actualizar.")

    for field, value in update_data.items():
        setattr(club, field, value)

    try:
        await db.commit()
        await db.refresh(club)
    except Exception as exc:
        await db.rollback()
        logger.error("Error al actualizar club %s: %s", club_id, exc)
        raise HTTPException(status_code=500, detail="Error al guardar los cambios.")

    logger.info("Club %s actualizado por OWNER. Campos: %s", club_id, list(update_data.keys()))
    return ClubSettingsOut.model_validate(club)


# ── GET /{slug} ───────────────────────────────────────────────


@router.get("/{slug}", response_model=ClubOut)
async def get_club_by_slug(slug: str, db: AsyncSession = Depends(get_db)):
    """Obtiene un club por su slug. Usado para cargar el tema/branding."""
    result = await db.execute(select(Club).where(Club.slug == slug))
    club = result.scalar_one_or_none()
    if not club:
        raise HTTPException(status_code=404, detail="Club not found")
    return club
