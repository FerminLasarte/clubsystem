import asyncio
from datetime import UTC, date, datetime, time, timedelta
from decimal import Decimal
from uuid import UUID
from zoneinfo import ZoneInfo

import httpx
from sqlalchemy import select

from app.domain.enums import (
    CancelReason,
    CustomerType,
    MembershipStatus,
    ReservationStatus,
    Sport,
    StaffRole,
    TransactionType,
)
from app.models import Club, Reservation
from app.workers.reservations import expire_unconfirmed_reservations
from tests.factories import Factory, login_mobile, login_web

ADMIN = "/api/v1/admin/reservations"
MOBILE = "/api/v1/mobile"


def future_day(club: Club, days: int = 7) -> date:
    return datetime.now(ZoneInfo(club.timezone)).date() + timedelta(days=days)


def at(club: Club, day: date, hour: int, minute: int = 0) -> datetime:
    return datetime.combine(day, time(hour, minute), tzinfo=ZoneInfo(club.timezone))


async def _open_club(factory: Factory, **kw: object) -> Club:
    return await factory.club(open_time=time(8), close_time=time(23), **kw)


# ── Panel ─────────────────────────────────────────────────────────────────────


async def test_staff_creates_member_and_guest_reservations_and_lists_the_day(
    client: httpx.AsyncClient, factory: Factory
) -> None:
    club = await _open_club(factory)
    manager, _ = await factory.staff(club, roles=[StaffRole.RESERVATIONS_MANAGER])
    player, membership = await factory.membership(club)
    court = await factory.court(club, name="Central")
    day = future_day(club)
    await login_web(client, manager)

    member = await client.post(
        ADMIN,
        json={
            "court_id": str(court.id),
            "membership_id": str(membership.id),
            "starts_at": at(club, day, 18).isoformat(),
            "ends_at": at(club, day, 19, 30).isoformat(),
            "notes": "Trae paletas",
        },
    )
    assert member.status_code == 201, member.text
    body = member.json()
    assert body["status"] == "confirmed"
    assert body["source"] == "PANEL"
    assert body["customer_type"] == "MEMBER"
    assert body["customer_name"] == player.full_name
    assert body["membership_id"] == str(membership.id)
    assert body["duration_minutes"] == 90
    assert body["total_price"] == "12000.00"  # 8000/h de socio × 1,5 h
    assert body["paid_amount"] == "0.00"

    guest = await client.post(
        ADMIN,
        json={
            "court_id": str(court.id),
            "guest_name": "Juan Invitado",
            "guest_phone": "1122334455",
            "starts_at": at(club, day, 20).isoformat(),
            "ends_at": at(club, day, 21).isoformat(),
        },
    )
    assert guest.status_code == 201
    assert guest.json()["customer_type"] == "GUEST"
    assert guest.json()["customer_phone"] == "1122334455"
    assert guest.json()["total_price"] == "12000.00"  # 12000/h de invitado

    free = await client.post(
        ADMIN,
        json={
            "court_id": str(court.id),
            "guest_name": "Cortesía",
            "starts_at": at(club, day, 9).isoformat(),
            "ends_at": at(club, day, 10).isoformat(),
            "price_override": "0",
        },
    )
    assert free.json()["total_price"] == "0.00"

    reservation = await factory.session.get(Reservation, UUID(body["id"]))
    assert reservation is not None
    await factory.reservation_payment(reservation, "5000")
    await factory.reservation_payment(reservation, "1000", voided_at=datetime.now(UTC))
    await factory.reservation_payment(reservation, "500", type=TransactionType.OUTFLOW)

    day_list = await client.get(ADMIN, params={"date": day.isoformat(), "page_size": 200})
    assert day_list.status_code == 200, day_list.text
    items = day_list.json()["items"]
    assert [i["customer_name"] for i in items] == ["Cortesía", player.full_name, "Juan Invitado"]
    assert items[1]["court_name"] == "Central"
    assert items[1]["paid_amount"] == "4500.00"
    assert items[1]["notes"] == "Trae paletas"

    other_day = await client.get(ADMIN, params={"date": (day + timedelta(days=1)).isoformat()})
    assert other_day.json()["total"] == 0

    detail = await client.get(f"{ADMIN}/{body['id']}")
    assert detail.json()["paid_amount"] == "4500.00"


