import asyncio
from datetime import UTC, datetime
from decimal import Decimal

import httpx

from app.domain.enums import StaffRole
from tests.factories import Factory, login_web

STOCK = "/api/v1/admin/stock"
ITEMS = f"{STOCK}/items"


def _new_client(client: httpx.AsyncClient) -> httpx.AsyncClient:
    return httpx.AsyncClient(
        transport=client._transport,
        base_url="http://test",
        headers={"x-requested-with": "clubsystem"},
    )


async def test_creating_an_item_with_stock_records_the_initial_entry(
    client: httpx.AsyncClient, factory: Factory
) -> None:
    club = await factory.club()
    owner, _ = await factory.staff(club)
    await login_web(client, owner)

    created = await client.post(
        ITEMS,
        json={
            "name": "Pelotas Head",
            "sku": "PEL-1",
            "category": "Pelotas",
            "unit": "box",
            "quantity": "12",
            "min_quantity": "4",
            "unit_cost": "5500.50",
        },
    )
    assert created.status_code == 201, created.text
    item = created.json()
    assert Decimal(item["quantity"]) == 12
    assert item["is_low_stock"] is False

    history = (await client.get(f"{ITEMS}/{item['id']}/movements")).json()
    assert history["total"] == 1
    initial = history["items"][0]
    assert initial["type"] == "IN"
    assert Decimal(initial["quantity_before"]) == 0
    assert Decimal(initial["quantity_after"]) == 12
    assert Decimal(initial["unit_cost"]) == Decimal("5500.50")
    assert initial["performed_by_name"] == owner.full_name

    empty = await client.post(ITEMS, json={"name": "Grips"})
    assert empty.status_code == 201
    no_moves = await client.get(f"{ITEMS}/{empty.json()['id']}/movements")
    assert no_moves.json()["total"] == 0

    assert (await client.get(f"{STOCK}/categories")).json() == ["Pelotas"]


async def test_low_stock_filter_and_stats_are_resolved_in_the_database(
    client: httpx.AsyncClient, factory: Factory
) -> None:
    club = await factory.club()
    owner, _ = await factory.staff(club)
    await factory.stock_item(
        club, name="Agua", quantity=Decimal(2), min_quantity=Decimal(5), unit_cost=Decimal("100")
    )
    await factory.stock_item(
        club, name="Bebida isotónica", quantity=Decimal(5), min_quantity=Decimal(5)
    )
    await factory.stock_item(
        club,
        name="Cubregrips",
        quantity=Decimal("10.5"),
        min_quantity=Decimal(5),
        unit_cost=Decimal("20"),
    )
    await factory.stock_item(
        club, name="Dado de baja", quantity=Decimal(0), deleted_at=datetime.now(UTC)
    )
    other_club = await factory.club()
    await factory.stock_item(other_club, name="Ajeno", quantity=Decimal(0), unit_cost=Decimal(9))
    await login_web(client, owner)

    # Página de 1: el total demuestra que el filtro se aplica antes de paginar (en SQL).
    low = (await client.get(ITEMS, params={"low_stock": "true", "page_size": 1})).json()
    assert low["total"] == 2
    assert [i["name"] for i in low["items"]] == ["Agua"]
    assert low["items"][0]["is_low_stock"] is True
    ok = (await client.get(ITEMS, params={"low_stock": "false"})).json()
    assert [i["name"] for i in ok["items"]] == ["Cubregrips"]

    stats = (await client.get(f"{STOCK}/stats")).json()
    assert stats["total_items"] == 3
    assert stats["low_stock_count"] == 2
    assert Decimal(stats["inventory_value"]) == Decimal("410.00")

    found = (await client.get(ITEMS, params={"search": "grip"})).json()
    assert [i["name"] for i in found["items"]] == ["Cubregrips"]


async def test_in_and_out_movements_update_quantity_and_reject_negative_stock(
    client: httpx.AsyncClient, factory: Factory
) -> None:
    club = await factory.club()
    clerk, _ = await factory.staff(club, roles=[StaffRole.STOCK_MANAGER])
    item = await factory.stock_item(club, quantity=Decimal(5), min_quantity=Decimal(3))
    await login_web(client, clerk)
    url = f"{ITEMS}/{item.id}/movements"

    entry = await client.post(
        url, json={"type": "IN", "quantity": "2.5", "reason": "Compra", "unit_cost": "10"}
    )
    assert entry.status_code == 201, entry.text
    assert Decimal(entry.json()["movement"]["quantity_before"]) == 5
    assert Decimal(entry.json()["item"]["quantity"]) == Decimal("7.5")

    sale = await client.post(url, json={"type": "OUT", "quantity": "5", "reason": "Venta"})
    assert sale.status_code == 201
    assert Decimal(sale.json()["movement"]["quantity_delta"]) == -5
    assert sale.json()["item"]["is_low_stock"] is True

    too_much = await client.post(url, json={"type": "OUT", "quantity": "3", "reason": "Venta"})
    assert too_much.status_code == 422
    assert too_much.json()["error"]["code"] == "insufficient_stock"

    history = (await client.get(url)).json()
    assert history["total"] == 2
    assert [m["type"] for m in history["items"]] == ["OUT", "IN"]
    assert history["items"][0]["performed_by_name"] == clerk.full_name
    current = (await client.get(ITEMS)).json()["items"][0]
    assert Decimal(current["quantity"]) == Decimal("2.5")


