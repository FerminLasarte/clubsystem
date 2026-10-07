from datetime import date
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from fastapi.responses import Response

from app.api.deps import SessionDep, StaffContext, require
from app.domain.permissions import Permission
from app.schemas.common import ExportRange, Page
from app.schemas.reservations import (
    ReservationCreate,
    ReservationFilters,
    ReservationGridOut,
    ReservationOut,
    ReservationQuoteOut,
    ReservationQuoteQuery,
    ReservationUpdate,
)
from app.services.reservations import ReservationService

router = APIRouter(prefix="/admin/reservations", tags=["Admin: reservas"])

Reader = Annotated[StaffContext, Depends(require(Permission.RESERVATIONS_READ))]
Writer = Annotated[StaffContext, Depends(require(Permission.RESERVATIONS_WRITE))]


@router.get("", response_model=Page[ReservationOut])
async def list_reservations(
    filters: Annotated[ReservationFilters, Query()], ctx: Reader, session: SessionDep
) -> Page[ReservationOut]:
    """Reservas de un día (`date`) o de un rango (`from`/`to`), en días locales del club."""
    return await ReservationService(session, ctx).list(filters)


@router.get("/grid", response_model=ReservationGridOut)
async def reservation_grid(
    ctx: Reader, session: SessionDep, day: Annotated[date, Query(alias="date")]
) -> ReservationGridOut:
    """Canchas activas con las reservas no canceladas del día, para la grilla."""
    return await ReservationService(session, ctx).grid(day)


@router.get(
    "/export",
    response_class=Response,
    responses={200: {"content": {"text/csv": {}}}},
)
async def export_reservations(
    period: Annotated[ExportRange, Query()], ctx: Reader, session: SessionDep
) -> Response:
    return await ReservationService(session, ctx).export(period)


@router.get("/quote", response_model=ReservationQuoteOut)
async def quote_reservation(
    query: Annotated[ReservationQuoteQuery, Query()], ctx: Writer, session: SessionDep
) -> ReservationQuoteOut:
    """Precio final con la tarifa de la cancha, para mostrarlo antes de crear la reserva."""
    return await ReservationService(session, ctx).quote(query)


@router.get("/{reservation_id}", response_model=ReservationOut)
async def get_reservation(reservation_id: UUID, ctx: Reader, session: SessionDep) -> ReservationOut:
    return await ReservationService(session, ctx).get(reservation_id)


@router.post("", status_code=status.HTTP_201_CREATED, response_model=ReservationOut)
async def create_reservation(
    body: ReservationCreate, ctx: Writer, session: SessionDep
) -> ReservationOut:
    service = ReservationService(session, ctx)
    return await service.get(await service.create(body))


@router.patch("/{reservation_id}", response_model=ReservationOut)
async def update_reservation(
    reservation_id: UUID, body: ReservationUpdate, ctx: Writer, session: SessionDep
) -> ReservationOut:
    service = ReservationService(session, ctx)
    await service.update(reservation_id, body)
    return await service.get(reservation_id)


@router.post("/{reservation_id}/confirm", response_model=ReservationOut)
async def confirm_reservation(
    reservation_id: UUID, ctx: Writer, session: SessionDep
) -> ReservationOut:
    service = ReservationService(session, ctx)
    await service.confirm(reservation_id)
    return await service.get(reservation_id)


@router.post("/{reservation_id}/cancel", response_model=ReservationOut)
async def cancel_reservation(
    reservation_id: UUID, ctx: Writer, session: SessionDep
) -> ReservationOut:
    service = ReservationService(session, ctx)
    await service.cancel(reservation_id)
    return await service.get(reservation_id)