async def test_history_is_paginated_and_filtered(
    client: httpx.AsyncClient, factory: Factory
) -> None:
    club = await factory.club()
    owner, _ = await factory.staff(club)
    player = await factory.user()
    court = await factory.court(club)
    base = datetime(2026, 1, 10, 15, tzinfo=UTC)
    for i in range(3):
        start = base + timedelta(days=i)
        await factory.reservation(
            court, player, start, start + timedelta(hours=1), status=ReservationStatus.COMPLETED
        )
    await factory.reservation(
        court,
        player,
        base + timedelta(hours=3),
        base + timedelta(hours=4),
        status=ReservationStatus.CANCELLED,
        cancel_reason=CancelReason.BY_STAFF,
    )
    await login_web(client, owner)

    page = await client.get(
        ADMIN,
        params={
            "from": "2026-01-01",
            "to": "2026-01-31",
            "status": "completed",
            "sort": "-starts_at",
            "page_size": 2,
        },
    )
    assert page.status_code == 200
    data = page.json()
    assert data["total"] == 3
    assert len(data["items"]) == 2
    assert data["items"][0]["starts_at"] > data["items"][1]["starts_at"]

    assert (await client.get(ADMIN)).status_code == 422
    both = await client.get(ADMIN, params={"date": "2026-01-10", "from": "2026-01-01"})
    assert both.status_code == 422
    reversed_range = await client.get(ADMIN, params={"from": "2026-01-31", "to": "2026-01-01"})
    assert reversed_range.status_code == 422

    csv = await client.get(f"{ADMIN}/export", params={"from": "2026-01-01", "to": "2026-01-31"})
    assert csv.status_code == 200
    assert csv.headers["content-type"].startswith("text/csv")
    assert len(csv.text.strip().splitlines()) == 5  # encabezado + 4 reservas


async def test_grid_returns_active_courts_with_the_day_reservations(
    client: httpx.AsyncClient, factory: Factory
) -> None:
    club = await _open_club(factory)
    owner, _ = await factory.staff(club)
    player = await factory.user()
    court_a = await factory.court(club, name="A")
    court_b = await factory.court(club, name="B")
    await factory.court(club, name="Z", is_active=False)
    retired = await factory.court(club, name="Vieja", is_active=False)
    day = future_day(club)
    await factory.reservation(court_a, player, at(club, day, 10), at(club, day, 11))
    await factory.reservation(retired, player, at(club, day, 9), at(club, day, 10))
    await factory.reservation(
        court_a,
        player,
        at(club, day, 12),
        at(club, day, 13),
        status=ReservationStatus.CANCELLED,
        cancel_reason=CancelReason.BY_STAFF,
    )
    await login_web(client, owner)

    grid = await client.get(f"{ADMIN}/grid", params={"date": day.isoformat()})
    assert grid.status_code == 200
    data = grid.json()
    assert data["open_time"] == "08:00:00"
    assert data["slot_minutes"] == 30
    assert [(c["name"], c["is_active"]) for c in data["courts"]] == [
        ("A", True),
        ("B", True),
        ("Vieja", False),
    ]
    assert len(data["courts"][0]["reservations"]) == 1
    assert data["courts"][1]["id"] == str(court_b.id)
    assert data["courts"][1]["reservations"] == []


async def test_reservation_permissions(client: httpx.AsyncClient, factory: Factory) -> None:
    club = await factory.club()
    clerk, _ = await factory.staff(club, roles=[StaffRole.STOCK_MANAGER])
    court = await factory.court(club)
    await login_web(client, clerk)

    assert (await client.get(ADMIN, params={"date": "2026-01-01"})).status_code == 403
    assert (await client.get(f"{ADMIN}/grid", params={"date": "2026-01-01"})).status_code == 403
    created = await client.post(
        ADMIN,
        json={
            "court_id": str(court.id),
            "guest_name": "X",
            "starts_at": "2030-01-01T10:00:00-03:00",
            "ends_at": "2030-01-01T11:00:00-03:00",
        },
    )
    assert created.status_code == 403


