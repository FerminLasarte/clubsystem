from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, status

from app.api.deps import SessionDep, StaffContext, require
from app.domain.permissions import Permission
from app.schemas.staff import InviteRequest, RolesUpdate, StaffMemberOut
from app.services.staff import StaffService

router = APIRouter(prefix="/admin/staff", tags=["Admin: equipo"])

Manager = Annotated[StaffContext, Depends(require(Permission.STAFF_MANAGE))]


@router.get("", response_model=list[StaffMemberOut])
async def list_staff(ctx: Manager, session: SessionDep) -> list[StaffMemberOut]:
    return await StaffService(session, ctx).members()


@router.post(
    "/invitations", status_code=status.HTTP_201_CREATED, response_model=list[StaffMemberOut]
)
async def invite(body: InviteRequest, ctx: Manager, session: SessionDep) -> list[StaffMemberOut]:
    service = StaffService(session, ctx)
    await service.invite(body.email, body.roles)
    return await service.members()


@router.put("/{staff_id}/roles", response_model=list[StaffMemberOut])
async def update_roles(
    staff_id: UUID, body: RolesUpdate, ctx: Manager, session: SessionDep
) -> list[StaffMemberOut]:
    service = StaffService(session, ctx)
    await service.update_roles(staff_id, body.roles)
    return await service.members()


@router.delete("/{staff_id}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke(staff_id: UUID, ctx: Manager, session: SessionDep) -> None:
    await StaffService(session, ctx).revoke(staff_id)
