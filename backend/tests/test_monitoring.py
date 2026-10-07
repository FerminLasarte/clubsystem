"""Monitoreo (core/monitoring.py): apagado sin DSN y sin datos personales ni secretos."""

import json
from collections.abc import Iterator

import httpx
import pytest
import sentry_sdk
from sentry_sdk.envelope import Envelope
from sentry_sdk.transport import Transport

from app.core.config import get_settings
from app.core.monitoring import FILTERED, init_monitoring, scrub_event
from app.main import app
from app.services.auth import AuthService

EMAIL = "ana.perez@example.com"
PASSWORD = "una-clave-muy-secreta"
DNI = "30.123.456"
TOKEN = "invitacion-abc123"


class _Capture(Transport):
    def __init__(self) -> None:
        super().__init__()
        self.payloads: list[dict[str, object]] = []

    def capture_envelope(self, envelope: Envelope) -> None:
        for item in envelope.items:
            if item.type in ("event", "transaction") and item.payload.json is not None:
                self.payloads.append(item.payload.json)


@pytest.fixture
def sentry(monkeypatch: pytest.MonkeyPatch) -> Iterator[_Capture]:
    capture = _Capture()
    monkeypatch.setattr("sentry_sdk.client.make_transport", lambda _options: capture)
    settings = get_settings().model_copy(
        update={"SENTRY_DSN": "https://public@sentry.invalid/1", "SENTRY_TRACES_SAMPLE_RATE": 1.0}
    )
    init_monitoring(settings)
    yield capture
    sentry_sdk.get_client().close()
    sentry_sdk.get_global_scope().set_client(None)


def test_monitoring_is_off_without_dsn() -> None:
    # Los tests (como dev y CI) corren sin SENTRY_DSN.
    assert get_settings().SENTRY_DSN is None
    assert not sentry_sdk.get_client().is_active()


async def test_unexpected_errors_reach_sentry_with_request_id_and_without_personal_data(
    sentry: _Capture, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def explode(*_: object) -> None:
        # Como el DETAIL de Postgres al violar una constraint: el mensaje trae datos del usuario.
        raise RuntimeError(f"Key (email, dni)=({EMAIL}, {DNI}) already exists")

    monkeypatch.setattr(AuthService, "authenticate", explode)
    transport = httpx.ASGITransport(app=app, raise_app_exceptions=False)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as http:
        response = await http.post(
            f"/api/v1/auth/mobile/login?token={TOKEN}",
            json={"email": EMAIL, "password": PASSWORD},
            headers={"authorization": "Bearer eyJhbGciOi.eyJzdWIi.firma", "cookie": "cs_access=x"},
        )
    sentry_sdk.flush()

    assert response.status_code == 500
    # El 500 lo arma el handler más externo de Starlette: el request_id va en el cuerpo.
    request_id = response.json()["error"]["request_id"]
    assert request_id
    kinds = {p.get("type", "event") for p in sentry.payloads}
    assert kinds == {"event", "transaction"}
    for payload in sentry.payloads:
        assert payload["tags"]["request_id"] == request_id  # type: ignore[index]
    sent = json.dumps(sentry.payloads)
    for secret in (EMAIL, PASSWORD, DNI, TOKEN, "eyJhbGciOi", "cs_access"):
        assert secret not in sent
    assert "RuntimeError" in sent  # el error en sí llega, sin los datos


def test_scrub_event_drops_request_data_and_sensitive_values() -> None:
    event = scrub_event(
        {
            "request": {
                "url": "https://api.example.com/api/v1/auth/mobile/login",
                "query_string": f"token={TOKEN}",
                "data": {"email": EMAIL, "password": PASSWORD},
                "cookies": {"cs_refresh": "x"},
                "headers": {"User-Agent": "app", "Authorization": "Bearer x", "X-Api-Key": "k"},
            },
            "extra": {"refresh_token": "abc", "dni": "30123456", "note": f"de {EMAIL}"},
            "breadcrumbs": {"values": [{"message": f"GET /verify?token={TOKEN}"}]},
        },
        {},
    )

    request = event.get("request", {})
    assert set(request) == {"url", "headers"}
    assert request["headers"] == {"User-Agent": "app"}
    assert event.get("extra") == {
        "refresh_token": FILTERED,
        "dni": FILTERED,
        "note": f"de {FILTERED}",
    }
    assert TOKEN not in json.dumps(event)
