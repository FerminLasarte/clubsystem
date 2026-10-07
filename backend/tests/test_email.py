"""Envío real de emails con Resend (API simulada: nunca sale a la red)."""

import asyncio
import json
import logging
from collections.abc import Awaitable, Callable

import httpx
import pytest
from pydantic import SecretStr

from app.core.config import get_settings
from app.integrations.email import resend_client
from app.services.email import wait_for_pending
from tests.factories import Factory

AUTH = "/api/v1/auth"
API_KEY = "re_test_0123456789"
SENDER = "ClubSystem <no-reply@mail.example.com>"

Handler = Callable[[httpx.Request], Awaitable[httpx.Response]]


class FakeResend:
    """Reemplaza la API de Resend. `handler` decide la respuesta de cada envío."""

    def __init__(self) -> None:
        self.requests: list[httpx.Request] = []
        self.handler: Handler = self._accept

    async def _accept(self, request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"id": "email-123"})

    async def __call__(self, request: httpx.Request) -> httpx.Response:
        self.requests.append(request)
        return await self.handler(request)

    def payloads(self) -> list[dict[str, object]]:
        return [json.loads(r.content) for r in self.requests]


@pytest.fixture
def resend(monkeypatch: pytest.MonkeyPatch) -> FakeResend:
    fake = FakeResend()
    settings = get_settings()
    monkeypatch.setattr(settings, "EMAIL_BACKEND", "resend")
    monkeypatch.setattr(settings, "RESEND_API_KEY", SecretStr(API_KEY))
    monkeypatch.setattr(settings, "EMAIL_FROM", SENDER)
    monkeypatch.setattr(
        resend_client,
        "_client",
        lambda timeout: httpx.AsyncClient(
            base_url=resend_client.RESEND_API_URL,
            transport=httpx.MockTransport(fake),
            timeout=timeout,
        ),
    )
    return fake


async def test_password_reset_email_goes_through_resend(
    client: httpx.AsyncClient, factory: Factory, resend: FakeResend
) -> None:
    user = await factory.user()

    response = await client.post(f"{AUTH}/password/forgot", json={"email": user.email})
    assert response.status_code == 202
    await wait_for_pending(grace_seconds=5)

    [request] = resend.requests
    assert (request.method, str(request.url)) == ("POST", "https://api.resend.com/emails")
    assert request.headers["authorization"] == f"Bearer {API_KEY}"
    [payload] = resend.payloads()
    assert payload["from"] == SENDER
    assert payload["to"] == [user.email]
    assert payload["subject"] == "Restablecer contraseña"
    assert "/reset-password?token=" in str(payload["text"])


async def test_the_response_does_not_wait_for_resend(
    client: httpx.AsyncClient, factory: Factory, resend: FakeResend
) -> None:
    user = await factory.user()
    release = asyncio.Event()

    async def slow(request: httpx.Request) -> httpx.Response:
        await release.wait()
        return httpx.Response(200, json={"id": "email-123"})

    resend.handler = slow
    response = await asyncio.wait_for(
        client.post(f"{AUTH}/password/forgot", json={"email": user.email}), timeout=5
    )
    assert response.status_code == 202
    assert len(resend.requests) == 1  # el envío está en curso, después de responder
    release.set()
    await wait_for_pending(grace_seconds=5)


async def _fail_with_500(request: httpx.Request) -> httpx.Response:
    # Resend puede repetir la dirección en `message`: no tiene que llegar al log.
    return httpx.Response(
        500, json={"name": "application_error", "message": f"falló {request.content!r}"}
    )


async def _fail_with_invalid_json(request: httpx.Request) -> httpx.Response:
    return httpx.Response(502, text="<html>Bad gateway</html>")


async def _time_out(request: httpx.Request) -> httpx.Response:
    raise httpx.ConnectTimeout("timed out", request=request)


async def _network_error(request: httpx.Request) -> httpx.Response:
    raise httpx.ConnectError("connection refused", request=request)


@pytest.mark.parametrize(
    ("failure", "reason"),
    [
        (_fail_with_500, "Resend respondió 500 (application_error)"),
        (_fail_with_invalid_json, "Resend respondió 502 (sin detalle)"),
        (_time_out, "Resend no respondió en 10 s"),
        (_network_error, "error de red con Resend (ConnectError)"),
    ],
)
async def test_a_failed_delivery_changes_nothing_and_logs_no_personal_data(
    client: httpx.AsyncClient,
    factory: Factory,
    resend: FakeResend,
    caplog: pytest.LogCaptureFixture,
    failure: Handler,
    reason: str,
) -> None:
    user = await factory.user()
    resend.handler = failure

    with caplog.at_level(logging.INFO, logger="app.services.email"):
        known = await client.post(f"{AUTH}/password/forgot", json={"email": user.email})
        unknown = await client.post(f"{AUTH}/password/forgot", json={"email": "nadie@example.com"})
        registered = await client.post(
            f"{AUTH}/register",
            json={
                "email": "nueva@example.com",
                "password": "una-clave-segura",
                "first_name": "Nueva",
                "last_name": "Socia",
            },
        )
        await wait_for_pending(grace_seconds=5)

    # Misma respuesta exista o no la cuenta, y el registro no falla por el email.
    assert (known.status_code, known.content) == (unknown.status_code, unknown.content)
    assert known.status_code == 202
    assert registered.status_code == 202, registered.text
    assert len(resend.requests) == 2  # reset de la cuenta existente + verificación del alta

    messages = [r.getMessage() for r in caplog.records if r.name == "app.services.email"]
    assert messages == [f"No se pudo enviar un email: {reason}"] * 2
    for message in messages:
        for secret in (user.email, "nueva@example.com", "token", API_KEY):
            assert secret not in message


async def test_console_and_disabled_backends_never_call_resend(
    client: httpx.AsyncClient,
    factory: Factory,
    resend: FakeResend,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    user = await factory.user()
    for backend in ("console", "disabled"):
        monkeypatch.setattr(get_settings(), "EMAIL_BACKEND", backend)
        response = await client.post(f"{AUTH}/password/forgot", json={"email": user.email})
        assert response.status_code == 202
    await wait_for_pending(grace_seconds=5)
    assert resend.requests == []
