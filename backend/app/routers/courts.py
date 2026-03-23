"""
ClubSystem — Courts Router
========================
CRUD de infraestructura física (canchas) del club.

Permisos:
  - GET  /         → cualquier rol autenticado con club_id válido
  - POST / PUT / DELETE → solo OWNER (requiere require_role("OWNER"))

Soft-delete:
  DELETE setea is_active=False para no romper el historial de reservas vinculadas.
"""

import logging
from datetime import datetime
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.middleware.tenant import get_current_club_id, require_role
from app.models.court import Court

router = APIRouter()
logger = logging.getLogger(__name__)


# ── Schemas ────────────────────────────────────────────────────────────────

class CourtCreate(BaseModel):
    name:        str           = Field(..., min_length=1, max_length=100)
    sport:       str           = Field(..., max_length=50)
    surface:     Optional[str] = Field(None, max_length=50)
    is_indoor:   bool          = False
    capacity:    int           = Field(default=2, ge=1)
    hourly_rate: float         = Field(..., ge=0)
    description: Optional[str] = None
    image_url:   Optional[str] = None


class CourtUpdate(BaseModel):
    name:        Optional[str]   = Field(None, min_length=1, max_length=100)
    sport:       Optional[str]   = Field(None, max_length=50)
    surface:     Optional[str]   = Field(None, max_length=50)
    is_indoor:   Optional[bool]  = None
    capacity:    Optional[int]   = Field(None, ge=1)
    hourly_rate: Optional[float] = Field(None, ge=0)
    description: Optional[str]  = None
    image_url:   Optional[str]  = None


class CourtOut(BaseModel):
    id:          UUID
    club_id:     UUID
    name:        str
    sport:       str
    surface:     Optional[str]
    is_indoor:   bool
    is_active:   bool
    capacity:    int
    hourly_rate: float
    description: Optional[str]
    image_url:   Optional[str]
    created_at:  datetime
    updated_at:  datetime

    model_config = {"from_attributes": True}


# ── GET / — lista canchas activas ──────────────────────────────────────────

@router.get("/", response_model=list[CourtOut])
async def list_courts(
    club_id: UUID         = Depends(get_current_club_id),
    db:      AsyncSession = Depends(get_db),
):
    logger.info("list_courts | club_id=%s", club_id)
    result = await db.execute(
        select(Court)
        .where(Court.club_id == club_id, Court.is_active == True)  # noqa: E712
        .order_by(Court.name)
    )
    return result.scalars().all()


# ── POST / — crear cancha ──────────────────────────────────────────────────

@router.post("/", response_model=CourtOut, status_code=status.HTTP_201_CREATED)
async def create_court(
    payload: CourtCreate,
    club_id: UUID         = Depends(get_current_club_id),
    _:       list         = Depends(require_role("OWNER")),
    db:      AsyncSession = Depends(get_db),
):
    logger.info("create_court | club_id=%s name=%s", club_id, payload.name)
    court = Court(club_id=club_id, **payload.model_dump())
    try:
        db.add(court)
        await db.commit()
        await db.refresh(court)
        logger.info("create_court | ok id=%s", court.id)
        return court
    except Exception as exc:
        await db.rollback()
        logger.error("create_court | error: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al crear la cancha",
        )


# ── PUT /{court_id} — actualizar cancha ────────────────────────────────────

@router.put("/{court_id}", response_model=CourtOut)
async def update_court(
    court_id: UUID,
    payload:  CourtUpdate,
    club_id:  UUID         = Depends(get_current_club_id),
    _:        list         = Depends(require_role("OWNER")),
    db:       AsyncSession = Depends(get_db),
):
    logger.info("update_court | club_id=%s court_id=%s", club_id, court_id)
    court = await db.get(Court, court_id)
    if not court or court.club_id != club_id or not court.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cancha no encontrada")

    try:
        for field, value in payload.model_dump(exclude_unset=True).items():
            setattr(court, field, value)
        court.updated_at = datetime.utcnow()
        await db.commit()
        await db.refresh(court)
        logger.info("update_court | ok id=%s", court.id)
        return court
    except Exception as exc:
        await db.rollback()
        logger.error("update_court | error: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al actualizar la cancha",
        )


# ── DELETE /{court_id} — soft delete ──────────────────────────────────────

@router.delete("/{court_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_court(
    court_id: UUID,
    club_id:  UUID         = Depends(get_current_club_id),
    _:        list         = Depends(require_role("OWNER")),
    db:       AsyncSession = Depends(get_db),
):
    logger.info("delete_court | club_id=%s court_id=%s", club_id, court_id)
    court = await db.get(Court, court_id)
    if not court or court.club_id != club_id or not court.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cancha no encontrada")

    try:
        court.is_active  = False
        court.updated_at = datetime.utcnow()
        await db.commit()
        logger.info("delete_court | soft-deleted id=%s", court.id)
    except Exception as exc:
        await db.rollback()
        logger.error("delete_court | error: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al eliminar la cancha",
        )
