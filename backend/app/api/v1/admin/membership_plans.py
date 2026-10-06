from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, status

from app.api.deps import SessionDep, StaffContext, require
from app.domain.permissions import Permission
from app.schemas.members import PlanCreate, PlanOut, PlanUpdate
from app.services.members import PlanService

router = APIRouter(prefix="/admin/membership-plans", tags=["Admin: planes"])

Reader = Annotated[StaffContext, Depends(require(Permission.MEMBERS_READ))]
Writer = Annotated[StaffContext, Depends(require(Permission.PLANS_WRITE))]


@router.get("", response_model=list[PlanOut])
async def list_plans(ctx: Reader, session: SessionDep) -> list[PlanOut]:
    return [PlanOut.model_validate(p) for p in await PlanService(session, ctx).plans()]


@router.post("", status_code=status.HTTP_201_CREATED, response_model=PlanOut)
async def create_plan(body: PlanCreate, ctx: Writer, session: SessionDep) -> PlanOut:
    return PlanOut.model_validate(await PlanService(session, ctx).create(body))


@router.patch("/{plan_id}", response_model=PlanOut)
async def update_plan(plan_id: UUID, body: PlanUpdate, ctx: Writer, session: SessionDep) -> PlanOut:
    return PlanOut.model_validate(await PlanService(session, ctx).update(plan_id, body))


@router.delete("/{plan_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_plan(plan_id: UUID, ctx: Writer, session: SessionDep) -> None:
    """Si algún socio tiene el plan, se desactiva en lugar de borrarse."""
    await PlanService(session, ctx).remove(plan_id)
