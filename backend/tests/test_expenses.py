from datetime import UTC, date, datetime, timedelta
from decimal import Decimal

import httpx
import pytest

from app.core.time import today_in, tz
from app.domain.anomalies import CategoryHistory, Signals, analyze, explanation_status
from app.domain.enums import AnomalySeverity, ExpenseCategory, StaffRole
from app.models import Club
from tests.factories import Factory, login_web

EXPENSES = "/api/v1/admin/expenses"


def _today(club: Club) -> date:
    return today_in(tz(club.timezone))


async def _owner_client(client: httpx.AsyncClient, factory: Factory, club: Club) -> None:
    owner, _ = await factory.staff(club)
    await login_web(client, owner)


async def _history(factory: Factory, club: Club, day: date, amounts: list[str]) -> None:
    for i, amount in enumerate(amounts):
        await factory.expense(club, amount, expense_date=day - timedelta(days=10 + i))


def _new(day: date, amount: str, **kw: object) -> dict[str, object]:
    return {
        "category": "maintenance",
        "description": "Arreglo de red",
        "amount": amount,
        "expense_date": day.isoformat(),
        **kw,
    }


# ── Permisos y aislación ─────────────────────────────────────────────────────


@pytest.mark.parametrize("role", [StaffRole.STOCK_MANAGER, StaffRole.RESERVATIONS_MANAGER])
async def test_roles_without_expense_permissions_get_403(
    client: httpx.AsyncClient, factory: Factory, role: StaffRole
) -> None:
    club = await factory.club()
    expense = await factory.expense(club)
    user, _ = await factory.staff(club, roles=[role])
    await login_web(client, user)
    day = _today(club)

    assert (await client.get(EXPENSES)).status_code == 403
    assert (await client.get(f"{EXPENSES}/stats")).status_code == 403
    assert (await client.get(f"{EXPENSES}/export.csv")).status_code == 403
    assert (await client.get(f"{EXPENSES}/{expense.id}")).status_code == 403
    assert (await client.post(EXPENSES, json=_new(day, "100"))).status_code == 403
    assert (await client.patch(f"{EXPENSES}/{expense.id}", json={"amount": "5"})).status_code == 403
    assert (await client.patch(f"{EXPENSES}/{expense.id}/review")).status_code == 403
    assert (await client.delete(f"{EXPENSES}/{expense.id}")).status_code == 403
    assert (await client.post(f"{EXPENSES}/anomalies/recompute")).status_code == 403


async def test_staff_of_another_club_cannot_see_or_touch_expenses(
    client: httpx.AsyncClient, factory: Factory
) -> None:
    club_a = await factory.club()
    club_b = await factory.club()
    foreign = await factory.expense(
        club_a, "999", anomaly_severity=AnomalySeverity.HIGH, anomaly_score=0.8
    )
    await _owner_client(client, factory, club_b)
    url = f"{EXPENSES}/{foreign.id}"

    assert (await client.get(url)).status_code == 404
    assert (await client.patch(url, json={"amount": "1"})).status_code == 404
    assert (await client.patch(f"{url}/review")).status_code == 404
    assert (await client.delete(url)).status_code == 404
    listing = (await client.get(EXPENSES)).json()
    assert listing["total"] == 0
    stats = (await client.get(f"{EXPENSES}/stats")).json()
    assert stats["count"] == 0
    assert stats["anomalies_pending"] == 0


async def test_club_id_in_the_body_is_ignored(client: httpx.AsyncClient, factory: Factory) -> None:
    club_a = await factory.club()
    club_b = await factory.club()
    await _owner_client(client, factory, club_b)
    response = await client.post(EXPENSES, json=_new(_today(club_b), "100", club_id=str(club_a.id)))
    assert response.status_code == 201
    expense_id = response.json()["id"]
    assert (await client.get(f"{EXPENSES}/{expense_id}")).status_code == 200


# ── CRUD ─────────────────────────────────────────────────────────────────────


async def test_create_get_update_and_soft_delete(
    client: httpx.AsyncClient, factory: Factory
) -> None:
    club = await factory.club()
    await _owner_client(client, factory, club)
    day = _today(club)

    created = await client.post(
        EXPENSES, json=_new(day, "1500.50", vendor_name="  Ferretería Sur ", notes="Factura A")
    )
    assert created.status_code == 201, created.text
    body = created.json()
    assert body["amount"] == "1500.50"
    assert body["vendor_name"] == "Ferretería Sur"
    assert body["currency"] == "ARS"
    # Sin histórico no hay con qué comparar: se analizó y no hay anomalía.
    assert body["anomaly_score"] == 0.0
    assert body["anomaly_severity"] is None
    assert body["anomaly_analyzed_at"] is not None
    assert body["explanation_status"] == "not_needed"
    url = f"{EXPENSES}/{body['id']}"

    updated = await client.patch(url, json={"amount": "2000", "notes": None})
    assert updated.status_code == 200
    assert updated.json()["amount"] == "2000.00"
    assert updated.json()["notes"] is None
    assert (await client.patch(url, json={"description": None})).status_code == 422
    assert (await client.patch(url, json={"amount": "0"})).status_code == 422

    assert (await client.delete(url)).status_code == 204
    assert (await client.get(url)).status_code == 404
    assert (await client.delete(url)).status_code == 404
    assert (await client.patch(url, json={"amount": "1"})).status_code == 404
    assert (await client.get(EXPENSES)).json()["total"] == 0