async def test_staff_reservation_validations(client: httpx.AsyncClient, factory: Factory) -> None:
    club = await _open_club(factory)
    owner, _ = await factory.staff(club)
    _, pending = await factory.membership(club, status=MembershipStatus.PENDING)
    court = await factory.court(club)
    inactive = await factory.court(club, is_active=False)
    day = future_day(club)
    await login_web(client, owner)

    def payload(**kw: object) -> dict[str, object]:
        return {
            "court_id": str(court.id),
            "guest_name": "Invitado",
            "starts_at": at(club, day, 10).isoformat(),
            "ends_at": at(club, day, 11).isoformat(),
            **kw,
        }

    late = await client.post(
        ADMIN,
        json=payload(
            starts_at=at(club, day, 22, 30).isoformat(), ends_at=at(club, day, 23, 30).isoformat()
        ),
    )
    assert late.status_code == 422
    assert late.json()["error"]["code"] == "outside_hours"
    early = await client.post(
        ADMIN,
        json=payload(starts_at=at(club, day, 7).isoformat(), ends_at=at(club, day, 9).isoformat()),
    )
    assert early.status_code == 422
    naive = await client.post(ADMIN, json=payload(starts_at="2030-01-01T10:00:00"))
    assert naive.status_code == 422
    both = await client.post(ADMIN, json=payload(membership_id=str(pending.id)))
    assert both.status_code == 422
    not_approved = await client.post(
        ADMIN, json=payload(guest_name=None, membership_id=str(pending.id))
    )
    assert not_approved.status_code == 422
    assert not_approved.json()["error"]["code"] == "member_not_approved"
    off = await client.post(ADMIN, json=payload(court_id=str(inactive.id)))
    assert off.status_code == 422
    assert (await client.post(ADMIN, json=payload(price_override="-1"))).status_code == 422

    assert (await client.post(ADMIN, json=payload())).status_code == 201
    overlap = await client.post(
        ADMIN,
        json=payload(
            starts_at=at(club, day, 10, 30).isoformat(), ends_at=at(club, day, 11, 30).isoformat()
        ),
    )
    assert overlap.status_code == 409


async def test_staff_cannot_use_resources_of_another_club(
    client: httpx.AsyncClient, factory: Factory
) -> None:
    club_a, club_b = await _open_club(factory), await _open_club(factory)
    owner_a, _ = await factory.staff(club_a)
    court_a = await factory.court(club_a)
    court_b = await factory.court(club_b)
    player_b, membership_b = await factory.membership(club_b)
    day = future_day(club_a)
    reservation_b = await factory.reservation(
        court_b,
        player_b,
        at(club_b, day, 10),
        at(club_b, day, 11),
        status=ReservationStatus.PENDING,
    )
    await login_web(client, owner_a)

    times = {
        "starts_at": at(club_a, day, 12).isoformat(),
        "ends_at": at(club_a, day, 13).isoformat(),
    }
    with_court_b = await client.post(
        ADMIN, json={"court_id": str(court_b.id), "guest_name": "X", **times}
    )
    assert with_court_b.status_code == 404
    with_member_b = await client.post(
        ADMIN, json={"court_id": str(court_a.id), "membership_id": str(membership_b.id), **times}
    )
    assert with_member_b.status_code == 404

    rid = reservation_b.id
    assert (await client.get(f"{ADMIN}/{rid}")).status_code == 404
    assert (await client.post(f"{ADMIN}/{rid}/confirm")).status_code == 404
    assert (await client.post(f"{ADMIN}/{rid}/cancel")).status_code == 404
    assert (await client.patch(f"{ADMIN}/{rid}", json={"notes": "x"})).status_code == 404
    assert (await client.get(ADMIN, params={"date": day.isoformat()})).json()["total"] == 0
    grid = (await client.get(f"{ADMIN}/grid", params={"date": day.isoformat()})).json()
    assert [c["id"] for c in grid["courts"]] == [str(court_a.id)]

    # Reprogramar una reserva propia a una cancha de otro club tampoco.
    own = await client.post(ADMIN, json={"court_id": str(court_a.id), "guest_name": "Y", **times})
    moved = await client.patch(f"{ADMIN}/{own.json()['id']}", json={"court_id": str(court_b.id)})
    assert moved.status_code == 404


