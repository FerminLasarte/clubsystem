# backend/app/routers/clubs.py
from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.club import Club

router = APIRouter()


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


@router.get("/", response_model=List[ClubOut])
async def list_clubs(db: AsyncSession = Depends(get_db)):
    """Lista todos los clubes activos. Usado por el selector de club en login."""
    result = await db.execute(
        select(Club).where(Club.is_active == True).order_by(Club.name)
    )
    return result.scalars().all()


@router.get("/{slug}", response_model=ClubOut)
async def get_club_by_slug(slug: str, db: AsyncSession = Depends(get_db)):
    """Obtiene un club por su slug. Usado para cargar el tema/branding."""
    result = await db.execute(select(Club).where(Club.slug == slug))
    club = result.scalar_one_or_none()
    if not club:
        raise HTTPException(status_code=404, detail="Club not found")
    return club
