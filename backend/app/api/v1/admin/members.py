from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Body, Depends, Query, status
from fastapi.responses import Response

from app.api.deps import SessionDep, StaffContext, require
from app.domain.permissions import Permission
from app.schemas.common import Page, PageParams
from app.schemas.members import (
    ApproveRequest,
    MemberCreate,
    MemberFilters,
    MemberListParams,
    MemberOut,
    MemberStatsOut,
    MemberUpdate,
)
from app.services.members import MemberService

router = APIRouter(prefix="/admin", tags=["Admin: socios"])

Reader = Annotated[StaffContext, Depends(require(Permission.MEMBERS_READ))]
Writer = Annotated[StaffContext, Depends(require(Permission.MEMBERS_WRITE))]
Exporter = Annotated[StaffContext, Depends(require(Permission.MEMBERS_EXPORT))]


@router.get("/members", response_model=Page[MemberOut])
async def list_members(
    params: Annotated[MemberListParams, Query()], ctx: Reader, session: SessionDep
) -> Page[MemberOut]:
    return await MemberService(session, ctx).members(params)


@router.get("/members/stats", response_model=MemberStatsOut)
async def member_stats(ctx: Reader, session: SessionDep) -> MemberStatsOut:
    return await MemberService(session, ctx).stats()


@router.get(
    "/members/export.csv",
    response_class=Response,
    responses={200: {"content": {"text/csv": {}}}},
)
async def export_members(
    filters: Annotated[MemberFilters, Query()], ctx: Exporter, session: SessionDep
) -> Response:
    return await MemberService(session, ctx).export_csv(filters)


@router.post("/members", status_code=status.HTTP_201_CREATED, response_model=MemberOut)
async def create_member(body: MemberCreate, ctx: Writer, session: SessionDep) -> MemberOut:
    return await MemberService(session, ctx).create(body)


@router.get("/members/{membership_id}", response_model=MemberOut)
async def get_member(membership_id: UUID, ctx: Reader, session: SessionDep) -> MemberOut:
    return await MemberService(session, ctx).get(membership_id)


@router.patch("/members/{membership_id}", response_model=MemberOut)
async def update_member(
    membership_id: UUID, body: MemberUpdate, ctx: Writer, session: SessionDep
) -> MemberOut:
    return await MemberService(session, ctx).update(membership_id, body)


@router.get("/membership-requests", response_model=Page[MemberOut])
async def list_requests(
    params: Annotated[PageParams, Query()], ctx: Reader, session: SessionDep
) -> Page[MemberOut]:
    return await MemberService(session, ctx).pending_requests(params)


@router.post("/membership-requests/{membership_id}/approve", response_model=MemberOut)
async def approve_request(
    membership_id: UUID,
    ctx: Writer,
    session: SessionDep,
    body: Annotated[ApproveRequest | None, Body()] = None,
) -> MemberOut:
    return await MemberService(session, ctx).approve(membership_id, body or ApproveRequest())


@router.post("/membership-requests/{membership_id}/reject", response_model=MemberOut)
async def reject_request(membership_id: UUID, ctx: Writer, session: SessionDep) -> MemberOut:
    return await MemberService(session, ctx).reject(membership_id)
