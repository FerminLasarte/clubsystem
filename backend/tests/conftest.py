"""
Tests de API contra un Postgres real (con RLS activa).

Variables necesarias (en CI vienen del entorno; en local se leen de backend/.env):
  TEST_DATABASE_URL             → rol de la app (sujeto a RLS)
  TEST_MIGRATIONS_DATABASE_URL  → rol dueño (migraciones y fixtures; BYPASSRLS)
"""

import os
import subprocess
import sys
from collections.abc import AsyncIterator
from pathlib import Path

import pytest

BACKEND = Path(__file__).resolve().parents[1]


def _load_dotenv() -> dict[str, str]:
    path = BACKEND / ".env"
    if not path.exists():
        return {}
    pairs = (line.split("=", 1) for line in path.read_text().splitlines() if "=" in line)
    return {k.strip(): v.strip() for k, v in pairs if not k.strip().startswith("#")}


_dotenv = _load_dotenv()
_test_db = os.environ.get("TEST_DATABASE_URL") or _dotenv["TEST_DATABASE_URL"]
_test_owner_db = (
    os.environ.get("TEST_MIGRATIONS_DATABASE_URL") or _dotenv["TEST_MIGRATIONS_DATABASE_URL"]
)
os.environ.update(
    {
        "ENV": "test",
        "DATABASE_URL": _test_db,
        "MIGRATIONS_DATABASE_URL": _test_owner_db,
        "JWT_SECRET_KEY": "test-secret-" + "x" * 40,
        "COOKIE_SECURE": "false",
        "AUTH_RATE_LIMIT": "1000/minute",
        "EMAIL_BACKEND": "console",
        "ANTHROPIC_API_KEY": "",
        "LOG_LEVEL": "WARNING",
    }
)

# Imports de la app después de fijar el entorno.
import httpx  # noqa: E402
from sqlalchemy import text  # noqa: E402
from sqlalchemy.ext.asyncio import (  # noqa: E402
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.api.rate_limit import limiter  # noqa: E402
from app.main import app  # noqa: E402
from app.models import Base  # noqa: E402
from tests.factories import Factory  # noqa: E402


@pytest.fixture(scope="session", autouse=True)
def _migrated_database() -> None:
    env = {**os.environ, "MIGRATIONS_DATABASE_URL": _test_owner_db}
    alembic = [sys.executable, "-m", "alembic"]
    for args in (["downgrade", "base"], ["upgrade", "head"]):
        subprocess.run([*alembic, *args], cwd=BACKEND, env=env, check=True, capture_output=True)


@pytest.fixture(scope="session")
async def owner_sessionmaker() -> AsyncIterator[async_sessionmaker[AsyncSession]]:
    engine = create_async_engine(_test_owner_db)
    yield async_sessionmaker(engine, expire_on_commit=False)
    await engine.dispose()


@pytest.fixture(autouse=True)
async def _clean_tables(
    owner_sessionmaker: async_sessionmaker[AsyncSession],
) -> AsyncIterator[None]:
    yield
    tables = ", ".join(t.name for t in Base.metadata.sorted_tables)
    async with owner_sessionmaker() as session, session.begin():
        await session.execute(text(f"TRUNCATE {tables} CASCADE"))


@pytest.fixture(autouse=True)
def _reset_rate_limits() -> None:
    # El limitador es en memoria y compartido por proceso: cada test arranca de cero.
    limiter.reset()


@pytest.fixture
async def factory(owner_sessionmaker: async_sessionmaker[AsyncSession]) -> AsyncIterator[Factory]:
    async with owner_sessionmaker() as session:
        yield Factory(session)
        await session.commit()


@pytest.fixture
async def client() -> AsyncIterator[httpx.AsyncClient]:
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(
        transport=transport,
        base_url="http://test",
        headers={"x-requested-with": "clubsystem"},
    ) as http:
        yield http
