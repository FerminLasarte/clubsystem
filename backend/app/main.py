"""
ClubSystem — FastAPI Application Entry Point
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.core.config import settings
from app.core.database import engine, Base
from app.middleware.tenant import TenantMiddleware
from app.routers import clubs, users, courts, reservations, expenses, stock, members
from app.routers import auth
from app.routers import dashboard
from app.routers import staff
from app.routers import notifications
from app.routers import invitations
from app.routers import payments
from app.routers import finance
from app.routers import fees
from app.routers import settings as settings_router
from app.routers import mobile_app


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

        # ── Migración idempotente: expenses.is_active ─────────────────────────
        # Agrega la columna is_active (soft-delete) si no existe todavía.
        # Si ya existe, el bloque IF NOT EXISTS la omite sin error.
        await conn.execute(text("""
            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1
                    FROM information_schema.columns
                    WHERE table_name  = 'expenses'
                      AND column_name = 'is_active'
                ) THEN
                    ALTER TABLE expenses
                        ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT TRUE;
                END IF;
            END $$;
        """))

        # ── Migración idempotente: users.gender ───────────────────────────────
        await conn.execute(text("""
            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1
                    FROM information_schema.columns
                    WHERE table_name  = 'users'
                      AND column_name = 'gender'
                ) THEN
                    ALTER TABLE users ADD COLUMN gender VARCHAR(20);
                END IF;
            END $$;
        """))

        # ── Migración idempotente: users.membership_plan ──────────────────────
        await conn.execute(text("""
            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1
                    FROM information_schema.columns
                    WHERE table_name  = 'users'
                      AND column_name = 'membership_plan'
                ) THEN
                    ALTER TABLE users ADD COLUMN membership_plan VARCHAR(100);
                END IF;
            END $$;
        """))

        # ── Migración idempotente: payments.transaction_type ─────────────────
        # La tabla payments se crea vía create_all si no existe.
        # Si ya existía sin la columna transaction_type (deployments anteriores),
        # este bloque la agrega con DEFAULT 'INCOME' para todos los registros.
        await conn.execute(text("""
            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1
                    FROM information_schema.columns
                    WHERE table_name  = 'payments'
                      AND column_name = 'transaction_type'
                ) THEN
                    ALTER TABLE payments
                        ADD COLUMN transaction_type VARCHAR(10) NOT NULL DEFAULT 'INCOME';
                END IF;
            END $$;
        """))

        # ── Migración idempotente: clubs — horarios y política de cancelación ──
        # Agrega open_time, close_time (TIME) y cancellation_policy_hours (INT)
        # si no existen. Seguro para re-ejecución (IF NOT EXISTS).
        await conn.execute(text("""
            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1
                    FROM information_schema.columns
                    WHERE table_name  = 'clubs'
                      AND column_name = 'open_time'
                ) THEN
                    ALTER TABLE clubs ADD COLUMN open_time  TIME;
                    ALTER TABLE clubs ADD COLUMN close_time TIME;
                    ALTER TABLE clubs ADD COLUMN cancellation_policy_hours INTEGER NOT NULL DEFAULT 24;
                END IF;
            END $$;
        """))

        # ── Migración idempotente: clubs — pagos y notificaciones ─────────────
        # Agrega las columnas de configuración de pagos (require_deposit,
        # mercadopago_token) y preferencias de notificaciones si no existen.
        await conn.execute(text("""
            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'clubs' AND column_name = 'require_deposit'
                ) THEN
                    ALTER TABLE clubs ADD COLUMN require_deposit   BOOLEAN NOT NULL DEFAULT FALSE;
                    ALTER TABLE clubs ADD COLUMN mercadopago_token TEXT;
                    ALTER TABLE clubs ADD COLUMN notif_whatsapp     BOOLEAN NOT NULL DEFAULT TRUE;
                    ALTER TABLE clubs ADD COLUMN notif_cancellation BOOLEAN NOT NULL DEFAULT TRUE;
                    ALTER TABLE clubs ADD COLUMN notif_cash_report  BOOLEAN NOT NULL DEFAULT FALSE;
                END IF;
            END $$;
        """))

        # ── Migración idempotente: membership_fees.status CHECK constraint ────
        # La tabla se crea vía create_all; este bloque agrega el CHECK si no
        # existe todavía (por ejemplo en bases creadas con versiones anteriores).
        await conn.execute(text("""
            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1
                    FROM information_schema.table_constraints
                    WHERE table_name       = 'membership_fees'
                      AND constraint_name  = 'chk_fee_status_values'
                      AND constraint_type  = 'CHECK'
                ) THEN
                    ALTER TABLE membership_fees
                        ADD CONSTRAINT chk_fee_status_values
                        CHECK (status IN ('PENDING', 'PAID', 'CANCELLED'));
                END IF;
            END $$;
        """))

    yield
    # Shutdown
    await engine.dispose()


app = FastAPI(
    title="ClubSystem API",
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
app.include_router(members.router,      prefix=f"{API_V1}/members",      tags=["Members"])
app.include_router(courts.router,       prefix=f"{API_V1}/courts",       tags=["Courts"])
app.include_router(reservations.router, prefix=f"{API_V1}/reservations", tags=["Reservations"])
app.include_router(expenses.router,     prefix=f"{API_V1}/expenses",     tags=["Expenses"])
app.include_router(stock.router,        prefix=f"{API_V1}/stock",        tags=["Stock"])
app.include_router(auth.router,          prefix="/api/v1/auth",              tags=["Auth"])
app.include_router(dashboard.router,     prefix="/api/v1/dashboard",         tags=["Dashboard"])
app.include_router(notifications.router, prefix=f"{API_V1}/notifications",   tags=["Notifications"])
app.include_router(invitations.router,   prefix=f"{API_V1}/invitations",     tags=["Invitations"])
app.include_router(payments.router,      prefix=f"{API_V1}/payments",        tags=["Payments"])
app.include_router(finance.router,       prefix=f"{API_V1}/finance",         tags=["Finance"])
app.include_router(fees.router,            prefix=f"{API_V1}/fees",            tags=["Fees"])
app.include_router(settings_router.router, prefix=f"{API_V1}/settings",        tags=["Settings"])
app.include_router(mobile_app.router,     prefix=f"{API_V1}/mobile",            tags=["Mobile"])


@app.get("/health", tags=["Health"])
async def health_check():
    return {"status": "ok", "version": app.version}
