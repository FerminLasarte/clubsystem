from typing import Annotated

from fastapi import APIRouter, Depends

from app.api.deps import SessionDep, StaffContext, require
from app.domain.permissions import Permission
from app.schemas.clubs import ClubOut, ClubUpdate
from app.services.clubs import update_club

router = APIRouter(prefix="/admin/club", tags=["Admin: club"])


@router.get("", response_model=ClubOut)
async def get_club(
    ctx: Annotated[StaffContext, Depends(require(Permission.SETTINGS_READ))],
) -> ClubOut:
    return ClubOut.model_validate(ctx.club)


@router.patch("", response_model=ClubOut)
async def patch_club(
    body: ClubUpdate,
    ctx: Annotated[StaffContext, Depends(require(Permission.SETTINGS_WRITE))],
    session: SessionDep,
) -> ClubOut:
    return ClubOut.model_validate(await update_club(session, ctx.club, body))
