from datetime import UTC, date, datetime, time, timedelta
from decimal import Decimal
from zoneinfo import ZoneInfo

import httpx
import pytest

from app.domain.enums import (
    CustomerType,
    ExpenseCategory,
    FeeStatus,
    MembershipStatus,
    ReservationStatus,
    StaffRole,
    TransactionType,
)
from app.models import Club, Expense
from app.services import dashboard as dashboard_service
from tests.factories import Factory, login_web

DASHBOARD = "/api/v1/admin/dashboard"
ZONE = ZoneInfo("America/Argentina/Buenos_Aires")
TODAY = date(2026, 3, 10)


def local(day: date, hour: int, minute: int = 0) -> datetime:
    return datetime.combine(day, time(hour, minute), tzinfo=ZONE).astimezone(UTC)


@pytest.fixture
def frozen_today(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(dashboard_service, "today_in", lambda _zone: TODAY)
    monkeypatch.setattr(dashboard_service, "utcnow", lambda: local(TODAY, 12))


async def _expense(factory: Factory, club: Club, amount: str, day: date, **kw: object) -> None:
    factory.session.add(
        Expense(
            club_id=club.id,
            category=ExpenseCategory.OTHER,
            description="Gasto",
            amount=Decimal(amount),
            expense_date=day,
            **kw,
        )
    )
    await factory.session.commit()


async def test_operations_snapshot(
    client: httpx.AsyncClient, factory: Factory, frozen_today: None
) -> None:
    club = await factory.club(open_time=time(8), close_time=time(22))
    owner, _ = await factory.staff(club)
    court_1 = await factory.court(club, name="Uno")
    court_2 = await factory.court(club, name="Dos")
    closed = await factory.court(club, name="Cerrada", is_active=False)
    player = await factory.user(first_name="Juana", last_name="Paz")
    await factory.reservation(court_1, player, local(TODAY, 9), local(TODAY, 10, 30))
    await factory.reservation(
        court_1,
        player,
        local(TODAY, 13),
        local(TODAY, 14),
        status=ReservationStatus.PENDING,
    )
    await factory.reservation(
        court_2,
        player,
        local(TODAY, 21),
        local(TODAY, 23),
        customer_type=CustomerType.GUEST,
        user_id=None,
        guest_name="Invitado",
    )
    await factory.reservation(
        court_2, player, local(TODAY, 15), local(TODAY, 16), status=ReservationStatus.CANCELLED
    )
    await factory.reservation(closed, player, local(TODAY, 10), local(TODAY, 11))
    await factory.reservation(
        court_1, player, local(TODAY + timedelta(days=1), 10), local(TODAY + timedelta(days=1), 11)
    )
    await factory.membership(club, status=MembershipStatus.PENDING)
    await factory.membership(club)
    await factory.stock_item(club, name="Pelotas", quantity=Decimal(1), min_quantity=Decimal(5))
    await factory.stock_item(club, name="Grips", quantity=Decimal(10), min_quantity=Decimal(5))
    await factory.stock_item(
        club,
        name="Borrado",
        quantity=Decimal(0),
        min_quantity=Decimal(5),
        deleted_at=datetime.now(UTC),
    )
    other = await factory.club()
    await factory.membership(other, status=MembershipStatus.PENDING)
    await factory.stock_item(other, quantity=Decimal(0), min_quantity=Decimal(1))
    await login_web(client, owner)

    response = await client.get(f"{DASHBOARD}/operations")
    assert response.status_code == 200, response.text
    data = response.json()
    assert data["date"] == "2026-03-10"
    assert (data["reservations_today"], data["active_courts"]) == (4, 2)
    # 1,5 h + 1 h + 1 h (21–22, el resto queda fuera del horario) sobre 14 h × 2 canchas.
    assert data["occupancy_pct"] == "12.5"
    assert [(r["court_name"], r["customer_name"]) for r in data["upcoming_reservations"]] == [
        ("Uno", "Juana Paz"),
        ("Dos", "Invitado"),
    ]
    assert data["pending_membership_requests"] == 1
    assert data["low_stock"]["count"] == 1
    assert [i["name"] for i in data["low_stock"]["items"]] == ["Pelotas"]


async def test_operations_hides_stock_without_stock_permission(
    client: httpx.AsyncClient, factory: Factory, frozen_today: None
) -> None:
    club = await factory.club()
    manager, _ = await factory.staff(club, roles=[StaffRole.RESERVATIONS_MANAGER])
    stock_keeper, _ = await factory.staff(club, roles=[StaffRole.STOCK_MANAGER])
    await factory.stock_item(club, quantity=Decimal(0), min_quantity=Decimal(1))

    await login_web(client, manager)
    data = (await client.get(f"{DASHBOARD}/operations")).json()
    assert data["low_stock"] is None
    # Sin canchas no hay horas operables: la ocupación es 0, no un error.
    assert data["occupancy_pct"] == "0.0"

    await login_web(client, stock_keeper)
    assert (await client.get(f"{DASHBOARD}/operations")).json()["low_stock"]["count"] == 1


async def test_finance_aggregates_the_cash_book_expenses_and_fees(
    client: httpx.AsyncClient, factory: Factory, frozen_today: None
) -> None:
    club = await factory.club(timezone="America/Argentina/Buenos_Aires")
    owner, _ = await factory.staff(club)
    await factory.payment(club, "1000", occurred_at=local(date(2026, 3, 5), 10))
    await factory.payment(
        club, "500", occurred_at=local(date(2026, 3, 6), 10), voided_at=datetime.now(UTC)
    )
    await factory.payment(
        club, "200", type=TransactionType.OUTFLOW, occurred_at=local(date(2026, 3, 7), 10)
    )
    # 23:30 del 28/2 en Buenos Aires ya es marzo en UTC: tiene que contar en febrero.
    await factory.payment(club, "300", occurred_at=local(date(2026, 2, 28), 23, 30))
    await factory.payment(club, "700", occurred_at=local(date(2025, 9, 15), 10))
    await _expense(factory, club, "400", date(2026, 3, 2))
    await _expense(factory, club, "999", date(2026, 3, 3), deleted_at=datetime.now(UTC))
    await _expense(factory, club, "100", date(2026, 1, 15))

    memberships = [(await factory.membership(club))[1] for _ in range(3)]
    fee_payment = await factory.payment(
        club, "10000", occurred_at=local(date(2026, 3, 8), 10), membership_id=memberships[0].id
    )
    await factory.fee(memberships[0], 2026, 3, status=FeeStatus.PAID, payment_id=fee_payment.id)
    await factory.fee(memberships[1], 2026, 3, amount="8000")
    await factory.fee(memberships[2], 2026, 3, amount="5000", status=FeeStatus.CANCELLED)

    other = await factory.club()
    await factory.payment(other, "123456", occurred_at=local(date(2026, 3, 5), 10))
    await _expense(factory, other, "654321", date(2026, 3, 5))
    await login_web(client, owner)

    response = await client.get(f"{DASHBOARD}/finance")
    assert response.status_code == 200, response.text
    data = response.json()
    assert data["current"] == {
        "year": 2026,
        "month": 3,
        "income": "11000.00",
        "cash_outflow": "200.00",
        "expenses": "400.00",
        "result": "10600.00",
        "cash_balance": "10800.00",
    }
    assert data["fees"]["collected"] == {"count": 1, "amount": "10000.00"}
    assert data["fees"]["pending"] == {"count": 1, "amount": "8000.00"}
    # Un egreso de caja no resta del resultado y un gasto no resta de la caja:
    # así un gasto pagado en efectivo no se cuenta dos veces.
    series = [
        (m["year"], m["month"], m["income"], m["result"], m["cash_balance"]) for m in data["series"]
    ]
    assert series == [
        (2025, 10, "0.00", "0.00", "0.00"),
        (2025, 11, "0.00", "0.00", "0.00"),
        (2025, 12, "0.00", "0.00", "0.00"),
        (2026, 1, "0.00", "-100.00", "0.00"),
        (2026, 2, "300.00", "300.00", "300.00"),
        (2026, 3, "11000.00", "10600.00", "10800.00"),
    ]


async def test_finance_dashboard_requires_finance_permission(
    client: httpx.AsyncClient, factory: Factory
) -> None:
    club = await factory.club()
    manager, _ = await factory.staff(club, roles=[StaffRole.RESERVATIONS_MANAGER])
    await login_web(client, manager)
    assert (await client.get(f"{DASHBOARD}/finance")).status_code == 403
    assert (await client.get(f"{DASHBOARD}/operations")).status_code == 200
