"""
Monitoreo de errores y latencia con Sentry. Sin SENTRY_DSN queda apagado (desarrollo, tests y CI).

Nunca salen cuerpos de requests, cookies, headers de auth, variables locales, emails, DNI ni
tokens. El SDK se configura para no juntarlos y `scrub_event` limpia lo que pueda colarse igual,
por ejemplo el DETAIL de un error de Postgres con el email que violó una constraint o una URL con
el token de una invitación en el query string. Los clientes aplican las mismas reglas
(`packages/shared/src/monitoring.ts`).
"""

import re
from collections.abc import Callable
from typing import cast

import sentry_sdk
from sentry_sdk.types import Breadcrumb, BreadcrumbHint, Event, Hint, SamplingContext

from app.core.config import Settings
from app.core.logging import club_id_var, user_id_var

FILTERED = "[Filtered]"

# Claves cuyo valor nunca se manda, estén donde estén en el evento (headers, extras, contextos).
_SENSITIVE_KEYS = ("password", "token", "secret", "authorization", "cookie", "email", "dni")
_SAFE_HEADERS = {"accept", "content-type", "user-agent", "x-request-id"}
_TEXT_PATTERNS = (
    re.compile(r"[\w.+-]+@[\w-]+(?:\.[\w-]+)+"),  # emails
    re.compile(r"eyJ[\w-]+\.[\w-]+\.[\w-]*"),  # JWT
    re.compile(r"(?i)bearer\s+\S+"),
    re.compile(r"(?<![\w.-])\d{1,2}\.?\d{3}\.?\d{3}(?![\w.-])"),  # DNI, con o sin puntos
    re.compile(r"\?[^\s\"'#]*=[^\s\"'#]*"),  # query strings (tokens de invitación, reset, etc.)
)


def _scrub_text(text: str) -> str:
    for pattern in _TEXT_PATTERNS:
        text = pattern.sub(FILTERED, text)
    return text


def _scrub(value: object, key: str = "") -> object:
    if any(part in key.lower() for part in _SENSITIVE_KEYS):
        return FILTERED
    if isinstance(value, str):
        return _scrub_text(value)
    if isinstance(value, dict):
        return {k: _scrub(v, str(k)) for k, v in value.items()}
    if isinstance(value, list | tuple):
        return [_scrub(v) for v in value]
    return value


def scrub_event(event: Event, _hint: Hint) -> Event:
    request = event.get("request")
    if request is not None:
        for field in ("data", "cookies", "query_string", "env"):
            request.pop(field, None)
        headers = request.get("headers")
        if isinstance(headers, dict):
            request["headers"] = {k: v for k, v in headers.items() if k.lower() in _SAFE_HEADERS}
    # El request_id lo pone el middleware (también en las transacciones); acá, quién y en qué club.
    tags = event.setdefault("tags", {})
    for tag, var in (("user_id", user_id_var), ("club_id", club_id_var)):
        if (value := var.get()) is not None:
            tags[tag] = value
    return cast("Event", _scrub(event))


def scrub_breadcrumb(crumb: Breadcrumb, _hint: BreadcrumbHint) -> Breadcrumb:
    return cast("Breadcrumb", _scrub(crumb))


def _traces_sampler(rate: float) -> Callable[[SamplingContext], float]:
    def sample(context: SamplingContext) -> float:
        if context.get("asgi_scope", {}).get("path") == "/health":
            return 0
        # Si el panel o la app ya decidieron muestrear el trace, se respeta para que quede entero.
        parent = context.get("parent_sampled")
        return float(parent) if parent is not None else rate

    return sample


def init_monitoring(settings: Settings) -> None:
    if not settings.SENTRY_DSN:
        return
    sentry_sdk.init(
        dsn=settings.SENTRY_DSN,
        environment=settings.ENV,
        release=settings.SENTRY_RELEASE,
        send_default_pii=False,
        include_local_variables=False,
        max_request_body_size="never",
        traces_sampler=_traces_sampler(settings.SENTRY_TRACES_SAMPLE_RATE),
        before_send=scrub_event,
        before_send_transaction=scrub_event,
        before_breadcrumb=scrub_breadcrumb,
    )
