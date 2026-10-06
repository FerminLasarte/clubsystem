from datetime import UTC, datetime, timedelta
from decimal import Decimal

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.domain.enums import FeeStatus, StaffRole
from app.models import MembershipFee
from tests.factories import Factory, login_web

CASH = "/api/v1/admin/cash"


async def test_day_lists_movements_with_summary_by_method(
    client: httpx.AsyncClient, factory: Factory
) -> None:
    club = await factory.club()
    owner, _ = await factory.staff(club)
    await login_web(client, owner)

    income = await client.post(
        f"{CASH}/payments",
        json={"type": "INCOME", "amount": "1500.50", "method": "CASH", "description": "Bebidas"},
    )
    assert income.status_code == 201, income.text
    assert income.json()["created_by_name"] == owner.full_name
    await client.post(
        f"{CASH}/payments",
        json={"type": "INCOME", "amount": "2000", "method": "TRANSFER", "description": "Clase"},
    )
    await client.post(
        f"{CASH}/payments",
        json={"type": "OUTFLOW", "amount": "500", "method": "CASH", "description": "Vale"},
    )

    day = (await client.get(f"{CASH}/day")).json()
    assert [m["description"] for m in day["movements"]] == ["Bebidas", "Clase", "Vale"]
    summary = day["summary"]
    assert (summary["income"], summary["outflow"], summary["net"]) == (
        "3500.50",
        "500.00",
        "3000.50",
    )
    by_method = {m["method"]: m for m in summary["by_method"]}
    assert set(by_method) == {"CASH", "CARD", "TRANSFER", "MERCADOPAGO"}
    assert (by_method["CASH"]["income"], by_method["CASH"]["net"]) == ("1500.50", "1000.50")
    assert by_method["CARD"]["income"] == "0.00"


async def test_day_uses_the_club_timezone(client: httpx.AsyncClient, factory: Factory) -> None:
    club = await factory.club(timezone="America/Argentina/Buenos_Aires")
    owner, _ = await factory.staff(club)
    await login_web(client, owner)

    # 23:30 en Buenos Aires es 02:30 UTC del día siguiente.
    created = await client.post(
        f"{CASH}/payments",
        json={
            "type": "INCOME",
            "amount": "100",
            "method": "CARD",
            "description": "Cierre",
            "occurred_at": "2025-03-10T23:30:00-03:00",
        },
    )
    assert created.status_code == 201
    that_day = (await client.get(f"{CASH}/day", params={"date": "2025-03-10"})).json()
    assert [m["description"] for m in that_day["movements"]] == ["Cierre"]
    assert that_day["summary"]["income"] == "100.00"
    next_day = (await client.get(f"{CASH}/day", params={"date": "2025-03-11"})).json()
    assert next_day["movements"] == []
    assert next_day["summary"]["income"] == "0.00"


async def test_payment_validation(client: httpx.AsyncClient, factory: Factory) -> None:
    club = await factory.club()
    owner, _ = await factory.staff(club)
    await login_web(client, owner)
    base = {"type": "INCOME", "amount": "100", "method": "CASH", "description": "X"}

    future = (datetime.now(UTC) + timedelta(days=1)).isoformat()
    assert (
        await client.post(f"{CASH}/payments", json={**base, "occurred_at": future})
    ).status_code == 422
    naive = await client.post(f"{CASH}/payments", json={**base, "occurred_at": "2025-01-01T10:00"})
    assert naive.status_code == 422
    assert (await client.post(f"{CASH}/payments", json={**base, "amount": "0"})).status_code == 422
    assert (
        await client.post(f"{CASH}/payments", json={**base, "method": "EFECTIVO"})
    ).status_code == 422


async def test_void_keeps_the_movement_but_excludes_it_from_totals(
    client: httpx.AsyncClient, factory: Factory
) -> None:
    club = await factory.club()
    owner, _ = await factory.staff(club)
    await login_web(client, owner)
    created = await client.post(
        f"{CASH}/payments",
        json={"type": "INCOME", "amount": "800", "method": "CASH", "description": "Error"},
    )
    payment_id = created.json()["id"]

    voided = await client.post(f"{CASH}/payments/{payment_id}/void", json={"reason": "Duplicado"})
    assert voided.status_code == 200
    assert voided.json()["void_reason"] == "Duplicado"
    assert voided.json()["voided_at"] is not None

    day = (await client.get(f"{CASH}/day")).json()
    assert [m["id"] for m in day["movements"]] == [payment_id]
    assert day["summary"]["income"] == "0.00"
    again = await client.post(f"{CASH}/payments/{payment_id}/void", json={"reason": "Otra vez"})
    assert again.status_code == 409