async def test_confirm_cancel_and_reschedule(client: httpx.AsyncClient, factory: Factory) -> None:
    club = await _open_club(factory)
    owner, _ = await factory.staff(club)
    player = await factory.user()
    court = await factory.court(club)
    other_court = await factory.court(club, price_member=Decimal("10000"))
    day = future_day(club)
    pending = await factory.reservation(
        court, player, at(club, day, 10), at(club, day, 11), status=ReservationStatus.PENDING
    )
    await factory.reservation(other_court, player, at(club, day, 15), at(club, day, 16))
    await login_web(client, owner)

    confirmed = await client.post(f"{ADMIN}/{pending.id}/confirm")
    assert confirmed.status_code == 200
    assert confirmed.json()["status"] == "confirmed"
    assert confirmed.json()["confirmed_at"] is not None
    assert (await client.post(f"{ADMIN}/{pending.id}/confirm")).status_code == 409

    notes = await client.patch(f"{ADMIN}/{pending.id}", json={"notes": "Pagó en efectivo"})
    assert notes.json()["notes"] == "Pagó en efectivo"

    # Mismo largo y cancha: el precio no cambia.
    shifted = await client.patch(
        f"{ADMIN}/{pending.id}",
        json={"starts_at": at(club, day, 12).isoformat(), "ends_at": at(club, day, 13).isoformat()},
    )
    assert shifted.status_code == 200
    assert shifted.json()["total_price"] == "8000.00"
    # Otra cancha y 2 h: se recalcula con la tarifa de socio de esa cancha.
    moved = await client.patch(
        f"{ADMIN}/{pending.id}",
        json={
            "court_id": str(other_court.id),
            "starts_at": at(club, day, 12).isoformat(),
            "ends_at": at(club, day, 14).isoformat(),
        },
    )
    assert moved.status_code == 200
    assert moved.json()["court_id"] == str(other_court.id)
    assert moved.json()["total_price"] == "20000.00"
    overlap = await client.patch(
        f"{ADMIN}/{pending.id}",
        json={"starts_at": at(club, day, 15).isoformat(), "ends_at": at(club, day, 16).isoformat()},
    )
    assert overlap.status_code == 409
    outside = await client.patch(
        f"{ADMIN}/{pending.id}",
        json={
            "starts_at": at(club, day, 22).isoformat(),
            "ends_at": at(club, day, 23, 30).isoformat(),
        },
    )
    assert outside.status_code == 422
    half = await client.patch(
        f"{ADMIN}/{pending.id}", json={"starts_at": at(club, day, 9).isoformat()}
    )
    assert half.status_code == 422

    cancelled = await client.post(f"{ADMIN}/{pending.id}/cancel")
    assert cancelled.status_code == 200
    assert cancelled.json()["status"] == "cancelled"
    assert cancelled.json()["cancel_reason"] == "BY_STAFF"
    assert (await client.post(f"{ADMIN}/{pending.id}/cancel")).status_code == 409
    after = await client.patch(
        f"{ADMIN}/{pending.id}",
        json={"starts_at": at(club, day, 18).isoformat(), "ends_at": at(club, day, 19).isoformat()},
    )
    assert after.status_code == 409
    cancelled_by = (
        await factory.session.execute(
            select(Reservation.cancelled_by_id).where(Reservation.id == pending.id)
        )
    ).scalar_one()
    assert cancelled_by == owner.id


# ── App del socio ─────────────────────────────────────────────────────────────


