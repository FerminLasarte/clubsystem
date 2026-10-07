import re

import httpx
import pytest
from pydantic import ValidationError
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.core.errors import Conflict
from app.domain.enums import Sport, StaffRole
from app.schemas.clubs import ClubCreate
from app.services import staff as staff_service
from app.services.clubs import create_club_with_owner
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
    preview = await guest.post("/api/v1/invitations/preview", json={"token": token})
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
    squatter_headers = await factory.mobile_headers(squatter)

    await login_web(client, owner)
    await client.post(
        f"{STAFF}/invitations", json={"email": squatter.email, "roles": ["STOCK_MANAGER"]}
    )
    token = _invite_token(outbox[0])
    assert (await client.post("/api/v1/invitations/preview", json={"token": token})).json()[
        "account"
    ] == "unverified"

    accepted = await client.post(
        "/api/v1/invitations/accept", json={"token": token, "password": "nueva-clave-real"}
    )
    assert accepted.status_code == 200
    # La sesión de quien había registrado la cuenta queda cerrada y su contraseña ya no sirve.
    assert (await client.get("/api/v1/me", headers=squatter_headers)).status_code == 401
    old = await client.post(
        "/api/v1/auth/mobile/login", json={"email": squatter.email, "password": PASSWORD}
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

    assert ok.json()["member_cancel_notice_hours"] == 24
    notice = await client.patch("/api/v1/admin/club", json={"member_cancel_notice_hours": 48})
    assert notice.json()["member_cancel_notice_hours"] == 48
    for invalid in (-1, 337, None):
        response = await client.patch(
            "/api/v1/admin/club", json={"member_cancel_notice_hours": invalid}
        )
        assert response.status_code == 422, invalid


async def test_profile_does_not_reveal_whether_a_dni_belongs_to_another_account(
    client: httpx.AsyncClient, factory: Factory
) -> None:
    """El DNI es autodeclarado y no único: guardar uno ajeno responde igual que uno libre."""
    await factory.user(dni="20111222")
    one, other = await factory.user(), await factory.user()
    one_headers = await login_mobile(client, one)
    other_headers = await login_mobile(client, other)

    taken = await client.patch("/api/v1/me", json={"dni": "20111222"}, headers=one_headers)
    free = await client.patch("/api/v1/me", json={"dni": "20333444"}, headers=other_headers)
    assert taken.status_code == free.status_code == 200
    assert (taken.json()["dni"], free.json()["dni"]) == ("20111222", "20333444")
    own = {"id", "email", "last_name", "dni"}
    assert {k: v for k, v in taken.json().items() if k not in own} == {
        k: v for k, v in free.json().items() if k not in own
    }
    saved = await client.get("/api/v1/me", headers=one_headers)
    assert saved.json()["dni"] == "20111222"

    ok = await client.patch("/api/v1/me", json={"first_name": "Lucía"}, headers=one_headers)
    assert ok.json()["first_name"] == "Lucía"


async def test_operator_creates_a_club_and_its_owner_takes_over_with_the_invitation(
    client: httpx.AsyncClient,
    owner_sessionmaker: async_sessionmaker[AsyncSession],
    outbox: list[str],
) -> None:
    data = ClubCreate(
        slug="los-cardos",
        name="Los Cardos",
        owner_email="Duena@Example.com",
        sport_types=[Sport.PADEL, Sport.PADEL, Sport.TENNIS],
        timezone="America/Montevideo",
    )
    async with owner_sessionmaker() as session, session.begin():
        club, created = await create_club_with_owner(session, data)
    assert created
    assert (club.sport_types, club.timezone) == (["padel", "tennis"], "America/Montevideo")

    # Volver a correrlo antes de que acepte renueva la invitación: el link viejo deja de valer.
    async with owner_sessionmaker() as session, session.begin():
        _, created = await create_club_with_owner(session, data)
    assert not created
    old_token, token = _invite_token(outbox[0]), _invite_token(outbox[1])
    assert "El equipo de ClubSystem te invitó a Los Cardos" in outbox[1]
    stale = await client.post("/api/v1/invitations/preview", json={"token": old_token})
    assert stale.status_code == 404

    accepted = await client.post(
        "/api/v1/invitations/accept",
        json={"token": token, "password": "clave-nueva-123", "first_name": "D", "last_name": "C"},
    )
    assert accepted.status_code == 200
    assert accepted.json()["active_club"]["roles"] == ["OWNER"]
    assert (await client.get(STAFF)).status_code == 200  # gestionar el equipo es del dueño

    # Con el dueño ya activo, no se lo puede volver a invitar.
    with pytest.raises(Conflict):
        async with owner_sessionmaker() as session, session.begin():
            await create_club_with_owner(session, data)


def test_club_creation_validates_slug_and_timezone() -> None:
    base = {"name": "Los Cardos", "owner_email": "duena@example.com"}
    for slug in ("Los Cardos", "los_cardos", "-los", "los--cardos", ""):
        with pytest.raises(ValidationError):
            ClubCreate(slug=slug, **base)  # type: ignore[arg-type]
    with pytest.raises(ValidationError, match="Zona horaria"):
        ClubCreate(slug="los-cardos", timezone="America/Rosario-Inventada", **base)  # type: ignore[arg-type]
    assert ClubCreate(slug="club-2", **base).timezone is None  # type: ignore[arg-type]
