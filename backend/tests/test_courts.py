from datetime import UTC, datetime, timedelta
from decimal import Decimal

import httpx

from app.domain.enums import MembershipStatus, ReservationStatus, Sport, StaffRole
from tests.factories import Factory, login_mobile, login_web

COURTS = "/api/v1/admin/courts"

NEW_COURT = {
    "name": "Central",
    "sport": "padel",
    "surface": "synthetic",
    "is_indoor": True,
    "price_member": "8000",
    "price_guest": "12000",
}


async def test_courts_crud(client: httpx.AsyncClient, factory: Factory) -> None:
    club = await factory.club()
    owner, _ = await factory.staff(club)
    await login_web(client, owner)

    created = await client.post(COURTS, json=NEW_COURT)
    assert created.status_code == 201, created.text
    court = created.json()
    assert court["price_member"] == "8000.00"
    assert court["is_active"] is True
    assert (await client.post(COURTS, json=NEW_COURT)).status_code == 409

    patched = await client.patch(
        f"{COURTS}/{court['id']}", json={"price_guest": "15000.50", "capacity": 2}
    )
    assert patched.status_code == 200
    assert patched.json()["price_guest"] == "15000.50"
    assert patched.json()["capacity"] == 2
    assert (await client.patch(f"{COURTS}/{court['id']}", json={"name": None})).status_code == 422
    negative = await client.patch(f"{COURTS}/{court['id']}", json={"price_member": "-1"})
    assert negative.status_code == 422

    listed = await client.get(COURTS)
    assert [c["name"] for c in listed.json()] == ["Central"]
    assert (await client.delete(f"{COURTS}/{court['id']}")).status_code == 204
    assert (await client.get(COURTS)).json() == []


async def test_courts_permissions(client: httpx.AsyncClient, factory: Factory) -> None:
    club = await factory.club()
    await factory.court(club)
    manager, _ = await factory.staff(club, roles=[StaffRole.RESERVATIONS_MANAGER])
    stock, _ = await factory.staff(club, roles=[StaffRole.STOCK_MANAGER])

    await login_web(client, manager)
    assert (await client.get(COURTS)).status_code == 200
    assert (await client.post(COURTS, json=NEW_COURT)).status_code == 403

    await login_web(client, stock)
    assert (await client.get(COURTS)).status_code == 403


async def test_courts_of_another_club_are_not_visible(
    client: httpx.AsyncClient, factory: Factory
) -> None:
    club_a, club_b = await factory.club(), await factory.club()
    owner_a, _ = await factory.staff(club_a)
    court_b = await factory.court(club_b)
    await login_web(client, owner_a)

    assert (await client.get(COURTS)).json() == []
    assert (await client.patch(f"{COURTS}/{court_b.id}", json={"capacity": 8})).status_code == 404
    assert (await client.delete(f"{COURTS}/{court_b.id}")).status_code == 404


async def test_court_with_reservations_is_deactivated_not_deleted(
    client: httpx.AsyncClient, factory: Factory
) -> None:
    club = await factory.club()
    owner, _ = await factory.staff(club)
    player = await factory.user()
    court = await factory.court(club)
    now = datetime.now(UTC)
    upcoming = await factory.reservation(
        court, player, now + timedelta(days=1), now + timedelta(days=1, hours=1)
    )
    await factory.reservation(
        court,
        player,
        now - timedelta(days=1),
        now - timedelta(days=1) + timedelta(hours=1),
        status=ReservationStatus.COMPLETED,
    )
    await login_web(client, owner)

    deleted = await client.delete(f"{COURTS}/{court.id}")
    assert deleted.status_code == 409
    blocked = await client.patch(f"{COURTS}/{court.id}", json={"is_active": False})
    assert blocked.status_code == 409
    assert blocked.json()["error"]["code"] == "court_has_upcoming_reservations"

    assert (
        await client.post(f"/api/v1/admin/reservations/{upcoming.id}/cancel")
    ).status_code == 200
    deactivated = await client.patch(f"{COURTS}/{court.id}", json={"is_active": False})
    assert deactivated.status_code == 200
    assert deactivated.json()["is_active"] is False
    assert (await client.delete(f"{COURTS}/{court.id}")).status_code == 409


async def test_members_see_active_courts_with_member_price(
    client: httpx.AsyncClient, factory: Factory
) -> None:
    club, other = await factory.club(), await factory.club()
    await factory.court(club, name="Padel 1")
    await factory.court(club, name="Tenis 1", sport=Sport.TENNIS, price_member=Decimal("5000"))
    await factory.court(club, name="Vieja", is_active=False)
    await factory.court(other, name="Ajena")
    member, _ = await factory.membership(club)
    pending, _ = await factory.membership(club, status=MembershipStatus.PENDING)

    headers = await login_mobile(client, member)
    courts = await client.get(f"/api/v1/mobile/clubs/{club.id}/courts", headers=headers)
    assert courts.status_code == 200
    assert [(c["name"], c["price_per_hour"]) for c in courts.json()] == [
        ("Padel 1", "8000.00"),
        ("Tenis 1", "5000.00"),
    ]
    padel = await client.get(
        f"/api/v1/mobile/clubs/{club.id}/courts", params={"sport": "padel"}, headers=headers
    )
    assert [c["name"] for c in padel.json()] == ["Padel 1"]
    foreign = await client.get(f"/api/v1/mobile/clubs/{other.id}/courts", headers=headers)
    assert foreign.status_code == 403

    pending_headers = await login_mobile(client, pending)
    denied = await client.get(f"/api/v1/mobile/clubs/{club.id}/courts", headers=pending_headers)
    assert denied.status_code == 403
