from datetime import date
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from fastapi.responses import Response

from app.api.deps import SessionDep, StaffContext, require
from app.domain.permissions import Permission
from app.schemas.cash import CashDayOut, MovementOut, PaymentCreate, PaymentVoid
from app.schemas.common import ExportRange
from app.services.cash import CashService

router = APIRouter(prefix="/admin/cash", tags=["Admin: caja"])

Reader = Annotated[StaffContext, Depends(require(Permission.CASH_READ))]
Writer = Annotated[StaffContext, Depends(require(Permission.CASH_WRITE))]


@router.get("/day", response_model=CashDayOut)
async def cash_day(
    ctx: Reader,
    session: SessionDep,
    day: Annotated[date | None, Query(alias="date", description="Día local del club.")] = None,
) -> CashDayOut:
    return await CashService(session, ctx).day(day)


@router.get("/export.csv", response_class=Response, responses={200: {"content": {"text/csv": {}}}})
async def export_cash(
    period: Annotated[ExportRange, Query()], ctx: Reader, session: SessionDep
) -> Response:
    """Movimientos de caja de un día (`from` = `to`) o de un rango, en CSV."""
    return await CashService(session, ctx).export(period)


@router.post("/payments", status_code=status.HTTP_201_CREATED, response_model=MovementOut)
async def create_payment(body: PaymentCreate, ctx: Writer, session: SessionDep) -> MovementOut:
    return await CashService(session, ctx).create(body)


@router.post("/payments/{payment_id}/void", response_model=MovementOut)
async def void_payment(
    payment_id: UUID, body: PaymentVoid, ctx: Writer, session: SessionDep
) -> MovementOut:
    return await CashService(session, ctx).void(payment_id, body.reason)
