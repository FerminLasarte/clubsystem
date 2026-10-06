"""Regresiones de la revisión de seguridad del backend nuevo."""

import httpx
import pytest
from pydantic import ValidationError

from app.core.config import Settings
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


def test_production_config_refuses_console_email_and_wildcard_cors() -> None:
    base = {
        "DATABASE_URL": "postgresql+asyncpg://x@h/db",
        "MIGRATIONS_DATABASE_URL": "postgresql+asyncpg://x@h/db",
        "JWT_SECRET_KEY": "s" * 40,
    }
    with pytest.raises(ValidationError):
        Settings(**base, ENV="production", EMAIL_BACKEND="console")  # type: ignore[arg-type]
    with pytest.raises(ValidationError):
        Settings(**base, ENV="development", CORS_ORIGINS="*")  # type: ignore[arg-type]
    assert Settings(**base, ENV="production", EMAIL_BACKEND="disabled")  # type: ignore[arg-type]


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
