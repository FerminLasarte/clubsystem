from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, status

from app.api.deps import SessionDep, StaffContext, require
from app.domain.permissions import Permission
from app.schemas.courts import (
    CourtCreate,
    CourtDeactivate,
    CourtDeactivationOut,
    CourtOut,
    CourtUpcomingOut,
    CourtUpdate,
)
from app.services.courts import CourtService

router = APIRouter(prefix="/admin/courts", tags=["Admin: canchas"])

Reader = Annotated[StaffContext, Depends(require(Permission.COURTS_READ))]
Writer = Annotated[StaffContext, Depends(require(Permission.COURTS_WRITE))]
# Desactivar cancelando reservas también es gestionar reservas.
Deactivator = Annotated[
    StaffContext, Depends(require(Permission.COURTS_WRITE, Permission.RESERVATIONS_WRITE))
]


@router.get("", response_model=list[CourtOut])
async def list_courts(ctx: Reader, session: SessionDep) -> list[CourtOut]:
    """Todas las canchas del club (activas primero)."""
    return [CourtOut.model_validate(c) for c in await CourtService(session, ctx).list()]


@router.post("", status_code=status.HTTP_201_CREATED, response_model=CourtOut)
async def create_court(body: CourtCreate, ctx: Writer, session: SessionDep) -> CourtOut:
    return CourtOut.model_validate(await CourtService(session, ctx).create(body))


@router.patch("/{court_id}", response_model=CourtOut)
async def update_court(
    court_id: UUID, body: CourtUpdate, ctx: Writer, session: SessionDep
) -> CourtOut:
    """`is_active=false` desactiva la cancha (409 si tiene reservas próximas)."""
    return CourtOut.model_validate(await CourtService(session, ctx).update(court_id, body))


@router.get("/{court_id}/upcoming-reservations", response_model=CourtUpcomingOut)
async def upcoming_reservations(
    court_id: UUID, ctx: Writer, session: SessionDep
) -> CourtUpcomingOut:
    """Cuántas reservas habría que cancelar para desactivar la cancha."""
    count = await CourtService(session, ctx).upcoming_count(court_id)
    return CourtUpcomingOut(upcoming_reservations=count)


@router.post("/{court_id}/deactivate", response_model=CourtDeactivationOut)
async def deactivate_court(
    court_id: UUID, body: CourtDeactivate, ctx: Deactivator, session: SessionDep
) -> CourtDeactivationOut:
    """
    Cancela las reservas próximas (motivo BY_STAFF) y desactiva la cancha. 409
    `upcoming_reservations_changed` si la cantidad no es la que confirmó el usuario.
    """
    court, cancelled = await CourtService(session, ctx).deactivate(
        court_id, body.cancel_upcoming_reservations
    )
    return CourtDeactivationOut(
        court=CourtOut.model_validate(court), cancelled_reservations=cancelled
    )


@router.delete("/{court_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_court(court_id: UUID, ctx: Writer, session: SessionDep) -> None:
    """Borra una cancha sin reservas. Con historial: 409 (se desactiva con PATCH)."""
    await CourtService(session, ctx).delete(court_id)
