import asyncio
import csv
import io
import re
from datetime import UTC, datetime, timedelta

import httpx
import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.domain.enums import MembershipStatus, ReservationStatus, StaffRole
from app.models import Club, ClubMembership, User
from app.services import auth as auth_service
from tests.factories import Factory, login_mobile, login_web

PLANS = "/api/v1/admin/membership-plans"
MEMBERS = "/api/v1/admin/members"
REQUESTS = "/api/v1/admin/membership-requests"
MOBILE = "/api/v1/mobile"


@pytest.fixture
def outbox(monkeypatch: pytest.MonkeyPatch) -> list[tuple[str, str]]:
    sent: list[tuple[str, str]] = []

    async def _capture(to: str, subject: str, body: str) -> None:
        sent.append((to, body))

    monkeypatch.setattr(auth_service, "send_email", _capture)
    return sent


def _new_client(client: httpx.AsyncClient) -> httpx.AsyncClient:
    return httpx.AsyncClient(
        transport=client._transport,
        base_url="http://test",
        headers={"x-requested-with": "clubsystem"},
    )


async def _staff_client(
    client: httpx.AsyncClient, factory: Factory, club: Club, role: StaffRole = StaffRole.OWNER
) -> httpx.AsyncClient:
    user, _ = await factory.staff(club, roles=[role])
    http = _new_client(client)
    await login_web(http, user)
    return http


async def _user_row(
    owner_sessionmaker: async_sessionmaker[AsyncSession], email: str
) -> User | None:
    async with owner_sessionmaker() as session:
        return (await session.execute(select(User).where(User.email == email))).scalar_one_or_none()


async def _membership_row(
    owner_sessionmaker: async_sessionmaker[AsyncSession], membership_id: object
) -> ClubMembership | None:
    async with owner_sessionmaker() as session:
        return await session.get(ClubMembership, membership_id)


# ── Planes ──────────────────────────────────────────────────────────────────


async def test_plans_crud_and_permissions(client: httpx.AsyncClient, factory: Factory) -> None:
    club = await factory.club()
    owner = await _staff_client(client, factory, club)
    manager = await _staff_client(client, factory, club, StaffRole.RESERVATIONS_MANAGER)
    stock = await _staff_client(client, factory, club, StaffRole.STOCK_MANAGER)

    created = await owner.post(PLANS, json={"name": " Familiar ", "monthly_fee": "15000.50"})
    assert created.status_code == 201
    plan = created.json()
    assert plan["name"] == "Familiar"
    assert plan["monthly_fee"] == "15000.50"
    assert plan["is_active"] is True

    duplicated = await owner.post(PLANS, json={"name": "Familiar", "monthly_fee": "1"})
    assert duplicated.status_code == 409
    assert (await owner.post(PLANS, json={"name": "X", "monthly_fee": "-1"})).status_code == 422

    patched = await owner.patch(f"{PLANS}/{plan['id']}", json={"monthly_fee": "16000"})
    assert patched.json()["monthly_fee"] == "16000.00"
    assert (await owner.patch(f"{PLANS}/{plan['id']}", json={"name": None})).status_code == 422

    listed = await manager.get(PLANS)
    assert [p["id"] for p in listed.json()] == [plan["id"]]
    assert (await manager.post(PLANS, json={"name": "Y", "monthly_fee": "1"})).status_code == 403
    assert (await manager.patch(f"{PLANS}/{plan['id']}", json={})).status_code == 403
    assert (await manager.delete(f"{PLANS}/{plan['id']}")).status_code == 403
    assert (await stock.get(PLANS)).status_code == 403


async def test_deleting_a_plan_in_use_deactivates_it(
    client: httpx.AsyncClient, factory: Factory
) -> None:
    club = await factory.club()
    used = await factory.plan(club, "Usado")
    unused = await factory.plan(club, "Libre")
    await factory.membership(club, plan=used)
    owner = await _staff_client(client, factory, club)

    assert (await owner.delete(f"{PLANS}/{unused.id}")).status_code == 204
    assert (await owner.delete(f"{PLANS}/{used.id}")).status_code == 204
    plans = (await owner.get(PLANS)).json()
    assert [(p["name"], p["is_active"]) for p in plans] == [("Usado", False)]

    # Un plan desactivado no se asigna.
    member = await owner.post(
        MEMBERS,
        json={
            "email": "a@example.com",
            "first_name": "A",
            "last_name": "B",
            "plan_id": str(used.id),
        },
    )
    assert member.status_code == 422
    assert member.json()["error"]["code"] == "plan_inactive"


