"""
ClubSync — FastAPI Application Entry Point
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.core.config import settings
from app.core.database import engine, Base
from app.middleware.tenant import TenantMiddleware
from app.routers import clubs, users, courts, reservations, expenses, stock
from app.routers import auth
from app.routers import dashboard
from app.routers import staff
from app.routers import notifications
from app.routers import invitations


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: create tables if needed (use Alembic in production)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

        # ── Migración idempotente: stock_items.unit ENUM → VARCHAR ────────────
        # asyncpg envía SIEMPRE strings como $N::VARCHAR. PostgreSQL rechaza
        # ese cast implícito sobre columnas de tipo ENUM user-defined.
        # Convertir a VARCHAR(20) + CHECK constraint resuelve el problema
        # de raíz sin necesitar codecs asyncpg ni PgEnum en SQLAlchemy.
        # Este bloque es idempotente: si la columna ya es VARCHAR, el DO $$
        # detecta que data_type != 'USER-DEFINED' y no hace nada.
        await conn.execute(text("""
            DO $$ BEGIN
                IF EXISTS (
                    SELECT 1
                    FROM information_schema.columns
                    WHERE table_name  = 'stock_items'
                      AND column_name = 'unit'
                      AND data_type   = 'USER-DEFINED'
                ) THEN
                    ALTER TABLE stock_items
                        ALTER COLUMN unit TYPE VARCHAR(20) USING unit::text;

                    ALTER TABLE stock_items
                        ADD CONSTRAINT chk_stock_unit_values
                        CHECK (unit IN ('unit', 'box', 'kg', 'liter', 'pack'));
                END IF;
            END $$;
        """))

    yield
    # Shutdown
    await engine.dispose()


app = FastAPI(
    title="ClubSync API",
    version="0.1.0",
    description="Multi-tenant SaaS for sports club management",
    lifespan=lifespan,
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url=None,
)

# ── CORS ──────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Tenant Middleware ─────────────────────────────────────────
# Must be added AFTER CORSMiddleware so it runs on real requests
app.add_middleware(TenantMiddleware)

# ── Routers ──────────────────────────────────────────────────
API_V1 = "/api/v1"

app.include_router(clubs.router,        prefix=f"{API_V1}/clubs",        tags=["Clubs"])
app.include_router(staff.router,        prefix=f"{API_V1}/clubs",        tags=["Staff"])
app.include_router(users.router,        prefix=f"{API_V1}/users",        tags=["Users"])
app.include_router(courts.router,       prefix=f"{API_V1}/courts",       tags=["Courts"])
app.include_router(reservations.router, prefix=f"{API_V1}/reservations", tags=["Reservations"])
app.include_router(expenses.router,     prefix=f"{API_V1}/expenses",     tags=["Expenses"])
app.include_router(stock.router,        prefix=f"{API_V1}/stock",        tags=["Stock"])
app.include_router(auth.router,          prefix="/api/v1/auth",              tags=["Auth"])
app.include_router(dashboard.router,     prefix="/api/v1/dashboard",         tags=["Dashboard"])
app.include_router(notifications.router, prefix=f"{API_V1}/notifications",   tags=["Notifications"])
app.include_router(invitations.router,   prefix=f"{API_V1}/invitations",     tags=["Invitations"])


@app.get("/health", tags=["Health"])
async def health_check():
    return {"status": "ok", "version": app.version}
