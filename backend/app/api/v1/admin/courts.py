from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, status

from app.api.deps import SessionDep, StaffContext, require
from app.domain.permissions import Permission
from app.schemas.courts import CourtCreate, CourtOut, CourtUpdate
from app.services.courts import CourtService

router = APIRouter(prefix="/admin/courts", tags=["Admin: canchas"])

Reader = Annotated[StaffContext, Depends(require(Permission.COURTS_READ))]
Writer = Annotated[StaffContext, Depends(require(Permission.COURTS_WRITE))]


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


@router.delete("/{court_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_court(court_id: UUID, ctx: Writer, session: SessionDep) -> None:
    """Borra una cancha sin reservas. Con historial: 409 (se desactiva con PATCH)."""
    await CourtService(session, ctx).delete(court_id)