async def test_movement_payload_must_match_its_type(
    client: httpx.AsyncClient, factory: Factory
) -> None:
    club = await factory.club()
    owner, _ = await factory.staff(club)
    item = await factory.stock_item(club, quantity=Decimal(5))
    await login_web(client, owner)
    url = f"{ITEMS}/{item.id}/movements"

    bad = [
        {"type": "OUT", "target_quantity": "1", "reason": "x"},
        {"type": "IN", "quantity": "0", "reason": "x"},
        {"type": "IN", "quantity": "-1", "reason": "x"},
        {"type": "ADJUSTMENT", "quantity": "1", "reason": "x"},
        {"type": "ADJUSTMENT", "target_quantity": "-1", "reason": "x"},
        # El motivo es obligatorio en salidas y ajustes.
        {"type": "OUT", "quantity": "1"},
        {"type": "ADJUSTMENT", "target_quantity": "2"},
        {"type": "OUT", "quantity": "1", "reason": "   "},
    ]
    for body in bad:
        assert (await client.post(url, json=body)).status_code == 422, body


async def test_entry_reason_is_optional_and_its_unit_cost_updates_the_item(
    client: httpx.AsyncClient, factory: Factory
) -> None:
    club = await factory.club()
    clerk, _ = await factory.staff(club, roles=[StaffRole.STOCK_MANAGER])
    item = await factory.stock_item(club, quantity=Decimal(5), unit_cost=Decimal("100"))
    await login_web(client, clerk)
    url = f"{ITEMS}/{item.id}/movements"

    def cost(response: httpx.Response) -> Decimal:
        return Decimal(response.json()["item"]["unit_cost"])

    no_cost = await client.post(url, json={"type": "IN", "quantity": "1"})
    assert no_cost.status_code == 201, no_cost.text
    assert no_cost.json()["movement"]["reason"] is None
    assert cost(no_cost) == Decimal("100")  # sin costo informado, se conserva

    restock = await client.post(url, json={"type": "IN", "quantity": "4", "unit_cost": "125.50"})
    assert restock.status_code == 201, restock.text
    assert cost(restock) == Decimal("125.50")
    assert Decimal(restock.json()["movement"]["unit_cost"]) == Decimal("125.50")

    # Solo las entradas fijan el costo del ítem.
    sale = await client.post(
        url, json={"type": "OUT", "quantity": "1", "reason": "Venta", "unit_cost": "1"}
    )
    assert sale.status_code == 201
    assert cost(sale) == Decimal("125.50")
    stats = (await client.get(f"{STOCK}/stats")).json()
    assert Decimal(stats["inventory_value"]) == Decimal("9") * Decimal("125.50")


async def test_concurrent_outs_never_oversell(client: httpx.AsyncClient, factory: Factory) -> None:
    club = await factory.club()
    owner, _ = await factory.staff(club)
    item = await factory.stock_item(club, quantity=Decimal(10))
    await login_web(client, owner)
    other = _new_client(client)
    await login_web(other, owner)
    url = f"{ITEMS}/{item.id}/movements"
    body = {"type": "OUT", "quantity": "7", "reason": "Venta"}

    first, second = await asyncio.gather(client.post(url, json=body), other.post(url, json=body))

    assert sorted([first.status_code, second.status_code]) == [201, 422]
    history = (await client.get(url)).json()
    assert history["total"] == 1
    movement = history["items"][0]
    assert Decimal(movement["quantity_before"]) == 10
    assert Decimal(movement["quantity_after"]) == 3
    assert Decimal((await client.get(ITEMS)).json()["items"][0]["quantity"]) == 3


async def test_adjustment_sets_the_counted_quantity(
    client: httpx.AsyncClient, factory: Factory
) -> None:
    club = await factory.club()
    owner, _ = await factory.staff(club)
    item = await factory.stock_item(club, quantity=Decimal(8))
    await login_web(client, owner)
    url = f"{ITEMS}/{item.id}/movements"

    to_zero = await client.post(
        url, json={"type": "ADJUSTMENT", "target_quantity": "0", "reason": "Rotura"}
    )
    assert to_zero.status_code == 201, to_zero.text
    movement = to_zero.json()["movement"]
    assert (Decimal(movement["quantity_delta"]), Decimal(movement["quantity_after"])) == (-8, 0)

    up = await client.post(
        url, json={"type": "ADJUSTMENT", "target_quantity": "15.250", "reason": "Inventario"}
    )
    assert up.status_code == 201
    movement = up.json()["movement"]
    assert Decimal(movement["quantity_before"]) == 0
    assert Decimal(movement["quantity_delta"]) == Decimal("15.25")
    assert Decimal(up.json()["item"]["quantity"]) == Decimal("15.25")

    same = await client.post(
        url, json={"type": "ADJUSTMENT", "target_quantity": "15.25", "reason": "Recuento"}
    )
    assert same.status_code == 422
    assert (await client.get(url)).json()["total"] == 2