# ── Socios ──────────────────────────────────────────────────────────────────


async def test_member_list_search_filters_and_activity(
    client: httpx.AsyncClient, factory: Factory
) -> None:
    club = await factory.club()
    gold = await factory.plan(club, "Oro")
    ana = await factory.user(first_name="Ana", last_name="Zapata", dni="30111222")
    beto = await factory.user(first_name="Beto", last_name="Alvarez", email="beto@club.com")
    carla = await factory.user(first_name="Carla", last_name="Mendez")
    _, m_ana = await factory.membership(club, ana, plan=gold)
    _, m_beto = await factory.membership(club, beto)
    await factory.membership(club, carla, status=MembershipStatus.INACTIVE)
    await factory.membership(club, status=MembershipStatus.PENDING)
    await factory.membership(club, status=MembershipStatus.REJECTED)

    court = await factory.court(club)
    base = datetime(2026, 9, 1, 15, tzinfo=UTC)
    await factory.reservation(court, ana, base, base + timedelta(hours=1))
    await factory.reservation(
        court,
        ana,
        base + timedelta(days=3),
        base + timedelta(days=3, hours=1),
        status=ReservationStatus.CANCELLED,
    )
    manager = await _staff_client(client, factory, club, StaffRole.RESERVATIONS_MANAGER)
    numbered = await manager.patch(f"{MEMBERS}/{m_beto.id}", json={"member_number": "A-17"})
    assert numbered.status_code == 200

    page = (await manager.get(MEMBERS)).json()
    assert page["total"] == 3  # aprobados e inactivos, sin solicitudes
    assert [m["user"]["first_name"] for m in page["items"]] == ["Beto", "Carla", "Ana"]
    first_ana = next(m for m in page["items"] if m["id"] == str(m_ana.id))
    assert first_ana["plan"]["name"] == "Oro"
    assert first_ana["last_reservation_at"] == "2026-09-01T15:00:00Z"
    assert "password_hash" not in first_ana["user"]

    async def names(**params: str) -> list[str]:
        response = await manager.get(MEMBERS, params=params)
        assert response.status_code == 200, response.text
        return [m["user"]["first_name"] for m in response.json()["items"]]

    assert await names(search="ana zap") == ["Ana"]
    assert await names(search="BETO@CLUB") == ["Beto"]
    assert await names(search="30111") == ["Ana"]
    assert await names(search="a-17") == ["Beto"]
    assert await names(search="%") == []
    assert await names(status="INACTIVE") == ["Carla"]
    assert await names(plan_id=str(gold.id)) == ["Ana"]

    paged = (await manager.get(MEMBERS, params={"page": 2, "page_size": 2})).json()
    assert (paged["total"], len(paged["items"])) == (3, 1)
    assert (await manager.get(MEMBERS, params={"page_size": 500})).status_code == 422

    detail = await manager.get(f"{MEMBERS}/{m_ana.id}")
    assert detail.json()["user"]["dni"] == "30111222"


async def test_member_stats(client: httpx.AsyncClient, factory: Factory) -> None:
    club = await factory.club(timezone="America/Argentina/Buenos_Aires")
    owner = await _staff_client(client, factory, club)
    _, old = await factory.membership(club)
    await factory.membership(club, status=MembershipStatus.INACTIVE)
    await factory.membership(club, status=MembershipStatus.PENDING)
    await factory.membership(club, status=MembershipStatus.REJECTED)
    response = await owner.patch(f"{MEMBERS}/{old.id}", json={"joined_on": "2020-01-15"})
    assert response.status_code == 200
    created = await owner.post(
        MEMBERS, json={"email": "nueva@example.com", "first_name": "N", "last_name": "N"}
    )
    assert created.status_code == 201

    stats = (await owner.get(f"{MEMBERS}/stats")).json()
    assert stats == {
        "pending": 1,
        "approved": 2,
        "inactive": 1,
        "rejected": 1,
        "joined_this_month": 1,
    }


