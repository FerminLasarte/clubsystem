from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Response, status

from app.api.deps import SessionDep, StaffContext, require
from app.domain.permissions import Permission
from app.schemas.common import Page
from app.schemas.expenses import (
    ExpenseCreate,
    ExpenseFilters,
    ExpenseListParams,
    ExpenseOut,
    ExpenseStatsOut,
    ExpenseUpdate,
    PeriodParams,
    RecomputeOut,
)
from app.services.expenses import ExpenseService

router = APIRouter(prefix="/admin/expenses", tags=["Admin: gastos"])

Reader = Annotated[StaffContext, Depends(require(Permission.EXPENSES_READ))]
Writer = Annotated[StaffContext, Depends(require(Permission.EXPENSES_WRITE))]


@router.get("", response_model=Page[ExpenseOut])
async def list_expenses(
    params: Annotated[ExpenseListParams, Query()], ctx: Reader, session: SessionDep
) -> Page[ExpenseOut]:
    return await ExpenseService(session, ctx).search(params)


@router.get("/stats", response_model=ExpenseStatsOut)
async def expense_stats(
    filters: Annotated[ExpenseFilters, Query()], ctx: Reader, session: SessionDep
) -> ExpenseStatsOut:
    """Totales del período (por defecto, el mes en curso)."""
    return await ExpenseService(session, ctx).stats(filters)


@router.get(
    "/export.csv",
    response_class=Response,
    responses={200: {"content": {"text/csv": {}}}},
)
async def export_expenses(
    filters: Annotated[ExpenseFilters, Query()], ctx: Reader, session: SessionDep
) -> Response:
    """Gastos del período (por defecto, el mes en curso) con una fila de total."""
    return await ExpenseService(session, ctx).export_csv(filters)


@router.post("/anomalies/recompute", response_model=RecomputeOut)
async def recompute_anomalies(
    params: Annotated[PeriodParams, Query()], ctx: Writer, session: SessionDep
) -> RecomputeOut:
    """Recalcula la estadística del período (por defecto, el mes en curso). No usa IA."""
    return await ExpenseService(session, ctx).recompute(params)


@router.post("", status_code=status.HTTP_201_CREATED, response_model=ExpenseOut)
async def create_expense(body: ExpenseCreate, ctx: Writer, session: SessionDep) -> ExpenseOut:
    return ExpenseOut.model_validate(await ExpenseService(session, ctx).create(body))


@router.get("/{expense_id}", response_model=ExpenseOut)
async def get_expense(expense_id: UUID, ctx: Reader, session: SessionDep) -> ExpenseOut:
    return ExpenseOut.model_validate(await ExpenseService(session, ctx).get(expense_id))


@router.patch("/{expense_id}", response_model=ExpenseOut)
async def update_expense(
    expense_id: UUID, body: ExpenseUpdate, ctx: Writer, session: SessionDep
) -> ExpenseOut:
    return ExpenseOut.model_validate(await ExpenseService(session, ctx).update(expense_id, body))


@router.delete("/{expense_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_expense(expense_id: UUID, ctx: Writer, session: SessionDep) -> None:
    await ExpenseService(session, ctx).delete(expense_id)


@router.patch("/{expense_id}/review", response_model=ExpenseOut)
async def review_expense(expense_id: UUID, ctx: Writer, session: SessionDep) -> ExpenseOut:
    return ExpenseOut.model_validate(await ExpenseService(session, ctx).review(expense_id))
