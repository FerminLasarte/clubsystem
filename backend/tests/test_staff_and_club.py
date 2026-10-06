import re

import httpx
import pytest

from app.domain.enums import StaffRole
from app.services import staff as staff_service
from tests.factories import PASSWORD, Factory, login_mobile, login_web

STAFF = "/api/v1/admin/staff"


@pytest.fixture
def outbox(monkeypatch: pytest.MonkeyPatch) -> list[str]:
    bodies: list[str] = []

    async def _capture(to: str, subject: str, body: str) -> None:
        bodies.append(body)

    monkeypatch.setattr(staff_service, "send_email", _capture)
    return bodies


def _invite_token(body: str) -> str:
    match = re.search(r"token=([\w-]+)", body)
    assert match
    return match.group(1)


async def test_only_owners_manage_staff(client: httpx.AsyncClient, factory: Factory) -> None:
    club = await factory.club()
    manager, _ = await factory.staff(club, roles=[StaffRole.RESERVATIONS_MANAGER])
    await login_web(client, manager)
    assert (await client.get(STAFF)).status_code == 403


async def test_owner_role_cannot_be_granted_from_the_panel(
    client: httpx.AsyncClient, factory: Factory, outbox: list[str]
) -> None:
    club = await factory.club()
    owner, _ = await factory.staff(club)
    await login_web(client, owner)
    response = await client.post(
        f"{STAFF}/invitations", json={"email": "nuevo@example.com", "roles": ["OWNER"]}
    )
    assert response.status_code == 422
    assert outbox == []


async def test_invitation_for_a_new_person_creates_the_account_and_logs_in(
    client: httpx.AsyncClient, factory: Factory, outbox: list[str]
) -> None:
    club = await factory.club(name="Los Cardos")
    owner, _ = await factory.staff(club)
    await login_web(client, owner)
    invited = await client.post(
        f"{STAFF}/invitations",
        json={"email": "Recepcion@Example.com", "roles": ["RESERVATIONS_MANAGER"]},
    )
    assert invited.status_code == 201
    assert invited.json()[-1]["status"] == "INVITED"
    token = _invite_token(outbox[0])

    guest = httpx.AsyncClient(
        transport=client._transport,
        base_url="http://test",
        headers={"x-requested-with": "clubsystem"},
    )
    preview = await guest.get(f"/api/v1/invitations/{token}")
    assert preview.json() == {
        "club_name": "Los Cardos",
        "club_logo_url": None,
        "email": "recepcion@example.com",
        "roles": ["RESERVATIONS_MANAGER"],
        "account": "new",
    }
    accepted = await guest.post(
        "/api/v1/invitations/accept",
        json={
            "token": token,
            "password": "clave-nueva-123",
            "first_name": "Rita",
            "last_name": "Ok",
        },
    )
    assert accepted.status_code == 200
    assert accepted.json()["active_club"]["roles"] == ["RESERVATIONS_MANAGER"]
    assert accepted.json()["user"]["email_verified"] is True

    reused = await guest.post(
        "/api/v1/invitations/accept",
        json={"token": token, "password": "clave-nueva-123", "first_name": "X", "last_name": "Y"},
    )
    assert reused.status_code == 404
    members = (await client.get(STAFF)).json()
    assert [m["status"] for m in members if m["email"] == "recepcion@example.com"] == ["ACTIVE"]


async def test_invitation_takes_over_an_unverified_account_registered_by_someone_else(
    client: httpx.AsyncClient, factory: Factory, outbox: list[str]
) -> None:
    club = await factory.club()
    owner, _ = await factory.staff(club)
    squatter = await factory.user(email="encargado@example.com", email_verified_at=None)
    squatter_headers = await login_mobile(client, squatter)

    await login_web(client, owner)
    await client.post(
        f"{STAFF}/invitations", json={"email": squatter.email, "roles": ["STOCK_MANAGER"]}
    )
    token = _invite_token(outbox[0])
    assert (await client.get(f"/api/v1/invitations/{token}")).json()["account"] == "unverified"

    accepted = await client.post(
        "/api/v1/invitations/accept", json={"token": token, "password": "nueva-clave-real"}
    )
    assert accepted.status_code == 200
    # La sesión de quien había registrado la cuenta queda cerrada y su contraseña ya no sirve.
    assert (await client.get("/api/v1/me", headers=squatter_headers)).status_code == 401
    old = await client.post(
        "/api/v1/auth/mobile/login", json={"identifier": squatter.email, "password": PASSWORD}
    )
    assert old.status_code == 401