async def test_staff_creates_a_member_with_a_new_account(
    client: httpx.AsyncClient,
    factory: Factory,
    outbox: list[tuple[str, str]],
    owner_sessionmaker: async_sessionmaker[AsyncSession],
) -> None:
    club = await factory.club(name="Los Cardos")
    plan = await factory.plan(club)
    owner = await _staff_client(client, factory, club)

    response = await owner.post(
        MEMBERS,
        json={
            "email": "Socia@Example.com",
            "first_name": "Lucía",
            "last_name": "Pérez",
            "phone": "1155554444",
            "dni": "28999888",
            "plan_id": str(plan.id),
            "member_number": "100",
        },
    )
    assert response.status_code == 201, response.text
    member = response.json()
    assert member["status"] == "APPROVED"
    assert member["member_number"] == "100"
    assert member["plan"]["id"] == str(plan.id)
    assert member["joined_on"] is not None
    assert member["decided_at"] is not None
    assert member["user"]["email"] == "socia@example.com"

    # Se le manda un link para elegir contraseña; con él puede entrar a la app.
    assert len(outbox) == 1
    assert outbox[0][0] == "socia@example.com"
    match = re.search(r"token=([\w-]+)", outbox[0][1])
    assert match
    guest = _new_client(client)
    reset = await guest.post(
        "/api/v1/auth/password/reset",
        json={"token": match.group(1), "new_password": "una-clave-nueva-1"},
    )
    assert reset.status_code == 204
    login = await guest.post(
        "/api/v1/auth/mobile/login",
        json={"identifier": "28999888", "password": "una-clave-nueva-1"},
    )
    assert login.status_code == 200
    assert [m["status"] for m in login.json()["memberships"]] == ["APPROVED"]

    user = await _user_row(owner_sessionmaker, "socia@example.com")
    assert user is not None and user.email_verified_at is not None

    duplicated = await owner.post(
        MEMBERS,
        json={
            "email": "otra@example.com",
            "first_name": "O",
            "last_name": "O",
            "member_number": "100",
        },
    )
    assert duplicated.status_code == 409
    assert await _user_row(owner_sessionmaker, "otra@example.com") is None


async def test_creating_a_member_with_an_existing_account_keeps_its_identity(
    client: httpx.AsyncClient,
    factory: Factory,
    outbox: list[tuple[str, str]],
    owner_sessionmaker: async_sessionmaker[AsyncSession],
) -> None:
    club = await factory.club()
    person = await factory.user(first_name="Original", last_name="Nombre", dni="20111222")
    _, membership = await factory.membership(club, person, status=MembershipStatus.INACTIVE)
    owner = await _staff_client(client, factory, club)

    body = {
        "email": person.email.upper(),
        "first_name": "Cambiado",
        "last_name": "Otro",
        "dni": "99888777",
        "phone": "123",
    }
    response = await owner.post(MEMBERS, json=body)
    assert response.status_code == 201, response.text
    member = response.json()
    assert member["id"] == str(membership.id)  # reactiva la misma membresía
    assert member["status"] == "APPROVED"
    assert member["user"]["first_name"] == "Original"
    assert outbox == []

    user = await _user_row(owner_sessionmaker, person.email)
    assert user is not None
    assert (user.first_name, user.last_name, user.dni, user.phone) == (
        "Original",
        "Nombre",
        "20111222",
        None,
    )

    again = await owner.post(MEMBERS, json=body)
    assert again.status_code == 409
    assert again.json()["error"]["code"] == "already_member"


async def test_a_member_of_two_clubs_has_independent_plan_and_number(
    client: httpx.AsyncClient, factory: Factory
) -> None:
    club_a = await factory.club()
    club_b = await factory.club()
    plan_a = await factory.plan(club_a, "Plan A")
    plan_b = await factory.plan(club_b, "Plan B")
    person = await factory.user()
    owner_a = await _staff_client(client, factory, club_a)
    owner_b = await _staff_client(client, factory, club_b)

    base = {"email": person.email, "first_name": "x", "last_name": "y"}
    in_a = await owner_a.post(
        MEMBERS, json={**base, "plan_id": str(plan_a.id), "member_number": "1"}
    )
    in_b = await owner_b.post(
        MEMBERS, json={**base, "plan_id": str(plan_b.id), "member_number": "2"}
    )
    assert in_a.status_code == in_b.status_code == 201

    deactivated = await owner_a.patch(f"{MEMBERS}/{in_a.json()['id']}", json={"status": "INACTIVE"})
    assert deactivated.json()["status"] == "INACTIVE"

    headers = await login_mobile(client, person)
    mine = {
        m["club"]["id"]: m
        for m in (await client.get(f"{MOBILE}/memberships", headers=headers)).json()
    }
    assert mine[str(club_a.id)]["status"] == "INACTIVE"
    assert mine[str(club_a.id)]["member_number"] == "1"
    assert mine[str(club_a.id)]["plan"] is None  # el plan solo se muestra si está vigente
    assert mine[str(club_b.id)]["status"] == "APPROVED"
    assert mine[str(club_b.id)]["member_number"] == "2"
    assert mine[str(club_b.id)]["plan"]["name"] == "Plan B"


