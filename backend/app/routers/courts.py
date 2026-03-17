from uuid import UUID
from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.middleware.tenant import get_current_club_id
from app.models.court import Court

router = APIRouter()


class CourtOut(BaseModel):
    id: UUID
    name: str
    sport: str
    surface: Optional[str]
    is_indoor: bool
    is_active: bool
    capacity: int
    hourly_rate: float

    class Config:
        from_attributes = True


@router.get("/", response_model=list[CourtOut])
async def list_courts(
    club_id: UUID = Depends(get_current_club_id),
    db: AsyncSession = Depends(get_db),
):
    q = (
        select(Court)
        .where(Court.club_id == club_id, Court.is_active == True)
        .order_by(Court.name)
    )
    result = await db.execute(q)
    return result.scalars().all()
