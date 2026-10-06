"""
Engine, sesiones y contexto de tenant para Row-Level Security.

Reglas:
  - Una transacción por request: `get_session` la abre y la confirma al terminar
    el endpoint (antes de enviar la respuesta). Los routers y services no hacen
    commit ni rollback; los services usan `flush` cuando necesitan ids.
  - El contexto de RLS (`app.user_id`, `app.club_id`) se fija con `set_config(..., true)`,
    que vale para la transacción en curso. Como hay una sola transacción por
    request, vale para todo el request.
"""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import get_settings


def _build_engine() -> AsyncEngine:
    settings = get_settings()
    return create_async_engine(
        settings.DATABASE_URL,
        pool_size=settings.DB_POOL_SIZE,
        max_overflow=settings.DB_MAX_OVERFLOW,
        pool_pre_ping=True,
        connect_args={
            "server_settings": {
                "application_name": "clubsystem-api",
                "timezone": "UTC",
                "statement_timeout": str(settings.DB_STATEMENT_TIMEOUT_MS),
            }
        },
    )


engine: AsyncEngine = _build_engine()
SessionFactory = async_sessionmaker(engine, expire_on_commit=False, autoflush=False)


async def get_session() -> AsyncIterator[AsyncSession]:
    """Dependencia FastAPI: una sesión con una transacción que abarca el request."""
    async with SessionFactory() as session, session.begin():
        yield session


@asynccontextmanager
async def session_scope() -> AsyncIterator[AsyncSession]:
    """Igual que `get_session`, para jobs y scripts fuera de un request."""
    async with SessionFactory() as session, session.begin():
        yield session


async def set_tenant_context(
    session: AsyncSession, *, user_id: UUID | None = None, club_id: UUID | None = None
) -> None:
    """
    Fija las variables que leen las políticas RLS durante la transacción actual.
    Solo modifica las que se pasan; las demás conservan su valor.
    """
    if user_id is not None:
        await session.execute(
            text("SELECT set_config('app.user_id', :v, true)"), {"v": str(user_id)}
        )
    if club_id is not None:
        await session.execute(
            text("SELECT set_config('app.club_id', :v, true)"), {"v": str(club_id)}
        )
