"""
Inventario del club.

La cantidad de un ítem cambia SOLO con movimientos, y toda escritura de la cantidad pasa
por `_add_quantity`: un UPDATE condicional atómico. Así dos salidas simultáneas no pueden
dejar el stock negativo ni pisarse, y cada movimiento registra before/after reales.
"""

from decimal import Decimal
from typing import Any
from uuid import UUID

from fastapi.responses import Response
from sqlalchemy import Select, func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.csv import csv_response
from app.core.errors import BusinessRuleViolation, NotFound
from app.core.time import utcnow
from app.domain.enums import StockMovementType
from app.models import StockItem, StockMovement, User
from app.repositories.base import get_scoped, paginate
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
from app.services.context import StaffContext

_NOT_FOUND = "Ítem de stock no encontrado."
_REQUIRED_FIELDS = {"name": "El nombre", "unit": "La unidad", "min_quantity": "El stock mínimo"}


def _movement_out(movement: StockMovement, performed_by: User | None) -> MovementOut:
    return MovementOut(
        id=movement.id,
        item_id=movement.item_id,
        type=movement.type,
        quantity_delta=movement.quantity_delta,
        quantity_before=movement.quantity_before,
        quantity_after=movement.quantity_after,
        unit_cost=movement.unit_cost,
        reason=movement.reason,
        performed_by_name=performed_by.full_name if performed_by else None,
        created_at=movement.created_at,
    )


def _quantity_text(value: Decimal) -> str:
    # 10.000 → "10", 2.500 → "2.5": la planilla muestra la cantidad como se cargó.
    return format(value.normalize(), "f")


