"""App del socio: canchas, disponibilidad y reservas."""

from datetime import date
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Query, status

from app.api.deps import CurrentUser, Member, SessionDep
from app.domain.enums import Sport
from app.domain.slots import AppDuration
from app.schemas.common import Page
from app.schemas.courts import MemberCourtOut
from app.schemas.reservations import (
    AvailabilityOut,
    MemberReservationCreate,
    MyReservationOut,
    MyReservationsQuery,
)
from app.services.courts import member_courts
from app.services.reservations import (
    MemberBookingService,
    my_reservation,
    my_reservations,
)

router = APIRouter(prefix="/mobile", tags=["App: reservas"])


@router.get("/clubs/{club_id}/courts", response_model=list[MemberCourtOut])
async def list_courts(
    ctx: Member, session: SessionDep, sport: Sport | None = None
) -> list[MemberCourtOut]:
    return await member_courts(session, ctx, sport)


@router.get("/clubs/{club_id}/availability", response_model=AvailabilityOut)
async def availability(
    ctx: Member,
    session: SessionDep,
    day: Annotated[date, Query(alias="date")],
    sport: Sport | None = None,
    duration: AppDuration = AppDuration.MIN_60,
) -> AvailabilityOut:
    """Por cancha activa: inicios libres del día local del club y el precio final del socio."""
    return await MemberBookingService(session, ctx).availability(day, sport, duration)


@router.post(
    "/clubs/{club_id}/reservations",
    status_code=status.HTTP_201_CREATED,
    response_model=MyReservationOut,
)
async def create_reservation(
    body: MemberReservationCreate, ctx: Member, session: SessionDep
) -> MyReservationOut:
    """Queda pendiente hasta que la confirme el staff."""
    reservation_id = await MemberBookingService(session, ctx).create(body)
    return await my_reservation(session, ctx.user, reservation_id)


@router.get("/reservations", response_model=Page[MyReservationOut])
async def list_my_reservations(
    query: Annotated[MyReservationsQuery, Query()], user: CurrentUser, session: SessionDep
) -> Page[MyReservationOut]:
    """Reservas propias, de todos los clubes del usuario."""
    return await my_reservations(session, user, query)


@router.get("/reservations/{reservation_id}", response_model=MyReservationOut)
async def get_my_reservation(
    reservation_id: UUID, user: CurrentUser, session: SessionDep
) -> MyReservationOut:
    return await my_reservation(session, user, reservation_id)