async def test_create_validates_input(client: httpx.AsyncClient, factory: Factory) -> None:
    club = await factory.club()
    await _owner_client(client, factory, club)
    day = _today(club)
    assert (await client.post(EXPENSES, json=_new(day, "-5"))).status_code == 422
    assert (await client.post(EXPENSES, json=_new(day, "10", category="food"))).status_code == 422
    assert (await client.post(EXPENSES, json=_new(day, "10", description="ab"))).status_code == 422


async def test_list_is_paginated_filtered_and_excludes_deleted(
    client: httpx.AsyncClient, factory: Factory
) -> None:
    club = await factory.club()
    await _owner_client(client, factory, club)
    day = _today(club)
    for i in range(3):
        await factory.expense(club, "100", expense_date=day - timedelta(days=i))
    await factory.expense(
        club,
        "900",
        category=ExpenseCategory.UTILITIES,
        expense_date=day - timedelta(days=40),
        anomaly_severity=AnomalySeverity.MEDIUM,
        anomaly_score=0.6,
    )
    await factory.expense(club, "100", deleted_at=datetime.now(UTC))

    page = (await client.get(EXPENSES, params={"page_size": 2})).json()
    assert page["total"] == 4
    assert len(page["items"]) == 2
    # Más recientes primero.
    assert page["items"][0]["expense_date"] == day.isoformat()
    page2 = (await client.get(EXPENSES, params={"page_size": 2, "page": 2})).json()
    assert len(page2["items"]) == 2

    by_cat = (await client.get(EXPENSES, params={"category": "utilities"})).json()
    assert [e["amount"] for e in by_cat["items"]] == ["900.00"]
    anomalous = (await client.get(EXPENSES, params={"has_anomaly": True})).json()
    assert anomalous["total"] == 1
    assert (await client.get(EXPENSES, params={"reviewed": True})).json()["total"] == 0
    in_range = await client.get(
        EXPENSES,
        params={
            "date_from": (day - timedelta(days=1)).isoformat(),
            "date_to": day.isoformat(),
        },
    )
    assert in_range.json()["total"] == 2
    assert (await client.get(EXPENSES, params={"period": "day"})).json()["total"] == 1

    assert (await client.get(EXPENSES, params={"page_size": 500})).status_code == 422
    both = await client.get(EXPENSES, params={"period": "month", "date_from": day.isoformat()})
    assert both.status_code == 422
    backwards = await client.get(
        EXPENSES,
        params={"date_from": day.isoformat(), "date_to": (day - timedelta(days=1)).isoformat()},
    )
    assert backwards.status_code == 422


async def test_stats_group_by_category_for_the_period(
    client: httpx.AsyncClient, factory: Factory
) -> None:
    club = await factory.club()
    await _owner_client(client, factory, club)
    day = _today(club)
    first = day.replace(day=1)
    await factory.expense(club, "100.10", expense_date=first)
    await factory.expense(club, "200.20", expense_date=first)
    await factory.expense(club, "50", category=ExpenseCategory.UTILITIES, expense_date=first)
    await factory.expense(club, "999", expense_date=first - timedelta(days=1))  # mes anterior
    await factory.expense(club, "999", expense_date=first, deleted_at=datetime.now(UTC))
    await factory.expense(
        club,
        "10",
        expense_date=first - timedelta(days=60),
        anomaly_severity=AnomalySeverity.LOW,
        anomaly_score=0.4,
    )

    stats = (await client.get(f"{EXPENSES}/stats")).json()
    assert stats["date_from"] == first.isoformat()
    assert stats["total"] == "350.30"
    assert stats["count"] == 3
    assert stats["by_category"] == [
        {"category": "maintenance", "total": "300.30", "count": 2},
        {"category": "utilities", "total": "50.00", "count": 1},
    ]
    assert stats["anomalies_pending"] == 1

    previous = (
        await client.get(
            f"{EXPENSES}/stats",
            params={
                "date_from": (first - timedelta(days=1)).isoformat(),
                "date_to": first.isoformat(),
            },
        )
    ).json()
    assert previous["total"] == "1349.30"
    assert previous["date_to"] == first.isoformat()


