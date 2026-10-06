"""
Acceso a datos con scope de tenant obligatorio.

Toda lectura de una entidad de club pasa por acá con el club_id del contexto
(StaffContext / MemberContext). RLS es la red de seguridad; esto es el control principal.
"""

from typing import Any
from uuid import UUID

from sqlalchemy import Select, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import NotFound
from app.schemas.common import PageParams


async def get_scoped[M](
    session: AsyncSession,
    model: type[M],
    entity_id: UUID,
    club_id: UUID,
    *,
    not_found: str = "No encontrado.",
    for_update: bool = False,
) -> M:
    """Busca por id dentro del club; 404 si no existe o es de otro club."""
    stmt = select(model).where(
        model.id == entity_id,  # type: ignore[attr-defined]
        model.club_id == club_id,  # type: ignore[attr-defined]
    )
    if for_update:
        stmt = stmt.with_for_update()
    entity = (await session.execute(stmt)).scalar_one_or_none()
    if entity is None:
        raise NotFound(not_found)
    return entity


async def paginate(
    session: AsyncSession, stmt: Select[*tuple[Any, ...]], params: PageParams
) -> tuple[list[Any], int]:
    """Devuelve (filas de la página, total). `stmt` ya debe tener ORDER BY."""
    total = (
        await session.execute(select(func.count()).select_from(stmt.order_by(None).subquery()))
    ).scalar_one()
    rows = (await session.execute(stmt.limit(params.page_size).offset(params.offset))).all()
    return list(rows), total
