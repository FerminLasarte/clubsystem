from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, status
from fastapi.responses import Response

from app.api.deps import SessionDep, StaffContext, require
from app.domain.permissions import Permission
from app.schemas.common import Page, PageParams
from app.schemas.stock import (
    MovementCreate,
    MovementOut,
    MovementResultOut,
    StockItemCreate,
    StockItemFilters,
    StockItemOut,
    StockItemUpdate,
    StockStatsOut,
)
from app.services.stock import StockService

router = APIRouter(prefix="/admin/stock", tags=["Admin: stock"])

Reader = Annotated[StaffContext, Depends(require(Permission.STOCK_READ))]
Writer = Annotated[StaffContext, Depends(require(Permission.STOCK_WRITE))]
Filters = Annotated[StockItemFilters, Depends()]
Paging = Annotated[PageParams, Depends()]


@router.get("/items", response_model=Page[StockItemOut])
async def list_items(
    filters: Filters, params: Paging, ctx: Reader, session: SessionDep
) -> Page[StockItemOut]:
    return await StockService(session, ctx).items(filters, params)


@router.get(
    "/items/export.csv",
    response_class=Response,
    responses={200: {"content": {"text/csv": {}}}},
)
async def export_items(filters: Filters, ctx: Reader, session: SessionDep) -> Response:
    return await StockService(session, ctx).export_items(filters)


@router.get("/stats", response_model=StockStatsOut)
async def stats(ctx: Reader, session: SessionDep) -> StockStatsOut:
    return await StockService(session, ctx).stats()


@router.get("/categories", response_model=list[str])
async def categories(ctx: Reader, session: SessionDep) -> list[str]:
    return await StockService(session, ctx).categories()


@router.post("/items", status_code=status.HTTP_201_CREATED, response_model=StockItemOut)
async def create_item(body: StockItemCreate, ctx: Writer, session: SessionDep) -> StockItemOut:
    return await StockService(session, ctx).create(body)


@router.patch("/items/{item_id}", response_model=StockItemOut)
async def update_item(
    item_id: UUID, body: StockItemUpdate, ctx: Writer, session: SessionDep
) -> StockItemOut:
    return await StockService(session, ctx).update(item_id, body)


@router.delete("/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_item(item_id: UUID, ctx: Writer, session: SessionDep) -> None:
    await StockService(session, ctx).delete(item_id)


@router.get("/items/{item_id}/movements", response_model=Page[MovementOut])
async def list_movements(
    item_id: UUID, params: Paging, ctx: Reader, session: SessionDep
) -> Page[MovementOut]:
    return await StockService(session, ctx).movements(item_id, params)


@router.post(
    "/items/{item_id}/movements",
    status_code=status.HTTP_201_CREATED,
    response_model=MovementResultOut,
)
async def create_movement(
    item_id: UUID, body: MovementCreate, ctx: Writer, session: SessionDep
) -> MovementResultOut:
    return await StockService(session, ctx).move(item_id, body)
