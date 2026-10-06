from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Query, Response, status

from app.api.deps import CurrentUser, SessionDep
from app.schemas.members import ClubDirectoryItemOut, MyMembershipOut, SearchText
from app.services import members as service

router = APIRouter(prefix="/mobile", tags=["App: clubes y membresías"])


@router.get("/clubs", response_model=list[ClubDirectoryItemOut])
async def clubs_directory(
    user: CurrentUser, session: SessionDep, search: Annotated[SearchText | None, Query()] = None
) -> list[ClubDirectoryItemOut]:
    """Clubes activos (hasta 100) con el estado de mi membresía en cada uno."""
    return await service.clubs_directory(session, user, search)


@router.post(
    "/clubs/{club_id}/membership-requests",
    status_code=status.HTTP_201_CREATED,
    response_model=MyMembershipOut,
    responses={200: {"model": MyMembershipOut, "description": "Ya existía una solicitud"}},
)
async def request_membership(
    club_id: UUID, user: CurrentUser, session: SessionDep, response: Response
) -> MyMembershipOut:
    membership, created = await service.request_membership(session, user, club_id)
    if not created:
        response.status_code = status.HTTP_200_OK
    return membership


@router.get("/memberships", response_model=list[MyMembershipOut])
async def my_memberships(user: CurrentUser, session: SessionDep) -> list[MyMembershipOut]:
    return await service.my_memberships(session, user)