async def test_export_csv_has_total_and_neutralizes_formulas(
    client: httpx.AsyncClient, factory: Factory
) -> None:
    club = await factory.club()
    await _owner_client(client, factory, club)
    day = _today(club)
    await factory.expense(club, "100", description='=HYPERLINK("http://x")', expense_date=day)
    await factory.expense(club, "50.5", vendor_name="Luz SA", expense_date=day)
    await factory.expense(club, "70", expense_date=day, deleted_at=datetime.now(UTC))

    response = await client.get(f"{EXPENSES}/export.csv", params={"period": "day"})
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/csv")
    assert (
        f"gastos_{day.isoformat()}_{day.isoformat()}.csv" in response.headers["content-disposition"]
    )
    lines = response.text.lstrip("﻿").strip().splitlines()
    assert lines[0].startswith("Fecha,Categoría,Descripción")
    assert len(lines) == 4
    assert "'=HYPERLINK" in response.text
    assert lines[-1].split(",")[5] == "150.50"


async def test_review_marks_reviewer_once(client: httpx.AsyncClient, factory: Factory) -> None:
    club = await factory.club()
    owner, _ = await factory.staff(club)
    await login_web(client, owner)
    flagged = await factory.expense(club, anomaly_severity=AnomalySeverity.HIGH, anomaly_score=0.8)
    normal = await factory.expense(club)

    reviewed = await client.patch(f"{EXPENSES}/{flagged.id}/review")
    assert reviewed.status_code == 200
    assert reviewed.json()["reviewed_by_id"] == str(owner.id)
    first_at = reviewed.json()["reviewed_at"]
    again = await client.patch(f"{EXPENSES}/{flagged.id}/review")
    assert again.json()["reviewed_at"] == first_at
    assert (await client.get(EXPENSES, params={"reviewed": True})).json()["total"] == 1

    assert (await client.patch(f"{EXPENSES}/{normal.id}/review")).status_code == 422


# ── Detección estadística ────────────────────────────────────────────────────


async def test_zscore_excludes_the_expense_itself_and_deleted_ones(
    client: httpx.AsyncClient, factory: Factory
) -> None:
    club = await factory.club()
    await _owner_client(client, factory, club)
    day = _today(club)
    await _history(factory, club, day, ["100", "101", "99", "100", "100"])
    # Borrados con montos enormes: si contaran, el gasto nuevo parecería normal.
    for _ in range(3):
        await factory.expense(
            club, "100000", expense_date=day - timedelta(days=3), deleted_at=datetime.now(UTC)
        )
    # Fuera de la ventana de 12 meses: tampoco cuenta.
    await factory.expense(club, "100000", expense_date=day - timedelta(days=400))
    # Otra categoría: no cuenta.
    await factory.expense(club, "100000", category=ExpenseCategory.SALARIES, expense_date=day)

    body = (await client.post(EXPENSES, json=_new(day, "300"))).json()
    # Con el propio gasto en el histórico el z-score sería ~2 (baja); sin él es enorme.
    assert body["anomaly_severity"] == "critical"
    assert body["anomaly_score"] == 1.0
    assert "en 5 gastos" in body["anomaly_reasons"]
    assert "$ 100,00" in body["anomaly_reasons"]
    assert body["explanation_status"] == "unavailable"  # sin API key en los tests

    normal = (await client.post(EXPENSES, json=_new(day, "102"))).json()
    assert normal["anomaly_severity"] is None


async def test_duplicate_is_detected_in_both_directions_within_seven_days(
    client: httpx.AsyncClient, factory: Factory
) -> None:
    club = await factory.club()
    await _owner_client(client, factory, club)
    day = _today(club)
    await factory.expense(
        club, "5000", vendor_name="Pinturería Norte", expense_date=day + timedelta(days=7)
    )
    await factory.expense(
        club, "7000", vendor_name="Pinturería Norte", expense_date=day - timedelta(days=5)
    )
    await factory.expense(club, "9000", vendor_name="Otro", expense_date=day - timedelta(days=8))
    await factory.expense(club, "9000", vendor_name="Otro", expense_date=day + timedelta(days=8))
    await factory.expense(
        club, "4000", vendor_name="Borrado", expense_date=day, deleted_at=datetime.now(UTC)
    )

    later = (
        await client.post(EXPENSES, json=_new(day, "5000", vendor_name="pinturería norte "))
    ).json()
    assert later["anomaly_severity"] == "high"
    assert "duplicado" in later["anomaly_reasons"]
    earlier = (
        await client.post(EXPENSES, json=_new(day, "7000", vendor_name="Pinturería Norte"))
    ).json()
    assert earlier["anomaly_severity"] == "high"

    far = (await client.post(EXPENSES, json=_new(day, "9000", vendor_name="Otro"))).json()
    assert far["anomaly_severity"] is None
    deleted = (await client.post(EXPENSES, json=_new(day, "4000", vendor_name="Borrado"))).json()
    assert deleted["anomaly_severity"] is None