async def test_update_member(client: httpx.AsyncClient, factory: Factory) -> None:
    club = await factory.club()
    plan = await factory.plan(club, "Nuevo")
    person, membership = await factory.membership(club)
    _, pending = await factory.membership(club, status=MembershipStatus.PENDING)
    owner = await _staff_client(client, factory, club)
    url = f"{MEMBERS}/{membership.id}"

    response = await owner.patch(
        url,
        json={
            "plan_id": str(plan.id),
            "member_number": "B-9",
            "joined_on": "2024-03-01",
            "notes": "Paga en efectivo",
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert (data["plan"]["name"], data["member_number"], data["joined_on"], data["notes"]) == (
        "Nuevo",
        "B-9",
        "2024-03-01",
        "Paga en efectivo",
    )
    cleared = (await owner.patch(url, json={"plan_id": None, "notes": None})).json()
    assert (cleared["plan"], cleared["notes"]) == (None, None)

    assert (await owner.patch(url, json={"status": "PENDING"})).status_code == 422
    assert (await owner.patch(url, json={"joined_on": None})).status_code == 422
    not_decided = await owner.patch(f"{MEMBERS}/{pending.id}", json={"status": "APPROVED"})
    assert not_decided.status_code == 422

    # Dar de baja corta el acceso del socio a ese club, sin tocar su cuenta.
    headers = await login_mobile(client, person)
    assert (await owner.patch(url, json={"status": "INACTIVE"})).status_code == 200
    mine = (await client.get(f"{MOBILE}/memberships", headers=headers)).json()
    assert [m["status"] for m in mine] == ["INACTIVE"]

    manager = await _staff_client(client, factory, club, StaffRole.STOCK_MANAGER)
    assert (await manager.get(url)).status_code == 403
    assert (await manager.patch(url, json={"notes": "x"})).status_code == 403


async def test_members_write_and_export_permissions(
    client: httpx.AsyncClient, factory: Factory
) -> None:
    club = await factory.club()
    _, membership = await factory.membership(club)
    stock = await _staff_client(client, factory, club, StaffRole.STOCK_MANAGER)
    manager = await _staff_client(client, factory, club, StaffRole.RESERVATIONS_MANAGER)
    body = {"email": "n@example.com", "first_name": "N", "last_name": "N"}

    assert (await stock.get(MEMBERS)).status_code == 403
    assert (await stock.get(f"{MEMBERS}/stats")).status_code == 403
    assert (await stock.get(REQUESTS)).status_code == 403
    assert (await stock.post(MEMBERS, json=body)).status_code == 403
    assert (await stock.post(f"{REQUESTS}/{membership.id}/reject")).status_code == 403
    # RESERVATIONS_MANAGER gestiona socios pero no exporta.
    assert (await manager.post(MEMBERS, json=body)).status_code == 201
    assert (await manager.get(f"{MEMBERS}/export.csv")).status_code == 403


async def test_export_csv_neutralizes_formulas(client: httpx.AsyncClient, factory: Factory) -> None:
    club = await factory.club()
    plan = await factory.plan(club, "Oro")
    evil = await factory.user(first_name='=HYPERLINK("http://x")', last_name="Zeta")
    await factory.membership(club, evil, plan=plan)
    await factory.membership(club, status=MembershipStatus.PENDING)
    owner = await _staff_client(client, factory, club)

    response = await owner.get(f"{MEMBERS}/export.csv")
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/csv")
    assert "socios_" in response.headers["content-disposition"]
    rows = list(csv.reader(io.StringIO(response.text.lstrip("﻿"))))
    assert rows[0][:3] == ["N° socio", "Apellido", "Nombre"]
    assert len(rows) == 2  # sin la solicitud pendiente
    assert rows[1][2] == '\'=HYPERLINK("http://x")'
    assert rows[1][6] == "Oro"
    assert rows[1][8] == "Activo"


# ── Solicitudes ─────────────────────────────────────────────────────────────


async def test_membership_request_flow(client: httpx.AsyncClient, factory: Factory) -> None:
    club = await factory.club()
    plan = await factory.plan(club)
    owner_user, _ = await factory.staff(club)
    owner = _new_client(client)
    await login_web(owner, owner_user)
    person = await factory.user()
    headers = await login_mobile(client, person)
    url = f"{MOBILE}/clubs/{club.id}/membership-requests"

    created = await client.post(url, headers=headers)
    assert created.status_code == 201, created.text
    request = created.json()
    assert request["status"] == "PENDING"
    assert request["requested_at"] is not None
    assert request["club"]["id"] == str(club.id)
    again = await client.post(url, headers=headers)
    assert again.status_code == 200
    assert again.json()["id"] == request["id"]

    pending = (await owner.get(REQUESTS)).json()
    assert [r["id"] for r in pending["items"]] == [request["id"]]

    approved = await owner.post(
        f"{REQUESTS}/{request['id']}/approve",
        json={"plan_id": str(plan.id), "member_number": "55"},
    )
    assert approved.status_code == 200, approved.text
    data = approved.json()
    assert (data["status"], data["member_number"], data["plan"]["id"]) == (
        "APPROVED",
        "55",
        str(plan.id),
    )
    assert data["joined_on"] is not None and data["decided_at"] is not None
    assert (await owner.get(REQUESTS)).json()["total"] == 0
    assert (await owner.post(f"{REQUESTS}/{request['id']}/reject")).status_code == 409
    # Un socio aprobado que vuelve a pedir el alta no cambia nada.
    assert (await client.post(url, headers=headers)).json()["status"] == "APPROVED"

    mine = (await client.get(f"{MOBILE}/memberships", headers=headers)).json()
    assert [(m["status"], m["plan"]["id"]) for m in mine] == [("APPROVED", str(plan.id))]


async def test_rejected_request_can_be_requested_again(
    client: httpx.AsyncClient,
    factory: Factory,
    owner_sessionmaker: async_sessionmaker[AsyncSession],
) -> None:
    club = await factory.club()
    owner_user, _ = await factory.staff(club)
    owner = _new_client(client)
    await login_web(owner, owner_user)
    person = await factory.user()
    headers = await login_mobile(client, person)
    url = f"{MOBILE}/clubs/{club.id}/membership-requests"

    request_id = (await client.post(url, headers=headers)).json()["id"]
    rejected = await owner.post(f"{REQUESTS}/{request_id}/reject")
    assert rejected.json()["status"] == "REJECTED"
    row = await _membership_row(owner_sessionmaker, request_id)
    assert row is not None and row.decided_by_id == owner_user.id and row.decided_at is not None

    again = await client.post(url, headers=headers)
    assert (again.status_code, again.json()["status"], again.json()["id"]) == (
        200,
        "PENDING",
        request_id,
    )
    row = await _membership_row(owner_sessionmaker, request_id)
    assert row is not None and row.decided_at is None and row.decided_by_id is None


async def test_membership_request_requires_verified_email_and_active_club(
    client: httpx.AsyncClient, factory: Factory
) -> None:
    club = await factory.club()
    closed = await factory.club(is_active=False)
    unverified = await factory.user(email_verified_at=None)
    verified = await factory.user()

    headers = await login_mobile(client, unverified)
    response = await client.post(f"{MOBILE}/clubs/{club.id}/membership-requests", headers=headers)
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "email_not_verified"

    headers = await login_mobile(client, verified)
    response = await client.post(f"{MOBILE}/clubs/{closed.id}/membership-requests", headers=headers)
    assert response.status_code == 404


async def test_concurrent_requests_and_decisions(
    client: httpx.AsyncClient,
    factory: Factory,
    owner_sessionmaker: async_sessionmaker[AsyncSession],
) -> None:
    club = await factory.club()
    person = await factory.user()
    headers = await login_mobile(client, person)
    url = f"{MOBILE}/clubs/{club.id}/membership-requests"

    first, second = await asyncio.gather(
        client.post(url, headers=headers), client.post(url, headers=headers)
    )
    assert sorted([first.status_code, second.status_code]) == [200, 201]
    assert first.json()["id"] == second.json()["id"]

    owner_a = await _staff_client(client, factory, club)
    owner_b = await _staff_client(client, factory, club)
    request_id = first.json()["id"]
    approve, reject = await asyncio.gather(
        owner_a.post(f"{REQUESTS}/{request_id}/approve"),
        owner_b.post(f"{REQUESTS}/{request_id}/reject"),
    )
    assert sorted([approve.status_code, reject.status_code]) == [200, 409]
    row = await _membership_row(owner_sessionmaker, request_id)
    winner = approve if approve.status_code == 200 else reject
    assert row is not None and row.status == winner.json()["status"]


# ── Aislación entre clubes (SEC-01) ─────────────────────────────────────────


async def test_staff_cannot_see_or_touch_members_of_another_club(
    client: httpx.AsyncClient,
    factory: Factory,
    owner_sessionmaker: async_sessionmaker[AsyncSession],
) -> None:
    club_a = await factory.club()
    club_b = await factory.club()
    plan_b = await factory.plan(club_b, "Plan B")
    _, member_b = await factory.membership(club_b)
    _, request_b = await factory.membership(club_b, status=MembershipStatus.PENDING)
    _, member_a = await factory.membership(club_a)
    owner_a = await _staff_client(client, factory, club_a)

    listed = (await owner_a.get(MEMBERS)).json()
    assert [m["id"] for m in listed["items"]] == [str(member_a.id)]
    assert (await owner_a.get(REQUESTS)).json()["total"] == 0
    assert (await owner_a.get(f"{MEMBERS}/stats")).json()["approved"] == 1
    export = await owner_a.get(f"{MEMBERS}/export.csv")
    assert len(list(csv.reader(io.StringIO(export.text)))) == 2

    assert (await owner_a.get(f"{MEMBERS}/{member_b.id}")).status_code == 404
    patch_b = await owner_a.patch(f"{MEMBERS}/{member_b.id}", json={"status": "INACTIVE"})
    assert patch_b.status_code == 404
    assert (await owner_a.post(f"{REQUESTS}/{request_b.id}/approve")).status_code == 404
    assert (await owner_a.post(f"{REQUESTS}/{request_b.id}/reject")).status_code == 404
    assert (await owner_a.patch(f"{PLANS}/{plan_b.id}", json={"name": "x"})).status_code == 404
    assert (await owner_a.delete(f"{PLANS}/{plan_b.id}")).status_code == 404
    assert (await owner_a.get(PLANS)).json() == []

    # Ids de otro club en el body.
    cross_plan = await owner_a.patch(f"{MEMBERS}/{member_a.id}", json={"plan_id": str(plan_b.id)})
    assert cross_plan.status_code == 404
    cross_create = await owner_a.post(
        MEMBERS,
        json={
            "email": "z@example.com",
            "first_name": "Z",
            "last_name": "Z",
            "plan_id": str(plan_b.id),
        },
    )
    assert cross_create.status_code == 404
    cross_approve = await owner_a.post(
        f"{REQUESTS}/{request_b.id}/approve", json={"plan_id": str(plan_b.id)}
    )
    assert cross_approve.status_code == 404

    for membership_id, status in ((member_b.id, "APPROVED"), (request_b.id, "PENDING")):
        row = await _membership_row(owner_sessionmaker, membership_id)
        assert row is not None and row.status == status


# ── Directorio de clubes (app) ──────────────────────────────────────────────


async def test_clubs_directory_shows_my_membership_status(
    client: httpx.AsyncClient, factory: Factory
) -> None:
    mine = await factory.club(name="Alfa", city="Rosario")
    other = await factory.club(name="Beta", city="Córdoba")
    await factory.club(name="Cerrado", is_active=False)
    person = await factory.user()
    await factory.membership(mine, person, status=MembershipStatus.PENDING)
    headers = await login_mobile(client, person)

    clubs = (await client.get(f"{MOBILE}/clubs", headers=headers)).json()
    assert [(c["name"], c["my_membership_status"]) for c in clubs] == [
        ("Alfa", "PENDING"),
        ("Beta", None),
    ]
    found = (await client.get(f"{MOBILE}/clubs", params={"search": "córd"}, headers=headers)).json()
    assert [c["id"] for c in found] == [str(other.id)]
    assert (await client.get(f"{MOBILE}/clubs")).status_code == 401
