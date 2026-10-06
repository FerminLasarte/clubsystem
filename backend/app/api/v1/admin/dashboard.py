from typing import Annotated

from fastapi import APIRouter, Depends

from app.api.deps import SessionDep, StaffContext, require
from app.domain.permissions import Permission
from app.schemas.dashboard import DashboardFinanceOut, DashboardOperationsOut
from app.services.dashboard import DashboardService

router = APIRouter(prefix="/admin/dashboard", tags=["Admin: dashboard"])


@router.get("/operations", response_model=DashboardOperationsOut)
async def operations(
    ctx: Annotated[StaffContext, Depends(require(Permission.DASHBOARD_OPERATIONS))],
    session: SessionDep,
) -> DashboardOperationsOut:
    return await DashboardService(session, ctx).operations()


@router.get("/finance", response_model=DashboardFinanceOut)
async def finance(
    ctx: Annotated[StaffContext, Depends(require(Permission.DASHBOARD_FINANCE))],
    session: SessionDep,
) -> DashboardFinanceOut:
    return await DashboardService(session, ctx).finance()
