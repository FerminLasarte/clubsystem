"""
ClubSync — FastAPI Application Entry Point
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.database import engine, Base
from app.middleware.tenant import TenantMiddleware
from app.routers import clubs, users, courts, reservations, expenses, stock
from app.routers import auth
from app.routers import dashboard


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: create tables if needed (use Alembic in production)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
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
app.include_router(users.router,        prefix=f"{API_V1}/users",        tags=["Users"])
app.include_router(courts.router,       prefix=f"{API_V1}/courts",       tags=["Courts"])
app.include_router(reservations.router, prefix=f"{API_V1}/reservations", tags=["Reservations"])
app.include_router(expenses.router,     prefix=f"{API_V1}/expenses",     tags=["Expenses"])
app.include_router(stock.router,        prefix=f"{API_V1}/stock",        tags=["Stock"])
app.include_router(auth.router,         prefix="/api/v1/auth",           tags=["Auth"])
app.include_router(dashboard.router,    prefix="/api/v1/dashboard",      tags=["Dashboard"])


@app.get("/health", tags=["Health"])
async def health_check():
    return {"status": "ok", "version": app.version}
