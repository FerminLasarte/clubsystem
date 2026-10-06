"""ClubSystem API — punto de entrada."""

import uuid
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from app.api.errors import register_error_handlers
from app.api.rate_limit import limiter
from app.api.v1 import routers as v1_routers
from app.core.config import get_settings
from app.core.db import engine
from app.core.logging import club_id_var, configure_logging, request_id_var, user_id_var
from app.workers.scheduler import start_scheduler


class RequestContextMiddleware:
    """Asigna un request_id (o respeta el que manda el proxy) y lo devuelve en la respuesta."""

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        headers = dict(scope["headers"])
        request_id = headers.get(b"x-request-id", b"").decode()[:64] or uuid.uuid4().hex
        tokens = (request_id_var.set(request_id), user_id_var.set(None), club_id_var.set(None))

        async def send_with_id(message: Message) -> None:
            if message["type"] == "http.response.start":
                message.setdefault("headers", []).append((b"x-request-id", request_id.encode()))
            await send(message)

        try:
            await self.app(scope, receive, send_with_id)
        finally:
            request_id_var.reset(tokens[0])
            user_id_var.reset(tokens[1])
            club_id_var.reset(tokens[2])


def create_app() -> FastAPI:
    settings = get_settings()
    configure_logging(settings.LOG_LEVEL, json_output=settings.LOG_JSON)

    @asynccontextmanager
    async def lifespan(_: FastAPI) -> AsyncIterator[None]:
        stop_scheduler = start_scheduler() if settings.ENV != "test" else None
        yield
        if stop_scheduler:
            await stop_scheduler()
        await engine.dispose()

    expose_docs = not settings.is_production
    app = FastAPI(
        title="ClubSystem API",
        version="0.2.0",
        lifespan=lifespan,
        docs_url="/docs" if expose_docs else None,
        redoc_url=None,
        openapi_url="/openapi.json" if expose_docs else None,
    )
    app.state.limiter = limiter
    register_error_handlers(app)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
        allow_headers=["authorization", "content-type", "x-requested-with", "x-request-id"],
        expose_headers=["x-request-id", "content-disposition"],
    )
    app.add_middleware(RequestContextMiddleware)

    api = APIRouter(prefix="/api/v1")
    for router in v1_routers:
        api.include_router(router)
    app.include_router(api)

    @app.get("/health", tags=["Health"])
    async def health() -> dict[str, str]:
        return {"status": "ok"}

    return app


app = create_app()