async def test_voiding_a_fee_payment_leaves_the_fee_pending(
    client: httpx.AsyncClient,
    factory: Factory,
    owner_sessionmaker: async_sessionmaker[AsyncSession],
) -> None:
    club = await factory.club()
    owner, _ = await factory.staff(club)
    _, membership = await factory.membership(club)
    fee = await factory.fee(membership, 2026, 3)
    await login_web(client, owner)

    paid = await client.post(f"/api/v1/admin/fees/{fee.id}/pay", json={"method": "CASH"})
    assert paid.json()["status"] == "PAID"
    payment_id = paid.json()["payment_id"]

    voided = await client.post(f"{CASH}/payments/{payment_id}/void", json={"reason": "Rebotó"})
    assert voided.status_code == 200
    async with owner_sessionmaker() as session:
        stored = (
            await session.execute(select(MembershipFee).where(MembershipFee.id == fee.id))
        ).scalar_one()
    assert (stored.status, stored.payment_id) == (FeeStatus.PENDING, None)
    # Se puede volver a cobrar.
    again = await client.post(f"/api/v1/admin/fees/{fee.id}/pay", json={"method": "TRANSFER"})
    assert again.status_code == 200


async def test_reservation_payments_cannot_exceed_its_price(
    client: httpx.AsyncClient, factory: Factory
) -> None:
    club = await factory.club()
    owner, _ = await factory.staff(club)
    member, membership = await factory.membership(club)
    _, other_membership = await factory.membership(club)
    court = await factory.court(club)
    start = datetime(2025, 5, 1, 18, tzinfo=UTC)
    reservation = await factory.reservation(
        court, member, start, start + timedelta(hours=1), total_price=Decimal("8000")
    )
    await login_web(client, owner)

    def body(type_: str, amount: str) -> dict[str, str]:
        return {
            "type": type_,
            "amount": amount,
            "method": "CASH",
            "description": "Turno",
            "reservation_id": str(reservation.id),
        }

    first = await client.post(f"{CASH}/payments", json=body("INCOME", "5000"))
    assert first.status_code == 201
    assert first.json()["reservation"]["customer_name"] == member.full_name
    assert first.json()["reservation"]["court_name"] == court.name
    over = await client.post(f"{CASH}/payments", json=body("INCOME", "3000.01"))
    assert over.status_code == 422
    assert over.json()["error"]["code"] == "reservation_overpaid"
    assert (await client.post(f"{CASH}/payments", json=body("INCOME", "3000"))).status_code == 201
    refund_too_big = await client.post(f"{CASH}/payments", json=body("OUTFLOW", "8000.01"))
    assert refund_too_big.status_code == 422

    mismatched = await client.post(
        f"{CASH}/payments",
        json={**body("INCOME", "1"), "membership_id": str(other_membership.id)},
    )
    assert mismatched.status_code == 422
    matched = await client.post(
        f"{CASH}/payments", json={**body("OUTFLOW", "1000"), "membership_id": str(membership.id)}
    )
    assert matched.status_code == 201
    assert matched.json()["member"]["full_name"] == member.full_name


async def test_cannot_reference_or_touch_another_clubs_data(
    client: httpx.AsyncClient, factory: Factory
) -> None:
    club_a = await factory.club()
    club_b = await factory.club()
    owner_a, _ = await factory.staff(club_a)
    member_b, membership_b = await factory.membership(club_b)
    court_b = await factory.court(club_b)
    start = datetime(2025, 5, 1, 18, tzinfo=UTC)
    reservation_b = await factory.reservation(court_b, member_b, start, start + timedelta(hours=1))
    payment_b = await factory.payment(club_b, description="Del club B")
    await login_web(client, owner_a)
    base = {"type": "INCOME", "amount": "100", "method": "CASH", "description": "X"}

    with_member = await client.post(
        f"{CASH}/payments", json={**base, "membership_id": str(membership_b.id)}
    )
    assert with_member.status_code == 404
    with_reservation = await client.post(
        f"{CASH}/payments", json={**base, "reservation_id": str(reservation_b.id)}
    )
    assert with_reservation.status_code == 404
    void = await client.post(f"{CASH}/payments/{payment_b.id}/void", json={"reason": "x"})
    assert void.status_code == 404
    assert (await client.get(f"{CASH}/day")).json()["movements"] == []


async def test_cash_requires_cash_permissions(client: httpx.AsyncClient, factory: Factory) -> None:
    club = await factory.club()
    manager, _ = await factory.staff(club, roles=[StaffRole.RESERVATIONS_MANAGER])
    payment = await factory.payment(club)
    await login_web(client, manager)

    assert (await client.get(f"{CASH}/day")).status_code == 403
    created = await client.post(
        f"{CASH}/payments",
        json={"type": "INCOME", "amount": "100", "method": "CASH", "description": "X"},
    )
    assert created.status_code == 403
    void = await client.post(f"{CASH}/payments/{payment.id}/void", json={"reason": "x"})
    assert void.status_code == 403