async def test_invitation_for_a_verified_account_requires_its_password(
    client: httpx.AsyncClient, factory: Factory, outbox: list[str]
) -> None:
    club = await factory.club()
    owner, _ = await factory.staff(club)
    existing = await factory.user()
    await login_web(client, owner)
    await client.post(
        f"{STAFF}/invitations", json={"email": existing.email, "roles": ["STOCK_MANAGER"]}
    )
    token = _invite_token(outbox[0])
    wrong = await client.post(
        "/api/v1/invitations/accept", json={"token": token, "password": "no-es-esta-clave"}
    )
    assert wrong.status_code == 401
    ok = await client.post(
        "/api/v1/invitations/accept", json={"token": token, "password": PASSWORD}
    )
    assert ok.status_code == 200


async def test_revoking_staff_cuts_access_immediately_but_not_for_self_or_owners(
    client: httpx.AsyncClient, factory: Factory
) -> None:
    club = await factory.club()
    owner, owner_row = await factory.staff(club)
    _, co_owner_row = await factory.staff(club)
    clerk, clerk_row = await factory.staff(club, roles=[StaffRole.STOCK_MANAGER])

    clerk_client = httpx.AsyncClient(
        transport=client._transport,
        base_url="http://test",
        headers={"x-requested-with": "clubsystem"},
    )
    await login_web(clerk_client, clerk)

    await login_web(client, owner)
    assert (await client.delete(f"{STAFF}/{owner_row.id}")).status_code == 403
    assert (await client.delete(f"{STAFF}/{co_owner_row.id}")).status_code == 403
    assert (await client.delete(f"{STAFF}/{clerk_row.id}")).status_code == 204

    assert (await clerk_client.get("/api/v1/auth/web/session")).status_code == 403


async def test_staff_of_another_club_is_not_found(
    client: httpx.AsyncClient, factory: Factory
) -> None:
    club_a = await factory.club()
    club_b = await factory.club()
    owner_a, _ = await factory.staff(club_a)
    _, clerk_b = await factory.staff(club_b, roles=[StaffRole.STOCK_MANAGER])
    await login_web(client, owner_a)

    response = await client.put(
        f"{STAFF}/{clerk_b.id}/roles", json={"roles": ["RESERVATIONS_MANAGER"]}
    )
    assert response.status_code == 404
    assert (await client.delete(f"{STAFF}/{clerk_b.id}")).status_code == 404


async def test_club_settings_permissions_and_validation(
    client: httpx.AsyncClient, factory: Factory
) -> None:
    club = await factory.club()
    owner, _ = await factory.staff(club)
    manager, _ = await factory.staff(club, roles=[StaffRole.RESERVATIONS_MANAGER])

    await login_web(client, manager)
    assert (await client.patch("/api/v1/admin/club", json={"name": "X"})).status_code == 403

    await login_web(client, owner)
    ok = await client.patch(
        "/api/v1/admin/club",
        json={"name": "Club Renovado", "open_time": "08:00", "close_time": "23:00"},
    )
    assert ok.status_code == 200
    assert ok.json()["name"] == "Club Renovado"
    bad_hours = await client.patch(
        "/api/v1/admin/club", json={"open_time": "23:00", "close_time": "08:00"}
    )
    assert bad_hours.status_code == 422
    bad_tz = await client.patch("/api/v1/admin/club", json={"timezone": "Marte/Base"})
    assert bad_tz.status_code == 422


async def test_profile_is_edited_only_by_its_owner_and_dni_is_unique(
    client: httpx.AsyncClient, factory: Factory
) -> None:
    await factory.user(dni="20111222")
    user = await factory.user()
    headers = await login_mobile(client, user)

    taken = await client.patch("/api/v1/me", json={"dni": "20111222"}, headers=headers)
    assert taken.status_code == 409
    ok = await client.patch("/api/v1/me", json={"first_name": "Lucía"}, headers=headers)
    assert ok.json()["first_name"] == "Lucía"
