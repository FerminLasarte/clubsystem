"""Regresiones de la revisión de seguridad del backend nuevo."""

import httpx
import pytest
from pydantic import SecretStr, ValidationError
from starlette.requests import Request

from app.api.rate_limit import CLIENT_IP_HEADER, PROXY_SECRET_HEADER, client_ip
from app.core.config import Settings, get_settings
from app.domain.enums import StaffRole
from tests.factories import Factory, login_mobile, login_web
from tests.test_reservations import at, future_day

MOBILE = "/api/v1/mobile"


async def test_app_bookings_have_a_horizon_and_a_cap_on_pending(
    client: httpx.AsyncClient, factory: Factory
) -> None:
    club = await factory.club(open_time=None, close_time=None)
    member, _ = await factory.membership(club)
    court = await factory.court(club)
    headers = await login_mobile(client, member)

    def book(day_offset: int, hour: int):
        return client.post(
            f"{MOBILE}/clubs/{club.id}/reservations",
            json={
                "court_id": str(court.id),
                "starts_at": at(club, future_day(club, day_offset), hour).isoformat(),
                "duration_minutes": 60,
            },
            headers=headers,
        )

    too_far = await book(40, 10)
    assert too_far.status_code == 422
    assert too_far.json()["error"]["code"] == "too_far"

    for hour in (10, 12, 14):
        assert (await book(3, hour)).status_code == 201
    fourth = await book(3, 16)
    assert fourth.status_code == 422
    assert fourth.json()["error"]["code"] == "too_many_pending"


async def test_passwords_over_72_bytes_are_rejected_not_500(client: httpx.AsyncClient) -> None:
    response = await client.post(
        "/api/v1/auth/register",
        json={"email": "a@example.com", "password": "ñ" * 40, "first_name": "A", "last_name": "B"},
    )
    assert response.status_code == 422


async def test_web_refresh_requires_the_csrf_header(
    client: httpx.AsyncClient, factory: Factory
) -> None:
    club = await factory.club()
    user, _ = await factory.staff(club)
    await login_web(client, user)
    response = await client.post("/api/v1/auth/web/refresh", headers={"x-requested-with": ""})
    assert response.status_code == 403
    assert response.json()["error"]["code"] == "csrf"


async def test_operations_dashboard_hides_customers_from_roles_without_permission(
    client: httpx.AsyncClient, factory: Factory
) -> None:
    club = await factory.club()
    clerk, _ = await factory.staff(club, roles=[StaffRole.STOCK_MANAGER])
    await login_web(client, clerk)
    body = (await client.get("/api/v1/admin/dashboard/operations")).json()
    assert body["upcoming_reservations"] is None
    assert body["pending_membership_requests"] is None


def test_production_config_requires_resend_and_refuses_wildcard_cors() -> None:
    base = {
        "DATABASE_URL": "postgresql+asyncpg://x@h/db",
        "MIGRATIONS_DATABASE_URL": "postgresql+asyncpg://x@h/db",
        "JWT_SECRET_KEY": "s" * 40,
        "PROXY_SHARED_SECRET": "p" * 40,
    }
    resend = {"RESEND_API_KEY": "re_test_key", "EMAIL_FROM": "Club <no-reply@mail.example.com>"}
    with pytest.raises(ValidationError):
        Settings(**base, ENV="development", CORS_ORIGINS="*")  # type: ignore[arg-type]
    # En producción el email tiene que salir por Resend, con clave y remitente.
    for backend in ("console", "disabled"):
        with pytest.raises(ValidationError):
            Settings(**base, **resend, ENV="production", EMAIL_BACKEND=backend)  # type: ignore[arg-type]
    for missing in ("RESEND_API_KEY", "EMAIL_FROM"):
        incomplete = {k: v for k, v in resend.items() if k != missing}
        with pytest.raises(ValidationError, match=missing):
            Settings(**base, **incomplete, ENV="production", EMAIL_BACKEND="resend")  # type: ignore[arg-type]
    blank_sender = {**resend, "EMAIL_FROM": "  "}
    with pytest.raises(ValidationError, match="EMAIL_FROM"):
        Settings(**base, **blank_sender, ENV="development", EMAIL_BACKEND="resend")  # type: ignore[arg-type]
    assert Settings(**base, **resend, ENV="production", EMAIL_BACKEND="resend")  # type: ignore[arg-type]
    assert Settings(**base, ENV="development", EMAIL_BACKEND="disabled")  # type: ignore[arg-type]
    # Sin el secreto del proxy de Next, todo el panel compartiría la IP de Vercel.
    without_proxy = {k: v for k, v in base.items() if k != "PROXY_SHARED_SECRET"}
    with pytest.raises(ValidationError, match="PROXY_SHARED_SECRET"):
        Settings(**without_proxy, **resend, ENV="production", EMAIL_BACKEND="resend")  # type: ignore[arg-type]
    with pytest.raises(ValidationError, match="PROXY_SHARED_SECRET"):
        Settings(**{**base, "PROXY_SHARED_SECRET": "corto"}, ENV="development")  # type: ignore[arg-type]
    with pytest.raises(ValidationError, match="RATE_LIMIT_STORAGE_URI"):
        Settings(**base, RATE_LIMIT_STORAGE_URI="mongodb://x", ENV="development")  # type: ignore[arg-type]


