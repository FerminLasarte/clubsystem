import asyncio

import httpx
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.domain.enums import FeeStatus, MembershipStatus, StaffRole
from app.models import Payment
from tests.factories import Factory, login_web

FEES = "/api/v1/admin/fees"


async def test_generate_creates_fees_for_approved_members_with_an_active_plan_once(
    client: httpx.AsyncClient, factory: Factory
) -> None:
    club = await factory.club()
    owner, _ = await factory.staff(club)
    base = await factory.plan(club, "Base", "12000.50")
    old_plan = await factory.plan(club, "Viejo", "9000")
    free = await factory.plan(club, "Honorario", "0")
    member, membership = await factory.membership(club, plan=base)
    await factory.membership(club, plan=old_plan)
    await factory.membership(club, plan=free)
    await factory.membership(club)
    await factory.membership(club, status=MembershipStatus.PENDING, plan=base)
    other_club = await factory.club()
    await factory.membership(other_club, plan=await factory.plan(other_club))

    old_plan.is_active = False
    factory.session.add(old_plan)
    await factory.session.commit()
    await login_web(client, owner)

    first = await client.post(f"{FEES}/generate", json={"year": 2026, "month": 2, "due_day": 31})
    assert first.status_code == 200, first.text
    assert first.json() == {"created": 1, "skipped": 0, "without_plan": 3}
    second = await client.post(f"{FEES}/generate", json={"year": 2026, "month": 2, "due_day": 31})
    assert second.json() == {"created": 0, "skipped": 1, "without_plan": 3}

    page = (await client.get(FEES, params={"year": 2026, "month": 2})).json()
    assert page["total"] == 1
    fee = page["items"][0]
    assert fee["membership_id"] == str(membership.id)
    assert fee["member_name"] == member.full_name
    assert (fee["plan_name"], fee["amount"], fee["status"]) == ("Base", "12000.50", "PENDING")
    assert fee["due_date"] == "2026-02-28"


async def test_generate_does_not_revive_a_cancelled_fee(
    client: httpx.AsyncClient, factory: Factory
) -> None:
    club = await factory.club()
    owner, _ = await factory.staff(club)
    plan = await factory.plan(club)
    _, membership = await factory.membership(club, plan=plan)
    await factory.fee(membership, 2026, 4, status=FeeStatus.CANCELLED)
    await login_web(client, owner)

    result = await client.post(f"{FEES}/generate", json={"year": 2026, "month": 4})
    assert result.json() == {"created": 0, "skipped": 1, "without_plan": 0}


async def test_list_filters_searches_and_paginates(
    client: httpx.AsyncClient, factory: Factory
) -> None:
    club = await factory.club()
    owner, _ = await factory.staff(club)
    ana_user = await factory.user(first_name="Ana", last_name="Zapata")
    _, ana = await factory.membership(club, user=ana_user)
    _, bruno = await factory.membership(club, user=await factory.user(first_name="Bruno"))
    await factory.fee(ana, 2026, 5)
    await factory.fee(bruno, 2026, 5, status=FeeStatus.CANCELLED)
    await factory.fee(ana, 2026, 6)
    await login_web(client, owner)

    searched = (await client.get(FEES, params={"search": "ana zap"})).json()
    assert searched["total"] == 2
    assert [f["month"] for f in searched["items"]] == [6, 5]
    cancelled = (await client.get(FEES, params={"status": "CANCELLED"})).json()
    assert [f["membership_id"] for f in cancelled["items"]] == [str(bruno.id)]
    paged = (await client.get(FEES, params={"page": 2, "page_size": 2})).json()
    assert (paged["total"], len(paged["items"]), paged["page"]) == (3, 1, 2)
    assert (await client.get(FEES, params={"page_size": 500})).status_code == 422
    # Un comodín de LIKE se busca literal.
    assert (await client.get(FEES, params={"search": "%"})).json()["total"] == 0


async def test_paying_a_fee_records_it_in_the_cash_book(
    client: httpx.AsyncClient, factory: Factory
) -> None:
    club = await factory.club()
    owner, _ = await factory.staff(club)
    member, membership = await factory.membership(club)
    fee = await factory.fee(membership, 2026, 3, amount="15000")
    await login_web(client, owner)

    paid = await client.post(f"{FEES}/{fee.id}/pay", json={"method": "MERCADOPAGO"})
    assert paid.status_code == 200
    body = paid.json()
    assert (body["status"], body["payment_method"], body["is_overdue"]) == (
        "PAID",
        "MERCADOPAGO",
        False,
    )
    assert body["paid_at"] is not None

    day = (await client.get("/api/v1/admin/cash/day")).json()
    [movement] = day["movements"]
    assert movement["id"] == body["payment_id"]
    assert movement["amount"] == "15000.00"
    assert movement["member"]["full_name"] == member.full_name
    assert "03/2026" in movement["description"]

    again = await client.post(f"{FEES}/{fee.id}/pay", json={"method": "CASH"})
    assert again.status_code == 409


