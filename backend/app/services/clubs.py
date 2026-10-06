from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import BusinessRuleViolation
from app.core.sql import contains_pattern
from app.domain.enums import StaffRole
from app.models import Club
from app.schemas.clubs import ClubCreate, ClubUpdate
from app.services.staff import issue_invitation


async def create_club_with_owner(session: AsyncSession, data: ClubCreate) -> tuple[Club, bool]:
    """
    Da de alta un club e invita a su dueño por email; al aceptar, elige su contraseña.
    Lo usa un operador con el rol dueño de la base (scripts/create_club.py): el panel no crea
    clubes. Si el slug ya existe, solo renueva la invitación (por ejemplo, si venció).
    Devuelve el club y si se creó ahora.
    """
    club = (await session.execute(select(Club).where(Club.slug == data.slug))).scalar_one_or_none()
    created = club is None
    if club is None:
        club = Club(
            slug=data.slug,
            name=data.name,
            sport_types=sorted({s.value for s in data.sport_types}),
            city=data.city,
        )
        if data.timezone:
            club.timezone = data.timezone
        session.add(club)
        await session.flush()
    await issue_invitation(
        session, club, str(data.owner_email), [StaffRole.OWNER.value], invited_by=None
    )
    return club, created


async def update_club(session: AsyncSession, club: Club, data: ClubUpdate) -> Club:
    changes = data.model_dump(exclude_unset=True, mode="json")
    if "name" in changes and changes["name"] is None:
        raise BusinessRuleViolation("El nombre del club es obligatorio.")
    if "timezone" in changes and changes["timezone"] is None:
        raise BusinessRuleViolation("La zona horaria es obligatoria.")
    if "member_cancel_notice_hours" in changes and changes["member_cancel_notice_hours"] is None:
        raise BusinessRuleViolation("El plazo de cancelación es obligatorio.")
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