async def test_member_books_from_availability_and_staff_confirms(
    client: httpx.AsyncClient, factory: Factory
) -> None:
    club = await _open_club(factory)
    owner, _ = await factory.staff(club)
    member, _ = await factory.membership(club)
    court = await factory.court(club, name="Central")
    await factory.court(club, name="Tenis", sport=Sport.TENNIS)
    other = await factory.user()
    day = future_day(club)
    await factory.reservation(court, other, at(club, day, 10), at(club, day, 11))
    headers = await login_mobile(client, member)

    availability = await client.get(
        f"{MOBILE}/clubs/{club.id}/availability",
        params={"date": day.isoformat(), "sport": "padel", "duration": 90},
        headers=headers,
    )
    assert availability.status_code == 200, availability.text
    data = availability.json()
    assert data["duration_minutes"] == 90
    [central] = data["courts"]
    assert central["price"] == "12000.00"
    starts = [datetime.fromisoformat(s["starts_at"]) for s in central["slots"]]
    assert starts[0] == at(club, day, 8)
    assert at(club, day, 9) not in starts  # 09:00–10:30 pisa la reserva de las 10
    assert at(club, day, 11) in starts
    assert starts[-1] == at(club, day, 21, 30)

    created = await client.post(
        f"{MOBILE}/clubs/{club.id}/reservations",
        json={
            "court_id": str(court.id),
            "starts_at": central["slots"][-1]["starts_at"],
            "duration_minutes": 90,
        },
        headers=headers,
    )
    assert created.status_code == 201, created.text
    mine = created.json()
    assert mine["status"] == "pending"
    assert mine["total_price"] == "12000.00"
    assert mine["club"]["id"] == str(club.id)
    assert mine["court"]["name"] == "Central"

    again = await client.get(
        f"{MOBILE}/clubs/{club.id}/availability",
        params={"date": day.isoformat(), "duration": 90},
        headers=headers,
    )
    slots = next(c for c in again.json()["courts"] if c["court_id"] == str(court.id))["slots"]
    assert central["slots"][-1] not in slots

    upcoming = await client.get(f"{MOBILE}/reservations", headers=headers)
    assert upcoming.json()["total"] == 1
    assert upcoming.json()["items"][0]["id"] == mine["id"]
    assert (
        await client.get(f"{MOBILE}/reservations/{mine['id']}", headers=headers)
    ).status_code == 200

    await login_web(client, owner)
    staff_view = await client.get(f"{ADMIN}/{mine['id']}")
    assert staff_view.json()["source"] == "APP"
    assert staff_view.json()["customer_type"] == CustomerType.MEMBER
    assert (await client.post(f"{ADMIN}/{mine['id']}/confirm")).status_code == 200
    detail = await client.get(f"{MOBILE}/reservations/{mine['id']}", headers=headers)
    assert detail.json()["status"] == "confirmed"


async def test_member_booking_rules(client: httpx.AsyncClient, factory: Factory) -> None:
    club, other_club = await _open_club(factory), await _open_club(factory)
    member, _ = await factory.membership(club)
    court = await factory.court(club)
    inactive = await factory.court(club, is_active=False)
    foreign_court = await factory.court(other_club)
    day = future_day(club)
    headers = await login_mobile(client, member)
    url = f"{MOBILE}/clubs/{club.id}/reservations"

    def payload(**kw: object) -> dict[str, object]:
        return {
            "court_id": str(court.id),
            "starts_at": at(club, day, 10).isoformat(),
            "duration_minutes": 60,
            **kw,
        }

    late = await client.post(
        url, json=payload(starts_at=at(club, day, 22, 30).isoformat()), headers=headers
    )
    assert late.status_code == 422
    assert late.json()["error"]["code"] == "outside_hours"
    past = datetime.now(UTC).replace(microsecond=0) - timedelta(hours=1)
    assert (
        await client.post(url, json=payload(starts_at=past.isoformat()), headers=headers)
    ).status_code == 422
    off_grid = await client.post(
        url, json=payload(starts_at=at(club, day, 10, 15).isoformat()), headers=headers
    )
    assert off_grid.json()["error"]["code"] == "off_grid"
    assert (
        await client.post(url, json=payload(duration_minutes=45), headers=headers)
    ).status_code == 422
    assert (
        await client.post(url, json=payload(court_id=str(inactive.id)), headers=headers)
    ).status_code == 422
    assert (
        await client.post(url, json=payload(court_id=str(foreign_court.id)), headers=headers)
    ).status_code == 404
    availability = await client.get(
        f"{MOBILE}/clubs/{club.id}/availability",
        params={"date": day.isoformat(), "duration": 45},
        headers=headers,
    )
    assert availability.status_code == 422


