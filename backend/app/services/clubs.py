from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import BusinessRuleViolation
from app.core.sql import contains_pattern
from app.models import Club
from app.schemas.clubs import ClubUpdate


async def update_club(session: AsyncSession, club: Club, data: ClubUpdate) -> Club:
    changes = data.model_dump(exclude_unset=True, mode="json")
    if "name" in changes and changes["name"] is None:
        raise BusinessRuleViolation("El nombre del club es obligatorio.")
    if "timezone" in changes and changes["timezone"] is None:
        raise BusinessRuleViolation("La zona horaria es obligatoria.")
    for field in ("open_time", "close_time"):
        if field in changes:
            changes[field] = getattr(data, field)
    open_time = changes.get("open_time", club.open_time)
    close_time = changes.get("close_time", club.close_time)
    if open_time and close_time and open_time >= close_time:
        raise BusinessRuleViolation("El horario de apertura debe ser anterior al de cierre.")
    if "sport_types" in changes and changes["sport_types"] is not None:
        changes["sport_types"] = sorted(set(changes["sport_types"]))
    for field, value in changes.items():
        setattr(club, field, value)
    await session.flush()
    return club


async def active_clubs_directory(session: AsyncSession, search: str | None) -> list[Club]:
    stmt = select(Club).where(Club.is_active.is_(True)).order_by(Club.name).limit(100)
    if search:
        pattern = contains_pattern(search.strip())
        stmt = stmt.where(
            Club.name.ilike(pattern, escape="\\") | Club.city.ilike(pattern, escape="\\")
        )
    return list((await session.execute(stmt)).scalars())