async def test_concurrent_payments_of_the_same_fee_charge_once(
    client: httpx.AsyncClient,
    factory: Factory,
    owner_sessionmaker: async_sessionmaker[AsyncSession],
) -> None:
    club = await factory.club()
    owner, _ = await factory.staff(club)
    _, membership = await factory.membership(club)
    fee = await factory.fee(membership, 2026, 3)
    await login_web(client, owner)

    responses = await asyncio.gather(
        client.post(f"{FEES}/{fee.id}/pay", json={"method": "CASH"}),
        client.post(f"{FEES}/{fee.id}/pay", json={"method": "CARD"}),
    )
    assert sorted(r.status_code for r in responses) == [200, 409]
    async with owner_sessionmaker() as session:
        payments = (await session.execute(select(func.count()).select_from(Payment))).scalar_one()
    assert payments == 1


async def test_cancel_only_pending_fees(client: httpx.AsyncClient, factory: Factory) -> None:
    club = await factory.club()
    owner, _ = await factory.staff(club)
    _, membership = await factory.membership(club)
    pending = await factory.fee(membership, 2026, 1)
    to_pay = await factory.fee(membership, 2026, 2)
    await login_web(client, owner)

    cancelled = await client.post(f"{FEES}/{pending.id}/cancel")
    assert cancelled.status_code == 200
    assert cancelled.json()["status"] == "CANCELLED"
    assert cancelled.json()["cancelled_at"] is not None
    assert (
        await client.post(f"{FEES}/{pending.id}/pay", json={"method": "CASH"})
    ).status_code == 409

    await client.post(f"{FEES}/{to_pay.id}/pay", json={"method": "CASH"})
    assert (await client.post(f"{FEES}/{to_pay.id}/cancel")).status_code == 409


async def test_summary_by_period(client: httpx.AsyncClient, factory: Factory) -> None:
    club = await factory.club()
    owner, _ = await factory.staff(club)
    memberships = [(await factory.membership(club))[1] for _ in range(4)]
    paid = await factory.fee(memberships[0], 2026, 7, amount="1000")
    await factory.fee(memberships[1], 2026, 7, amount="2000")
    await factory.fee(memberships[2], 2026, 7, amount="4000", status=FeeStatus.CANCELLED)
    await factory.fee(memberships[3], 2026, 8, amount="8000")
    await login_web(client, owner)
    await client.post(f"{FEES}/{paid.id}/pay", json={"method": "CASH"})

    summary = (await client.get(f"{FEES}/summary", params={"year": 2026, "month": 7})).json()
    assert summary == {
        "year": 2026,
        "month": 7,
        "issued": {"count": 2, "amount": "3000.00"},
        "collected": {"count": 1, "amount": "1000.00"},
        "pending": {"count": 1, "amount": "2000.00"},
    }
    empty = (await client.get(f"{FEES}/summary", params={"year": 2026, "month": 1})).json()
    assert empty["issued"] == {"count": 0, "amount": "0.00"}


async def test_fees_of_another_club_are_not_found(
    client: httpx.AsyncClient, factory: Factory
) -> None:
    club_a = await factory.club()
    club_b = await factory.club()
    owner_a, _ = await factory.staff(club_a)
    _, membership_b = await factory.membership(club_b)
    fee_b = await factory.fee(membership_b, 2026, 3)
    await login_web(client, owner_a)

    assert (await client.post(f"{FEES}/{fee_b.id}/pay", json={"method": "CASH"})).status_code == 404
    assert (await client.post(f"{FEES}/{fee_b.id}/cancel")).status_code == 404
    assert (await client.get(FEES)).json()["total"] == 0
    summary = (await client.get(f"{FEES}/summary", params={"year": 2026, "month": 3})).json()
    assert summary["issued"]["count"] == 0


async def test_fees_require_fee_permissions(client: httpx.AsyncClient, factory: Factory) -> None:
    club = await factory.club()
    manager, _ = await factory.staff(club, roles=[StaffRole.RESERVATIONS_MANAGER])
    _, membership = await factory.membership(club)
    fee = await factory.fee(membership, 2026, 3)
    await login_web(client, manager)

    assert (await client.get(FEES)).status_code == 403
    assert (
        await client.get(f"{FEES}/summary", params={"year": 2026, "month": 3})
    ).status_code == 403
    assert (
        await client.post(f"{FEES}/generate", json={"year": 2026, "month": 3})
    ).status_code == 403
    assert (await client.post(f"{FEES}/{fee.id}/pay", json={"method": "CASH"})).status_code == 403
    assert (await client.post(f"{FEES}/{fee.id}/cancel")).status_code == 403