async def test_non_members_cannot_book_from_the_app(
    client: httpx.AsyncClient, factory: Factory
) -> None:
    club = await _open_club(factory)
    court = await factory.court(club)
    pending, _ = await factory.membership(club, status=MembershipStatus.PENDING)
    stranger = await factory.user()
    day = future_day(club)
    body = {
        "court_id": str(court.id),
        "starts_at": at(club, day, 10).isoformat(),
        "duration_minutes": 60,
    }

    for user in (pending, stranger):
        headers = await login_mobile(client, user)
        created = await client.post(
            f"{MOBILE}/clubs/{club.id}/reservations", json=body, headers=headers
        )
        assert created.status_code == 403
        availability = await client.get(
            f"{MOBILE}/clubs/{club.id}/availability",
            params={"date": day.isoformat()},
            headers=headers,
        )
        assert availability.status_code == 403


async def test_concurrent_bookings_of_the_same_slot(
    client: httpx.AsyncClient, factory: Factory
) -> None:
    club = await _open_club(factory)
    court = await factory.court(club)
    first, _ = await factory.membership(club)
    second, _ = await factory.membership(club)
    day = future_day(club)
    headers = [await login_mobile(client, first), await login_mobile(client, second)]
    url = f"{MOBILE}/clubs/{club.id}/reservations"

    responses = await asyncio.gather(
        *(
            client.post(
                url,
                json={
                    "court_id": str(court.id),
                    "starts_at": at(club, day, start).isoformat(),
                    "duration_minutes": 120,
                },
                headers=h,
            )
            for h, start in zip(headers, (18, 19), strict=True)
        )
    )
    assert sorted(r.status_code for r in responses) == [201, 409]


async def test_members_only_see_their_own_reservations(
    client: httpx.AsyncClient, factory: Factory
) -> None:
    club = await _open_club(factory)
    court = await factory.court(club)
    alice, _ = await factory.membership(club)
    bob, _ = await factory.membership(club)
    day = future_day(club)
    bobs = await factory.reservation(court, bob, at(club, day, 10), at(club, day, 11))
    await factory.reservation(court, alice, at(club, day, 12), at(club, day, 13))
    headers = await login_mobile(client, alice)

    assert (
        await client.get(f"{MOBILE}/reservations/{bobs.id}", headers=headers)
    ).status_code == 404
    mine = await client.get(f"{MOBILE}/reservations", headers=headers)
    assert [r["court"]["id"] for r in mine.json()["items"]] == [str(court.id)]
    assert mine.json()["total"] == 1


async def test_my_reservations_across_clubs_and_past_scope(
    client: httpx.AsyncClient, factory: Factory
) -> None:
    club_a, club_b = await factory.club(name="A"), await factory.club(name="B")
    court_a, court_b = await factory.court(club_a), await factory.court(club_b)
    player, _ = await factory.membership(club_a)
    # En B ya no es socio aprobado: igual ve su historial (incluida la cancha).
    await factory.membership(club_b, user=player, status=MembershipStatus.INACTIVE)
    now = datetime.now(UTC).replace(microsecond=0)
    upcoming = await factory.reservation(
        court_a, player, now + timedelta(days=2), now + timedelta(days=2, hours=1)
    )
    done = await factory.reservation(
        court_b,
        player,
        now - timedelta(days=3),
        now - timedelta(days=3) + timedelta(hours=1),
        status=ReservationStatus.COMPLETED,
    )
    cancelled_future = await factory.reservation(
        court_a,
        player,
        now + timedelta(days=1),
        now + timedelta(days=1, hours=1),
        status=ReservationStatus.CANCELLED,
        cancel_reason=CancelReason.BY_STAFF,
    )
    headers = await login_mobile(client, player)

    up = (
        await client.get(f"{MOBILE}/reservations", params={"scope": "upcoming"}, headers=headers)
    ).json()
    assert [r["id"] for r in up["items"]] == [str(upcoming.id)]
    past = (
        await client.get(f"{MOBILE}/reservations", params={"scope": "past"}, headers=headers)
    ).json()
    assert [r["id"] for r in past["items"]] == [str(cancelled_future.id), str(done.id)]
    assert past["items"][1]["club"]["name"] == "B"
    assert past["items"][1]["court"]["id"] == str(court_b.id)
    assert (
        await client.get(f"{MOBILE}/reservations/{done.id}", headers=headers)
    ).status_code == 200


