"""Traducción única de errores a respuestas HTTP. Ningún endpoint arma errores a mano."""

import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from slowapi.errors import RateLimitExceeded
from sqlalchemy.exc import IntegrityError

from app.core.errors import DomainError
from app.core.logging import request_id_var

logger = logging.getLogger(__name__)

# Violaciones de constraints que son errores de negocio esperables (no bugs).
_CONSTRAINT_ERRORS: dict[str, tuple[int, str]] = {
    "no_overlap": (409, "La cancha ya está reservada en ese horario."),
    "uq_users_email": (409, "Ya existe una cuenta con ese email."),
    "uq_users_dni": (409, "Ese DNI ya está asociado a otra cuenta."),
    "uq_club_staff_club_id_email": (409, "Esa persona ya forma parte del equipo del club."),
    "uq_club_memberships_club_id_user_id": (409, "Ya existe una membresía en este club."),
    "uq_club_memberships_club_id_member_number": (409, "Ese número de socio ya está en uso."),
    "uq_membership_plans_club_id_name": (409, "Ya existe un plan con ese nombre."),
    "uq_courts_club_id_name": (409, "Ya existe una cancha con ese nombre."),
    "uq_membership_fees_period_active": (409, "El socio ya tiene una cuota para ese período."),
    "ck_stock_items_quantity_non_negative": (422, "Stock insuficiente para ese movimiento."),
    "fk_reservations_user_id_users": (409, "El usuario tiene reservas asociadas."),
    "fk_reservations_court_same_club": (409, "La cancha tiene reservas asociadas."),
}


def _error(status: int, code: str, message: str, **extra: object) -> JSONResponse:
    body: dict[str, object] = {"error": {"code": code, "message": message, **extra}}
    return JSONResponse(status_code=status, content=body)


def _constraint_name(exc: IntegrityError) -> str | None:
    cause = getattr(exc.orig, "__cause__", None)
    return getattr(cause, "constraint_name", None)


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(DomainError)
    async def _domain(_: Request, exc: DomainError) -> JSONResponse:
        return _error(exc.status_code, exc.code, exc.message)

    @app.exception_handler(IntegrityError)
    async def _integrity(_: Request, exc: IntegrityError) -> JSONResponse:
        name = _constraint_name(exc)
        if name in _CONSTRAINT_ERRORS:
            status, message = _CONSTRAINT_ERRORS[name]
            return _error(status, "conflict" if status == 409 else "business_rule", message)
        logger.exception("Violación de integridad no mapeada (constraint=%s)", name)
        return _error(409, "conflict", "La operación entra en conflicto con datos existentes.")

    @app.exception_handler(RequestValidationError)
    async def _validation(_: Request, exc: RequestValidationError) -> JSONResponse:
        fields = [
            {"field": ".".join(str(p) for p in err["loc"][1:]), "message": err["msg"]}
            for err in exc.errors()
        ]
        return _error(422, "validation_error", "Hay datos inválidos en el pedido.", fields=fields)

    @app.exception_handler(RateLimitExceeded)
    async def _rate_limited(_: Request, __: RateLimitExceeded) -> JSONResponse:
        return _error(429, "rate_limited", "Demasiados intentos. Probá de nuevo en un minuto.")

    @app.exception_handler(Exception)
    async def _unexpected(_: Request, exc: Exception) -> JSONResponse:
        logger.exception("Error no controlado")
        return _error(
            500, "internal_error", "Ocurrió un error inesperado.", request_id=request_id_var.get()
        )