class StockService:
    def __init__(self, session: AsyncSession, ctx: StaffContext) -> None:
        self.db = session
        self.ctx = ctx

    # ── Lectura ───────────────────────────────────────────────────────────────

    def _items_query(self, filters: StockItemFilters) -> Select[StockItem]:
        stmt = select(StockItem).where(
            StockItem.club_id == self.ctx.club_id, StockItem.deleted_at.is_(None)
        )
        if filters.search:
            pattern = f"%{filters.search}%"
            stmt = stmt.where(
                or_(
                    StockItem.name.ilike(pattern),
                    StockItem.sku.ilike(pattern),
                    StockItem.category.ilike(pattern),
                )
            )
        if filters.category:
            stmt = stmt.where(StockItem.category == filters.category)
        if filters.low_stock is not None:
            stmt = stmt.where(StockItem.is_low_stock == filters.low_stock)
        return stmt.order_by(StockItem.category.nulls_last(), StockItem.name, StockItem.id)

    async def items(self, filters: StockItemFilters, params: PageParams) -> Page[StockItemOut]:
        rows, total = await paginate(self.db, self._items_query(filters), params)
        return Page(
            items=[StockItemOut.model_validate(item) for (item,) in rows],
            total=total,
            page=params.page,
            page_size=params.page_size,
        )

    async def export_items(self, filters: StockItemFilters) -> Response:
        items = (await self.db.execute(self._items_query(filters))).scalars()
        return csv_response(
            f"stock_{self.ctx.club.slug}.csv",
            [
                "SKU",
                "Nombre",
                "Categoría",
                "Unidad",
                "Cantidad",
                "Mínimo",
                "Stock bajo",
                "Costo unitario",
                "Precio de venta",
                "Valor a costo",
                "Proveedor",
                "Ubicación",
            ],
            (
                [
                    item.sku,
                    item.name,
                    item.category,
                    item.unit.value,
                    _quantity_text(item.quantity),
                    _quantity_text(item.min_quantity),
                    "Sí" if item.is_low_stock else "No",
                    item.unit_cost,
                    item.unit_price,
                    (item.quantity * item.unit_cost).quantize(Decimal("0.01"))
                    if item.unit_cost is not None
                    else None,
                    item.supplier,
                    item.location,
                ]
                for item in items
            ),
        )

    async def stats(self) -> StockStatsOut:
        value = func.coalesce(func.sum(StockItem.quantity * StockItem.unit_cost), 0)
        total, low, inventory_value = (
            await self.db.execute(
                select(
                    func.count(),
                    func.count().filter(StockItem.is_low_stock),
                    func.round(value, 2),
                ).where(StockItem.club_id == self.ctx.club_id, StockItem.deleted_at.is_(None))
            )
        ).one()
        return StockStatsOut(
            total_items=total, low_stock_count=low, inventory_value=inventory_value
        )

    async def categories(self) -> list[str]:
        rows = await self.db.execute(
            select(StockItem.category)
            .distinct()
            .where(
                StockItem.club_id == self.ctx.club_id,
                StockItem.deleted_at.is_(None),
                StockItem.category.is_not(None),
            )
            .order_by(StockItem.category)
        )
        return [c for c in rows.scalars() if c is not None]

    async def movements(self, item_id: UUID, params: PageParams) -> Page[MovementOut]:
        # El historial sigue disponible para ítems dados de baja.
        await get_scoped(self.db, StockItem, item_id, self.ctx.club_id, not_found=_NOT_FOUND)
        stmt: Select[*tuple[Any, ...]] = (
            select(StockMovement, User)
            .outerjoin(User, User.id == StockMovement.performed_by_id)
            .where(StockMovement.club_id == self.ctx.club_id, StockMovement.item_id == item_id)
            .order_by(StockMovement.created_at.desc(), StockMovement.id.desc())
        )
        rows, total = await paginate(self.db, stmt, params)
        return Page(
            items=[_movement_out(movement, user) for movement, user in rows],
            total=total,
            page=params.page,
            page_size=params.page_size,
        )

    async def _item(self, item_id: UUID, *, for_update: bool = False) -> StockItem:
        """Ítem vigente del club, recargado de la base (refleja los UPDATE atómicos)."""
        stmt = (
            select(StockItem)
            .where(
                StockItem.id == item_id,
                StockItem.club_id == self.ctx.club_id,
                StockItem.deleted_at.is_(None),
            )
            .execution_options(populate_existing=True)
        )
        if for_update:
            stmt = stmt.with_for_update()
        item = (await self.db.execute(stmt)).scalar_one_or_none()
        if item is None:
            raise NotFound(_NOT_FOUND)
        return item

    # ── Escritura ─────────────────────────────────────────────────────────────

    async def create(self, data: StockItemCreate) -> StockItemOut:
        item = StockItem(
            club_id=self.ctx.club_id,
            **data.model_dump(exclude={"quantity"}),
            quantity=Decimal(0),
        )
        self.db.add(item)
        await self.db.flush()
        if data.quantity > 0:
            await self._record(
                item.id,
                StockMovementType.IN,
                data.quantity,
                reason="Stock inicial",
                unit_cost=data.unit_cost,
            )
        return StockItemOut.model_validate(await self._item(item.id))

    async def update(self, item_id: UUID, data: StockItemUpdate) -> StockItemOut:
        changes = data.model_dump(exclude_unset=True)
        for field, label in _REQUIRED_FIELDS.items():
            if field in changes and changes[field] is None:
                raise BusinessRuleViolation(f"{label} es obligatorio.")
        item = await self._item(item_id)
        for field, value in changes.items():
            setattr(item, field, value)
        await self.db.flush()
        return StockItemOut.model_validate(await self._item(item_id))

    async def delete(self, item_id: UUID) -> None:
        item = await self._item(item_id)
        item.deleted_at = utcnow()
        await self.db.flush()

    async def move(self, item_id: UUID, data: MovementCreate) -> MovementResultOut:
        if data.type == StockMovementType.ADJUSTMENT:
            assert data.target_quantity is not None  # validado en el schema
            # Bloquea la fila para que el delta se calcule sobre la cantidad vigente.
            item = await self._item(item_id, for_update=True)
            delta = data.target_quantity - item.quantity
            if delta == 0:
                raise BusinessRuleViolation(
                    "La cantidad indicada coincide con el stock actual; no hay nada que ajustar."
                )
        else:
            assert data.quantity is not None  # validado en el schema
            delta = data.quantity if data.type == StockMovementType.IN else -data.quantity
        movement = await self._record(
            item_id, data.type, delta, reason=data.reason, unit_cost=data.unit_cost
        )
        return MovementResultOut(
            movement=_movement_out(movement, self.ctx.user),
            item=StockItemOut.model_validate(await self._item(item_id)),
        )

    async def _record(
        self,
        item_id: UUID,
        type_: StockMovementType,
        delta: Decimal,
        *,
        reason: str | None,
        unit_cost: Decimal | None,
    ) -> StockMovement:
        after = await self._add_quantity(item_id, delta)
        movement = StockMovement(
            club_id=self.ctx.club_id,
            item_id=item_id,
            performed_by_id=self.ctx.user_id,
            type=type_,
            quantity_delta=delta,
            quantity_before=after - delta,
            quantity_after=after,
            unit_cost=unit_cost,
            reason=reason,
        )
        self.db.add(movement)
        await self.db.flush()
        await self.db.refresh(movement, ["created_at"])
        return movement

    async def _add_quantity(self, item_id: UUID, delta: Decimal) -> Decimal:
        """Suma `delta` en la base sin dejar la cantidad negativa. Devuelve la cantidad nueva."""
        after = (
            await self.db.execute(
                update(StockItem)
                .where(
                    StockItem.id == item_id,
                    StockItem.club_id == self.ctx.club_id,
                    StockItem.deleted_at.is_(None),
                    StockItem.quantity + delta >= 0,
                )
                .values(quantity=StockItem.quantity + delta)
                .returning(StockItem.quantity)
                .execution_options(synchronize_session=False)
            )
        ).scalar_one_or_none()
        if after is None:
            await self._item(item_id)  # 404 si no existe, es de otro club o está dado de baja
            raise BusinessRuleViolation(
                "Stock insuficiente para ese movimiento.", code="insufficient_stock"
            )
        return after