async def test_availability_uses_the_club_timezone_near_midnight(
    client: httpx.AsyncClient, factory: Factory
) -> None:
    club = await factory.club(timezone="Asia/Tokyo")  # UTC+9, abierto todo el día
    owner, _ = await factory.staff(club)
    member, _ = await factory.membership(club)
    court = await factory.court(club)
    other = await factory.user()
    day = future_day(club)
    # 23:00 local del día = 14:00 UTC del mismo día; 23:30 local del día anterior = 14:30 UTC.
    late = await factory.reservation(
        court, other, at(club, day, 23), at(club, day + timedelta(days=1), 0)
    )
    await factory.reservation(court, other, at(club, day - timedelta(days=1), 23), at(club, day, 0))
    headers = await login_mobile(client, member)

    response = await client.get(
        f"{MOBILE}/clubs/{club.id}/availability",
        params={"date": day.isoformat(), "duration": 60},
        headers=headers,
    )
    assert response.json()["timezone"] == "Asia/Tokyo"
    slots = response.json()["courts"][0]["slots"]
    starts = [datetime.fromisoformat(s["starts_at"]) for s in slots]
    assert starts[0] == at(club, day, 0)
    assert starts[0].astimezone(UTC).date() == day - timedelta(days=1)
    assert starts[-1] == at(club, day, 22)
    assert len(starts) == 45  # 00:00 a 22:00 cada 30 min

    await login_web(client, owner)
    listed = (await client.get(ADMIN, params={"date": day.isoformat()})).json()
    assert [r["id"] for r in listed["items"]] == [str(late.id)]
    grid = (await client.get(f"{ADMIN}/grid", params={"date": day.isoformat()})).json()
    assert [r["id"] for r in grid["courts"][0]["reservations"]] == [str(late.id)]


# ── Job ───────────────────────────────────────────────────────────────────────


async def test_job_expires_unconfirmed_and_completes_finished(factory: Factory) -> None:
    club, other_club = await factory.club(), await factory.club()
    court, other_court = await factory.court(club), await factory.court(other_club)
    player = await factory.user()
    now = datetime.now(UTC)
    hour = timedelta(hours=1)
    expired = await factory.reservation(
        court, player, now - hour, now + hour, status=ReservationStatus.PENDING
    )
    expired_other_club = await factory.reservation(
        other_court, player, now - 3 * hour, now - 2 * hour, status=ReservationStatus.PENDING
    )
    future_pending = await factory.reservation(
        court, player, now + 2 * hour, now + 3 * hour, status=ReservationStatus.PENDING
    )
    finished = await factory.reservation(court, player, now - 3 * hour, now - 2 * hour)
    in_progress = await factory.reservation(other_court, player, now - hour / 2, now + hour / 2)
    already_cancelled = await factory.reservation(
        court,
        player,
        now - 5 * hour,
        now - 4 * hour,
        status=ReservationStatus.CANCELLED,
        cancel_reason=CancelReason.BY_STAFF,
        cancelled_by_id=player.id,
    )

    await expire_unconfirmed_reservations()
    await expire_unconfirmed_reservations()  # idempotente

    rows = {
        r.id: r
        for r in (
            await factory.session.execute(
                select(
                    Reservation.id,
                    Reservation.status,
                    Reservation.cancel_reason,
                    Reservation.cancelled_by_id,
                    Reservation.cancelled_at,
                )
            )
        ).all()
    }
    for rid in (expired.id, expired_other_club.id):
        assert rows[rid].status == ReservationStatus.CANCELLED
        assert rows[rid].cancel_reason == CancelReason.EXPIRED_UNCONFIRMED
        assert rows[rid].cancelled_by_id is None
        assert rows[rid].cancelled_at is not None
    assert rows[future_pending.id].status == ReservationStatus.PENDING
    assert rows[finished.id].status == ReservationStatus.COMPLETED
    assert rows[in_progress.id].status == ReservationStatus.CONFIRMED
    assert rows[already_cancelled.id].cancel_reason == CancelReason.BY_STAFF
    assert rows[already_cancelled.id].cancelled_by_id == player.id