async def test_profile_updates_are_rate_limited(
    client: httpx.AsyncClient, factory: Factory
) -> None:
    user = await factory.user()
    headers = await login_mobile(client, user)
    statuses = [
        (
            await client.patch("/api/v1/me", json={"first_name": f"N{i}"}, headers=headers)
        ).status_code
        for i in range(21)
    ]
    assert statuses[-1] == 429


PROXY_SECRET = "p" * 40


def _request(headers: dict[str, str]) -> Request:
    raw = [(k.encode(), v.encode()) for k, v in headers.items()]
    return Request({"type": "http", "headers": raw, "client": ("10.0.0.7", 1234)})


def test_client_ip_trusts_the_web_proxy_header_only_with_the_secret(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    signed = {CLIENT_IP_HEADER: "203.0.113.9", PROXY_SECRET_HEADER: PROXY_SECRET}
    # Sin secreto configurado, el header no cuenta aunque venga.
    assert client_ip(_request(signed)) == "10.0.0.7"

    monkeypatch.setattr(get_settings(), "PROXY_SHARED_SECRET", SecretStr(PROXY_SECRET))
    assert client_ip(_request(signed)) == "203.0.113.9"
    assert client_ip(_request({**signed, PROXY_SECRET_HEADER: "otro"})) == "10.0.0.7"
    assert client_ip(_request({CLIENT_IP_HEADER: "203.0.113.9"})) == "10.0.0.7"
    assert client_ip(_request({**signed, CLIENT_IP_HEADER: "no-es-ip"})) == "10.0.0.7"


def test_client_ip_reads_the_platform_header_and_never_x_forwarded_for(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    spoofed = {"x-forwarded-for": "6.6.6.6", "x-real-ip": "198.51.100.4"}
    # Sin header de plataforma configurado, ni X-Real-IP ni X-Forwarded-For cuentan.
    assert client_ip(_request(spoofed)) == "10.0.0.7"

    monkeypatch.setattr(get_settings(), "TRUSTED_IP_HEADER", "x-real-ip")
    assert client_ip(_request(spoofed)) == "198.51.100.4"
    assert client_ip(_request({"x-real-ip": "basura"})) == "10.0.0.7"
    # El header firmado del proxy de la web tiene prioridad: ahí X-Real-IP es la de Vercel.
    monkeypatch.setattr(get_settings(), "PROXY_SHARED_SECRET", SecretStr(PROXY_SECRET))
    signed = {CLIENT_IP_HEADER: "203.0.113.9", PROXY_SECRET_HEADER: PROXY_SECRET}
    assert client_ip(_request({**spoofed, **signed})) == "203.0.113.9"


async def test_panel_users_behind_the_web_proxy_get_their_own_rate_limit(
    client: httpx.AsyncClient, factory: Factory, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(get_settings(), "PROXY_SHARED_SECRET", SecretStr(PROXY_SECRET))
    user = await factory.user()
    headers = await login_mobile(client, user)

    async def patch_profile(ip: str, secret: str = PROXY_SECRET) -> int:
        response = await client.patch(
            "/api/v1/me",
            json={"first_name": "N"},
            headers={**headers, CLIENT_IP_HEADER: ip, PROXY_SECRET_HEADER: secret},
        )
        return response.status_code

    assert [await patch_profile("203.0.113.1") for _ in range(21)][-1] == 429
    # Otra IP real que llega por el mismo proxy tiene su propio cupo.
    assert await patch_profile("203.0.113.2") != 429
    # Con un secreto falso, el header no cuenta: todos comparten la IP de la conexión.
    statuses = [await patch_profile(f"198.51.100.{i}", secret="falso") for i in range(21)]
    assert statuses[-1] == 429
