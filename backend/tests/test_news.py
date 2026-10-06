from datetime import UTC, datetime, timedelta

import httpx
from sqlalchemy import select

from app.domain.enums import MembershipStatus, StaffRole
from app.models import ClubNews
from tests.factories import Factory, login_mobile, login_web

NEWS = "/api/v1/admin/news"


def _future(days: int = 3) -> str:
    return (datetime.now(UTC) + timedelta(days=days)).isoformat()


async def test_owner_publishes_lists_and_deletes_news(
    client: httpx.AsyncClient, factory: Factory
) -> None:
    club = await factory.club()
    owner, _ = await factory.staff(club)
    await factory.news(club, title="Vieja", expires_at=datetime.now(UTC) - timedelta(days=1))
    await login_web(client, owner)

    created = await client.post(
        NEWS,
        json={
            "title": "  Torneo de verano  ",
            "body": "Inscripciones abiertas",
            "tag": "Torneo",
            "expires_at": _future(),
        },
    )
    assert created.status_code == 201, created.text
    news = created.json()
    assert news["title"] == "Torneo de verano"
    assert news["created_by_name"] == owner.full_name
    assert news["is_expired"] is False

    listed = (await client.get(NEWS, params={"page_size": 10})).json()
    assert listed["total"] == 2
    assert [(n["title"], n["is_expired"]) for n in listed["items"]] == [
        ("Torneo de verano", False),
        ("Vieja", True),
    ]

    assert (await client.delete(f"{NEWS}/{news['id']}")).status_code == 204
    assert (await client.delete(f"{NEWS}/{news['id']}")).status_code == 404
    assert (await client.get(NEWS)).json()["total"] == 1


async def test_owner_edits_published_news(client: httpx.AsyncClient, factory: Factory) -> None:
    club = await factory.club()
    author, _ = await factory.staff(club)
    editor, _ = await factory.staff(club)
    news = await factory.news(
        club, title="Torneo", body="Inscripciones", tag="Torneo", created_by_id=author.id
    )
    await login_web(client, editor)
    url = f"{NEWS}/{news.id}"

    edited = await client.patch(
        url,
        json={"title": "  Torneo de verano ", "body": "Cierra el viernes", "expires_at": _future()},
    )
    assert edited.status_code == 200, edited.text
    body = edited.json()
    assert (body["title"], body["body"], body["tag"]) == (
        "Torneo de verano",
        "Cierra el viernes",
        "Torneo",
    )
    assert body["expires_at"] is not None
    assert body["created_by_name"] == author.full_name  # el autor no cambia al editar

    cleared = await client.patch(url, json={"tag": None, "expires_at": None})
    assert (cleared.json()["tag"], cleared.json()["expires_at"]) == (None, None)

    invalid = [
        {"title": None},
        {"body": None},
        {"title": "   "},
        {"tag": "x" * 51},
        {"expires_at": "2020-01-01T10:00:00Z"},
        {"expires_at": "2030-01-01T10:00:00"},
    ]
    for payload in invalid:
        assert (await client.patch(url, json=payload)).status_code == 422, payload
    assert (await client.get(NEWS)).json()["items"][0]["title"] == "Torneo de verano"


async def test_news_validation(client: httpx.AsyncClient, factory: Factory) -> None:
    club = await factory.club()
    owner, _ = await factory.staff(club)
    await login_web(client, owner)

    invalid = [
        {"title": "x" * 201, "body": "ok"},
        {"title": "ok", "body": "x" * 5001},
        {"title": "   ", "body": "ok"},
        {"title": "ok", "body": "ok", "tag": "x" * 51},
        {"title": "ok", "body": "ok", "expires_at": "2030-01-01T10:00:00"},  # sin zona
        {"title": "ok", "body": "ok", "expires_at": "2020-01-01T10:00:00Z"},  # pasada
    ]
    for body in invalid:
        assert (await client.post(NEWS, json=body)).status_code == 422, body
    assert (await client.get(NEWS)).json()["total"] == 0


async def test_news_permissions(client: httpx.AsyncClient, factory: Factory) -> None:
    club = await factory.club()
    news = await factory.news(club)
    manager, _ = await factory.staff(club, roles=[StaffRole.RESERVATIONS_MANAGER])
    clerk, _ = await factory.staff(club, roles=[StaffRole.STOCK_MANAGER])

    await login_web(client, manager)
    assert (await client.get(NEWS)).status_code == 200
    assert (await client.post(NEWS, json={"title": "Hola", "body": "..."})).status_code == 403
    assert (await client.delete(f"{NEWS}/{news.id}")).status_code == 403
    assert (await client.patch(f"{NEWS}/{news.id}", json={"title": "X"})).status_code == 403

    await login_web(client, clerk)
    assert (await client.get(NEWS)).status_code == 403


async def test_staff_cannot_see_or_delete_news_of_another_club(
    client: httpx.AsyncClient, factory: Factory
) -> None:
    club_a = await factory.club()
    club_b = await factory.club()
    owner_a, _ = await factory.staff(club_a)
    news_b = await factory.news(club_b)
    await login_web(client, owner_a)

    assert (await client.get(NEWS)).json()["total"] == 0
    assert (await client.delete(f"{NEWS}/{news_b.id}")).status_code == 404
    assert (await client.patch(f"{NEWS}/{news_b.id}", json={"title": "X"})).status_code == 404
    title = (
        await factory.session.execute(select(ClubNews.title).where(ClubNews.id == news_b.id))
    ).scalar_one()
    assert title == news_b.title


async def test_member_feed_shows_current_news_of_their_clubs_only(
    client: httpx.AsyncClient, factory: Factory
) -> None:
    mine = await factory.club(name="Mi Club", primary_color="#AA0000")
    also_mine = await factory.club(name="Otro Mío")
    pending = await factory.club()
    stranger = await factory.club()
    member = await factory.user()
    await factory.membership(mine, member)
    await factory.membership(also_mine, member)
    await factory.membership(pending, member, status=MembershipStatus.PENDING)

    now = datetime.now(UTC)
    await factory.news(mine, title="Vigente", created_at=now - timedelta(hours=2))
    await factory.news(mine, title="Vencida", expires_at=now - timedelta(minutes=1))
    await factory.news(
        also_mine,
        title="Más nueva",
        created_at=now - timedelta(hours=1),
        expires_at=now + timedelta(days=1),
    )
    await factory.news(pending, title="De club pendiente")
    await factory.news(stranger, title="De club ajeno")
    headers = await login_mobile(client, member)

    feed = await client.get("/api/v1/mobile/news", headers=headers)
    assert feed.status_code == 200
    assert [(n["title"], n["club_name"]) for n in feed.json()] == [
        ("Más nueva", "Otro Mío"),
        ("Vigente", "Mi Club"),
    ]
    assert feed.json()[1]["club_color"] == "#AA0000"

    club_news = await client.get(f"/api/v1/mobile/clubs/{mine.id}/news", headers=headers)
    assert club_news.status_code == 200
    assert [n["title"] for n in club_news.json()["items"]] == ["Vigente"]
    for club in (pending, stranger):
        denied = await client.get(f"/api/v1/mobile/clubs/{club.id}/news", headers=headers)
        assert denied.status_code == 403