async def test_new_vendor_with_high_amount_is_flagged(
    client: httpx.AsyncClient, factory: Factory
) -> None:
    club = await factory.club()
    await _owner_client(client, factory, club)
    day = _today(club)
    # Histórico disperso: 210 no es un outlier por z-score, pero duplica el promedio.
    await _history(factory, club, day, ["10", "190", "50", "150", "100"])
    await factory.expense(
        club, "100", vendor_name="Conocido", expense_date=day - timedelta(days=30)
    )

    new_vendor = (
        await client.post(EXPENSES, json=_new(day, "210", vendor_name="Nuevo SRL"))
    ).json()
    assert new_vendor["anomaly_severity"] == "medium"
    assert "Proveedor nuevo" in new_vendor["anomaly_reasons"]
    known = (await client.post(EXPENSES, json=_new(day, "210", vendor_name="conocido"))).json()
    assert known["anomaly_severity"] is None


async def test_edit_reanalyzes_and_clears_stale_explanation_and_review(
    client: httpx.AsyncClient, factory: Factory
) -> None:
    club = await factory.club()
    await _owner_client(client, factory, club)
    day = _today(club)
    await _history(factory, club, day, ["100", "101", "99", "100", "100"])
    expense = await factory.expense(
        club,
        "1000",
        expense_date=day,
        anomaly_severity=AnomalySeverity.CRITICAL,
        anomaly_score=1.0,
        anomaly_explanation="Explicación vieja",
        anomaly_explained_at=datetime.now(UTC),
        reviewed_at=datetime.now(UTC),
    )
    url = f"{EXPENSES}/{expense.id}"

    # Solo notas: el análisis y la explicación siguen valiendo.
    same = (await client.patch(url, json={"notes": "ok"})).json()
    assert same["anomaly_explanation"] == "Explicación vieja"
    assert same["reviewed_at"] is not None

    fixed = (await client.patch(url, json={"amount": "100"})).json()
    assert fixed["anomaly_severity"] is None
    assert fixed["anomaly_explanation"] is None
    assert fixed["anomaly_explained_at"] is None
    assert fixed["reviewed_at"] is None


async def test_recompute_reanalyzes_the_period_in_sql(
    client: httpx.AsyncClient, factory: Factory
) -> None:
    club = await factory.club()
    await _owner_client(client, factory, club)
    day = _today(club)
    first = day.replace(day=1)
    await _history(factory, club, first, ["100", "101", "99", "100", "100"])
    outlier = await factory.expense(club, "5000", expense_date=first)
    await factory.expense(club, "100", expense_date=first)
    stale = await factory.expense(
        club,
        "100",
        expense_date=first,
        anomaly_severity=AnomalySeverity.HIGH,
        anomaly_score=0.8,
        anomaly_reasons="viejo",
    )

    result = await client.post(f"{EXPENSES}/anomalies/recompute")
    assert result.status_code == 200
    assert result.json() == {"analyzed": 3, "flagged": 1}
    assert (await client.get(f"{EXPENSES}/{outlier.id}")).json()["anomaly_severity"] == "critical"
    assert (await client.get(f"{EXPENSES}/{stale.id}")).json()["anomaly_severity"] is None


# ── Reglas puras ─────────────────────────────────────────────────────────────


def test_analysis_needs_enough_history_and_only_flags_higher_amounts() -> None:
    few = CategoryHistory(count=4, mean=Decimal(100), stddev=Decimal(1))
    assert analyze(Signals(Decimal(10_000), few, False, False)).severity is None
    enough = CategoryHistory(count=5, mean=Decimal(100), stddev=Decimal(10))
    assert analyze(Signals(Decimal(1), enough, False, False)).severity is None
    both = analyze(Signals(Decimal(130), enough, True, False))
    # Duplicado (0.8) + z=3 (0.75): gana el mayor y suma un plus por la segunda señal.
    assert both.score == 0.9
    assert both.severity == AnomalySeverity.CRITICAL
    assert both.reasons is not None and both.reasons.startswith("Posible duplicado")


def test_explanation_status() -> None:
    now = datetime.now(UTC)
    high = AnomalySeverity.HIGH
    assert explanation_status(None, None, None, llm_enabled=True) == "not_needed"
    assert explanation_status(AnomalySeverity.LOW, None, None, llm_enabled=True) == "not_needed"
    assert explanation_status(high, None, None, llm_enabled=True) == "pending"
    assert explanation_status(high, None, None, llm_enabled=False) == "unavailable"
    assert explanation_status(high, "texto", now, llm_enabled=True) == "ready"
    assert explanation_status(high, None, now, llm_enabled=True) == "unavailable"
