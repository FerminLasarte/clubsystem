"""Canchas: ABM del panel y listado para los socios."""

from typing import Any
from uuid import UUID

from sqlalchemy import exists, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import BusinessRuleViolation, Conflict
from app.core.time import utcnow
from app.domain.enums import CustomerType, Sport
from app.domain.pricing import hourly_rate
from app.models import ACTIVE_RESERVATION_STATUSES, Court, Reservation
from app.repositories.base import get_scoped
from app.schemas.courts import CourtCreate, CourtUpdate, MemberCourtOut
from app.services.context import MemberContext, StaffContext

_REQUIRED = ("name", "sport", "is_indoor", "is_active", "capacity", "price_member", "price_guest")


def _plain(changes: dict[str, Any]) -> dict[str, Any]:
    if changes.get("image_url") is not None:
        changes["image_url"] = str(changes["image_url"])
    return changes


class CourtService:
    def __init__(self, session: AsyncSession, ctx: StaffContext) -> None:
        self.db = session
        self.ctx = ctx

    async def list(self) -> list[Court]:
        stmt = (
            select(Court)
            .where(Court.club_id == self.ctx.club_id)
            .order_by(Court.is_active.desc(), Court.name)
        )
        return list((await self.db.execute(stmt)).scalars())

    async def create(self, data: CourtCreate) -> Court:
        court = Court(club_id=self.ctx.club_id, **_plain(data.model_dump()))
        self.db.add(court)
        await self.db.flush()  # nombre duplicado → 409
        await self.db.refresh(court)
        return court

    async def update(self, court_id: UUID, data: CourtUpdate) -> Court:
        court = await self._get(court_id, for_update=True)
        changes = _plain(data.model_dump(exclude_unset=True))
        missing = [f for f in _REQUIRED if f in changes and changes[f] is None]
        if missing:
            raise BusinessRuleViolation(f"Campos obligatorios: {', '.join(missing)}.")
        if changes.get("is_active") is False and court.is_active:
            await self._ensure_no_upcoming(court)
        for field, value in changes.items():
            setattr(court, field, value)
        await self.db.flush()
        await self.db.refresh(court)
        return court

    async def delete(self, court_id: UUID) -> None:
        """Solo se borra una cancha sin reservas; si tiene historial, se desactiva."""
        court = await self._get(court_id, for_update=True)
        has_reservations = (
            await self.db.execute(select(exists().where(Reservation.court_id == court.id)))
        ).scalar_one()
        if has_reservations:
            raise Conflict(
                "La cancha tiene reservas: desactivala en lugar de borrarla.",
                code="court_has_reservations",
            )
        await self.db.delete(court)
        await self.db.flush()

    async def _get(self, court_id: UUID, *, for_update: bool = False) -> Court:
        return await get_scoped(
            self.db,
            Court,
            court_id,
            self.ctx.club_id,
            not_found="Cancha no encontrada.",
            for_update=for_update,
        )

    async def _ensure_no_upcoming(self, court: Court) -> None:
        upcoming = (
            await self.db.execute(
                select(
                    exists().where(
                        Reservation.court_id == court.id,
                        Reservation.status.in_(ACTIVE_RESERVATION_STATUSES),
                        Reservation.ends_at > utcnow(),
                    )
                )
            )
        ).scalar_one()
        if upcoming:
            raise Conflict(
                "La cancha tiene reservas próximas. Cancelalas o reprogramalas antes de"
                " desactivarla.",
                code="court_has_upcoming_reservations",
            )


async def member_courts(
    session: AsyncSession, ctx: MemberContext, sport: Sport | None
) -> list[MemberCourtOut]:
    stmt = (
        select(Court)
        .where(Court.club_id == ctx.club.id, Court.is_active.is_(True))
        .order_by(Court.sport, Court.name)
    )
    if sport is not None:
        stmt = stmt.where(Court.sport == sport)
    return [
        MemberCourtOut(
            id=court.id,
            name=court.name,
            sport=court.sport,
            surface=court.surface,
            is_indoor=court.is_indoor,
            capacity=court.capacity,
            description=court.description,
            image_url=court.image_url,
            price_per_hour=hourly_rate(court.price_member, court.price_guest, CustomerType.MEMBER),
        )
        for court in (await session.execute(stmt)).scalars()
    ]
