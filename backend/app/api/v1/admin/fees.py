from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response

from app.api.deps import SessionDep, StaffContext, require
from app.domain.permissions import Permission
from app.schemas.common import Page
from app.schemas.fees import (
    FeeFilters,
    FeeGenerateOut,
    FeeGenerateRequest,
    FeeOut,
    FeePayRequest,
    FeeSummaryOut,
    Month,
    Year,
)
from app.services.fees import FeeService

router = APIRouter(prefix="/admin/fees", tags=["Admin: cuotas"])

Reader = Annotated[StaffContext, Depends(require(Permission.FEES_READ))]
Writer = Annotated[StaffContext, Depends(require(Permission.FEES_WRITE))]


@router.get("", response_model=Page[FeeOut])
async def list_fees(
    filters: Annotated[FeeFilters, Query()], ctx: Reader, session: SessionDep
) -> Page[FeeOut]:
    return await FeeService(session, ctx).find(filters)


@router.get("/summary", response_model=FeeSummaryOut)
async def fees_summary(
    year: Annotated[Year, Query()],
    month: Annotated[Month, Query()],
    ctx: Reader,
    session: SessionDep,
) -> FeeSummaryOut:
    return await FeeService(session, ctx).summary(year, month)


@router.get("/export.csv", response_class=Response, responses={200: {"content": {"text/csv": {}}}})
async def export_fees(
    year: Annotated[Year, Query()],
    month: Annotated[Month, Query()],
    ctx: Reader,
    session: SessionDep,
) -> Response:
    """Cuotas del mes en CSV."""
    return await FeeService(session, ctx).export(year, month)


@router.post("/generate", response_model=FeeGenerateOut)
async def generate_fees(
    body: FeeGenerateRequest, ctx: Writer, session: SessionDep
) -> FeeGenerateOut:
    return await FeeService(session, ctx).generate(body)


@router.post("/{fee_id}/pay", response_model=FeeOut)
async def pay_fee(fee_id: UUID, body: FeePayRequest, ctx: Writer, session: SessionDep) -> FeeOut:
    return await FeeService(session, ctx).pay(fee_id, body.method)


@router.post("/{fee_id}/cancel", response_model=FeeOut)
async def cancel_fee(fee_id: UUID, ctx: Writer, session: SessionDep) -> FeeOut:
    return await FeeService(session, ctx).cancel(fee_id)
