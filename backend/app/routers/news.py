"""
ClubSystem — News Router
========================
Endpoints admin para gestión de novedades del club:
  GET    /api/v1/news        → Lista novedades del club activo con autor.
  POST   /api/v1/news        → Crea una novedad (OWNER o RESERVATIONS_MANAGER).
  DELETE /api/v1/news/{id}   → Elimina una novedad (OWNER o RESERVATIONS_MANAGER).
"""

from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.middleware.tenant import get_current_club_id, get_current_user_id, require_role
from app.models.club_news import ClubNews
from app.models.user import User

router = APIRouter()


# ── Schemas ───────────────────────────────────────────────────────────────────

class NewsCreate(BaseModel):
    title:      str
    body:       str
    tag:        str | None = None
    expires_at: datetime | None = None


class NewsOut(BaseModel):
    id:               UUID
    club_id:          UUID
    title:            str
    body:             str
    tag:              str | None
    expires_at:       datetime | None
    created_at:       datetime
    created_by_id:    UUID | None
    # Nombre completo del autor; None si el registro es anterior a este campo
    created_by_name:  str | None
    is_expired:       bool = False

    model_config = {"from_attributes": True}


# ── Helper ────────────────────────────────────────────────────────────────────

def _to_out(n: ClubNews, author: User | None) -> NewsOut:
    now     = datetime.now(timezone.utc)
    expired = n.expires_at is not None and n.expires_at <= now
    name    = f"{author.first_name} {author.last_name}".strip() if author else None
    return NewsOut(
        id=n.id,
        club_id=n.club_id,
        title=n.title,
        body=n.body,
        tag=n.tag,
        expires_at=n.expires_at,
        created_at=n.created_at,
        created_by_id=n.created_by_id,
        created_by_name=name,
        is_expired=expired,
    )


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/", response_model=list[NewsOut])
async def list_news(
    club_id: UUID = Depends(get_current_club_id),
    db: AsyncSession = Depends(get_db),
) -> list[NewsOut]:
    """
    Devuelve todas las novedades del club (vigentes y vencidas), con el nombre
    del autor. Ordenadas de más reciente a más antigua.
    """
    result = await db.execute(
        select(ClubNews, User)
        .outerjoin(User, User.id == ClubNews.created_by_id)
        .where(ClubNews.club_id == club_id)
        .order_by(ClubNews.created_at.desc())
    )
    return [_to_out(news, author) for news, author in result.all()]


@router.post("/", response_model=NewsOut, status_code=status.HTTP_201_CREATED)
async def create_news(
    body: NewsCreate,
    club_id:  UUID = Depends(get_current_club_id),
    user_id:  UUID = Depends(get_current_user_id),
    _roles: list   = Depends(require_role("OWNER", "RESERVATIONS_MANAGER")),
    db: AsyncSession = Depends(get_db),
) -> NewsOut:
    news = ClubNews(
        club_id=club_id,
        title=body.title,
        body=body.body,
        tag=body.tag,
        expires_at=body.expires_at,
        created_by_id=user_id,
    )
    db.add(news)
    await db.commit()
    await db.refresh(news)

    author = await db.get(User, user_id)
    return _to_out(news, author)


@router.delete("/{news_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_news(
    news_id: UUID,
    club_id: UUID  = Depends(get_current_club_id),
    _roles:  list  = Depends(require_role("OWNER", "RESERVATIONS_MANAGER")),
    db: AsyncSession = Depends(get_db),
) -> None:
    result = await db.execute(
        select(ClubNews).where(
            ClubNews.id == news_id,
            ClubNews.club_id == club_id,
        )
    )
    news = result.scalar_one_or_none()
    if not news:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Novedad no encontrada",
        )
    await db.delete(news)
    await db.commit()