async def test_patch_cannot_change_quantity(client: httpx.AsyncClient, factory: Factory) -> None:
    club = await factory.club()
    owner, _ = await factory.staff(club)
    item = await factory.stock_item(club, quantity=Decimal(4))
    await login_web(client, owner)

    sneaky = await client.patch(f"{ITEMS}/{item.id}", json={"quantity": "100"})
    assert sneaky.status_code == 422
    no_name = await client.patch(f"{ITEMS}/{item.id}", json={"name": None})
    assert no_name.status_code == 422

    ok = await client.patch(
        f"{ITEMS}/{item.id}",
        json={"name": "Toallas", "min_quantity": "10", "unit_price": "1500", "sku": None},
    )
    assert ok.status_code == 200, ok.text
    assert ok.json()["name"] == "Toallas"
    assert Decimal(ok.json()["quantity"]) == 4
    assert ok.json()["is_low_stock"] is True
    assert (await client.get(f"{ITEMS}/{item.id}/movements")).json()["total"] == 0


async def test_deleted_items_are_hidden_and_cannot_move(
    client: httpx.AsyncClient, factory: Factory
) -> None:
    club = await factory.club()
    owner, _ = await factory.staff(club)
    item = await factory.stock_item(club, quantity=Decimal(4))
    await login_web(client, owner)

    assert (await client.delete(f"{ITEMS}/{item.id}")).status_code == 204
    assert (await client.get(ITEMS)).json()["total"] == 0
    assert (await client.get(f"{STOCK}/stats")).json()["total_items"] == 0
    moved = await client.post(
        f"{ITEMS}/{item.id}/movements", json={"type": "IN", "quantity": "1", "reason": "x"}
    )
    assert moved.status_code == 404
    assert (await client.patch(f"{ITEMS}/{item.id}", json={"name": "Otro"})).status_code == 404
    assert (await client.delete(f"{ITEMS}/{item.id}")).status_code == 404
    # El historial de un ítem dado de baja se sigue pudiendo consultar.
    assert (await client.get(f"{ITEMS}/{item.id}/movements")).status_code == 200


async def test_export_csv_neutralizes_formulas(client: httpx.AsyncClient, factory: Factory) -> None:
    club = await factory.club()
    owner, _ = await factory.staff(club)
    await factory.stock_item(
        club,
        name='=HYPERLINK("http://x")',
        quantity=Decimal("2.500"),
        unit_cost=Decimal("10"),
    )
    await login_web(client, owner)

    response = await client.get(f"{ITEMS}/export.csv")
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/csv")
    lines = response.text.lstrip("﻿").splitlines()
    assert lines[0].startswith("SKU,Nombre,Categoría")
    assert "'=HYPERLINK" in lines[1]
    assert ",2.5," in lines[1]
    assert ",25.00," in lines[1]


async def test_stock_requires_stock_permissions(
    client: httpx.AsyncClient, factory: Factory
) -> None:
    club = await factory.club()
    manager, _ = await factory.staff(club, roles=[StaffRole.RESERVATIONS_MANAGER])
    item = await factory.stock_item(club, quantity=Decimal(4))
    await login_web(client, manager)

    assert (await client.get(ITEMS)).status_code == 403
    assert (await client.get(f"{STOCK}/stats")).status_code == 403
    assert (await client.get(f"{ITEMS}/export.csv")).status_code == 403
    assert (await client.post(ITEMS, json={"name": "Nuevo"})).status_code == 403
    moved = await client.post(
        f"{ITEMS}/{item.id}/movements", json={"type": "OUT", "quantity": "1", "reason": "x"}
    )
    assert moved.status_code == 403


async def test_staff_cannot_touch_stock_of_another_club(
    client: httpx.AsyncClient, factory: Factory
) -> None:
    club_a = await factory.club()
    club_b = await factory.club()
    clerk_a, _ = await factory.staff(club_a, roles=[StaffRole.STOCK_MANAGER])
    item_b = await factory.stock_item(club_b, quantity=Decimal(10), category="Ajena")
    await login_web(client, clerk_a)

    url = f"{ITEMS}/{item_b.id}"
    for body in (
        {"type": "OUT", "quantity": "1", "reason": "x"},
        {"type": "ADJUSTMENT", "target_quantity": "0", "reason": "x"},
    ):
        assert (await client.post(f"{url}/movements", json=body)).status_code == 404
    assert (await client.get(f"{url}/movements")).status_code == 404
    assert (await client.patch(url, json={"name": "Robado"})).status_code == 404
    assert (await client.delete(url)).status_code == 404
    assert (await client.get(ITEMS)).json()["total"] == 0
    assert (await client.get(f"{STOCK}/categories")).json() == []

    owner_b, _ = await factory.staff(club_b)
    other = _new_client(client)
    await login_web(other, owner_b)
    item = (await other.get(ITEMS)).json()["items"][0]
    assert (Decimal(item["quantity"]), item["name"]) == (10, item_b.name)
