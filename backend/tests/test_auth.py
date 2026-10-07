import re

import httpx
import pytest

from app.api.deps import ACCESS_COOKIE, REFRESH_COOKIE
from app.core.security import verify_password
from app.domain.enums import StaffRole, StaffStatus
from app.services import auth as auth_service
from tests.factories import PASSWORD, Factory, login_mobile, login_web, switch_club

API = "/api/v1/auth"


@pytest.fixture
def outbox(monkeypatch: pytest.MonkeyPatch) -> list[tuple[str, str, str]]:
    sent: list[tuple[str, str, str]] = []

    async def _capture(to: str, subject: str, body: str) -> None:
        sent.append((to, subject, body))

    monkeypatch.setattr(auth_service, "send_email", _capture)
    return sent


def _token_from(body: str) -> str:
    match = re.search(r"token=([\w-]+)", body)
    assert match
    return match.group(1)


async def test_web_login_sets_httponly_cookies_and_prefers_owner_club(
    client: httpx.AsyncClient, factory: Factory
) -> None:
    club_a = await factory.club(name="A")
    club_b = await factory.club(name="B")
    user, _ = await factory.staff(club_a, roles=[StaffRole.STOCK_MANAGER])
    await factory.staff(club_b, user=user, roles=[StaffRole.OWNER])

    response = await login_web(client, user)

    body = response.json()
    assert body["active_club"]["club_id"] == str(club_b.id)
    assert {c["club_id"] for c in body["clubs"]} == {str(club_a.id), str(club_b.id)}
    assert "access_token" not in body
    cookies = response.headers.get_list("set-cookie")
    assert any(c.startswith(f"{ACCESS_COOKIE}=") and "HttpOnly" in c for c in cookies)
    assert any(f"{REFRESH_COOKIE}=" in c and "Path=/api/v1/auth" in c for c in cookies)


async def test_login_errors_do_not_reveal_whether_the_email_exists(
    client: httpx.AsyncClient, factory: Factory
) -> None:
    user = await factory.user()
    wrong = await client.post(f"{API}/web/login", json={"email": user.email, "password": "x" * 12})
    unknown = await client.post(
        f"{API}/web/login", json={"email": "nadie@example.com", "password": "x" * 12}
    )
    assert wrong.status_code == unknown.status_code == 401
    assert wrong.json() == unknown.json()


async def test_web_login_requires_staff(client: httpx.AsyncClient, factory: Factory) -> None:
    user = await factory.user()
    response = await client.post(
        f"{API}/web/login", json={"email": user.email, "password": PASSWORD}
    )
    assert response.status_code == 403
    assert response.json()["error"]["code"] == "no_staff"


async def test_cookie_auth_requires_csrf_header_on_mutations(
    client: httpx.AsyncClient, factory: Factory
) -> None:
    club = await factory.club()
    user, _ = await factory.staff(club)
    await login_web(client, user)

    response = await client.post(
        f"{API}/web/switch-club",
        json={"club_id": str(club.id)},
        headers={"x-requested-with": ""},
    )
    assert response.status_code == 403
    assert response.json()["error"]["code"] == "csrf"


async def test_refresh_rotates_and_reuse_revokes_the_whole_family(
    client: httpx.AsyncClient, factory: Factory
) -> None:
    club = await factory.club()
    user, _ = await factory.staff(club)
    await login_web(client, user)
    first_refresh = client.cookies.get(REFRESH_COOKIE)

    rotated = await client.post(f"{API}/web/refresh")
    assert rotated.status_code == 200
    second_refresh = client.cookies.get(REFRESH_COOKIE)
    assert second_refresh != first_refresh

    # Alguien presenta el refresh viejo: se revoca la familia completa.
    client.cookies.set(REFRESH_COOKIE, first_refresh or "", path="/api/v1/auth")
    reused = await client.post(f"{API}/web/refresh")
    assert reused.status_code == 401
    assert reused.json()["error"]["code"] == "refresh_reused"

    client.cookies.set(REFRESH_COOKIE, second_refresh or "", path="/api/v1/auth")
    after = await client.post(f"{API}/web/refresh")
    assert after.status_code == 401


async def test_logout_invalidates_the_access_token_immediately(
    client: httpx.AsyncClient, factory: Factory
) -> None:
    club = await factory.club()
    user, _ = await factory.staff(club)
    await login_web(client, user)
    access = client.cookies.get(ACCESS_COOKIE)

    assert (await client.post(f"{API}/logout")).status_code == 204

    client.cookies.set(ACCESS_COOKIE, access or "")
    response = await client.get(f"{API}/web/session")
    assert response.status_code == 401


async def test_revoked_staff_loses_access_without_waiting_for_token_expiry(
    client: httpx.AsyncClient, factory: Factory
) -> None:
    club = await factory.club()
    user, staff = await factory.staff(club)
    await login_web(client, user)

    staff.status = StaffStatus.REVOKED
    await factory.session.commit()

    response = await client.get(f"{API}/web/session")
    assert response.status_code == 403
    assert response.json()["error"]["code"] == "staff_revoked"


async def test_switch_club_rejects_clubs_without_access(
    client: httpx.AsyncClient, factory: Factory
) -> None:
    mine = await factory.club()
    other = await factory.club()
    user, _ = await factory.staff(mine)
    await login_web(client, user)

    response = await client.post(f"{API}/web/switch-club", json={"club_id": str(other.id)})
    assert response.status_code == 403
    await switch_club(client, mine)


async def test_mobile_login_with_email_returns_tokens_and_memberships(
    client: httpx.AsyncClient, factory: Factory
) -> None:
    club = await factory.club()
    user, _ = await factory.membership(club, await factory.user(dni="30111222"))

    response = await client.post(
        f"{API}/mobile/login", json={"email": user.email.upper(), "password": PASSWORD}
    )
    assert response.status_code == 200
    body = response.json()
    assert body["user"]["email"] == user.email
    assert [m["club_id"] for m in body["memberships"]] == [str(club.id)]

    refreshed = await client.post(
        f"{API}/mobile/refresh", json={"refresh_token": body["refresh_token"]}
    )
    assert refreshed.status_code == 200


async def test_mobile_login_does_not_accept_the_dni(
    client: httpx.AsyncClient, factory: Factory
) -> None:
    club = await factory.club()
    await factory.membership(club, await factory.user(dni="30111222"))

    by_dni = await client.post(
        f"{API}/mobile/login", json={"email": "30111222", "password": PASSWORD}
    )
    assert by_dni.status_code == 422
    legacy = await client.post(
        f"{API}/mobile/login", json={"identifier": "30111222", "password": PASSWORD}
    )
    assert legacy.status_code == 422


_REGISTER = {
    "password": "una-contraseña-larga",
    "first_name": "Ana",
    "last_name": "Pérez",
}
# Distintos en cada respuesta, exista o no la cuenta.
_PER_REQUEST_HEADERS = {"date", "x-request-id"}


def _comparable(response: httpx.Response) -> tuple[int, bytes, dict[str, str]]:
    headers = {k: v for k, v in response.headers.items() if k not in _PER_REQUEST_HEADERS}
    return response.status_code, response.content, headers


@pytest.mark.parametrize(
    "existing",
    [
        {},
        {"email_verified_at": None},
        {"is_active": False},
    ],
    ids=["verificada", "sin-confirmar", "inactiva"],
)
async def test_register_responds_the_same_whether_the_email_exists(
    client: httpx.AsyncClient,
    factory: Factory,
    outbox: list[tuple[str, str, str]],
    monkeypatch: pytest.MonkeyPatch,
    existing: dict[str, object],
) -> None:
    user = await factory.user(email="ana@example.com", **existing)
    # El tiempo lo domina bcrypt: los dos caminos tienen que hashear una vez.
    hashes: list[str] = []
    real_hash = auth_service.hash_password

    async def _counting_hash(password: str) -> str:
        hashes.append(password)
        return await real_hash(password)

    monkeypatch.setattr(auth_service, "hash_password", _counting_hash)

    taken = await client.post(f"{API}/register", json={**_REGISTER, "email": "Ana@Example.com"})
    hashes_taken = len(hashes)
    new = await client.post(f"{API}/register", json={**_REGISTER, "email": "nueva@example.com"})

    assert taken.status_code == 202
    assert _comparable(taken) == _comparable(new)
    assert hashes_taken == len(hashes) - hashes_taken == 1

    # La cuenta existente no cambia: ni contraseña ni datos.
    await factory.session.refresh(user)
    assert user.first_name == "Nombre"
    assert await verify_password(PASSWORD, user.password_hash)

    expected = [("nueva@example.com", "Confirmá tu email")]
    if user.is_active:
        expected.insert(0, ("ana@example.com", "Ya tenés una cuenta en ClubSystem"))
    assert [(to, subject) for to, subject, _ in outbox] == expected


async def test_register_opens_no_session_until_the_email_is_confirmed(
    client: httpx.AsyncClient, outbox: list[tuple[str, str, str]]
) -> None:
    email = "nueva@example.com"
    created = await client.post(f"{API}/register", json={**_REGISTER, "email": "Nueva@Example.com"})
    assert created.status_code == 202
    assert created.json() is None

    login = {"email": email, "password": _REGISTER["password"]}
    before = await client.post(f"{API}/mobile/login", json=login)
    unknown = await client.post(f"{API}/mobile/login", json={**login, "email": "nadie@example.com"})
    # Sin confirmar, el mismo error que una cuenta inexistente: registrar un email ajeno y
    # entrar con esa contraseña no revela si ya tenía cuenta.
    assert before.status_code == unknown.status_code == 401
    assert before.json() == unknown.json()

    token = _token_from(outbox[0][2])
    assert (await client.post(f"{API}/verify-email", json={"token": token})).status_code == 204
    assert (await client.post(f"{API}/verify-email", json={"token": token})).status_code == 422

    after = await client.post(f"{API}/mobile/login", json=login)
    assert after.status_code == 200
    assert after.json()["user"]["email"] == email
    assert after.json()["user"]["email_verified"] is True


async def test_registering_an_existing_email_lets_its_owner_recover_it(
    client: httpx.AsyncClient, factory: Factory, outbox: list[tuple[str, str, str]]
) -> None:
    # Cuenta registrada por otra persona con un email ajeno: nunca se confirmó.
    squatter = await factory.user(email="ana@example.com", email_verified_at=None)

    await client.post(f"{API}/register", json={**_REGISTER, "email": squatter.email})
    token = _token_from(outbox[0][2])
    reset = await client.post(
        f"{API}/password/reset", json={"token": token, "new_password": "la-de-la-duena-real"}
    )
    assert reset.status_code == 204

    login = await client.post(
        f"{API}/mobile/login",
        json={"email": squatter.email, "password": "la-de-la-duena-real"},
    )
    assert login.status_code == 200
    assert login.json()["user"]["email_verified"] is True
    old = await client.post(
        f"{API}/mobile/login", json={"email": squatter.email, "password": PASSWORD}
    )
    assert old.status_code == 401


async def test_register_rejects_short_passwords(client: httpx.AsyncClient) -> None:
    response = await client.post(
        f"{API}/register",
        json={"email": "a@example.com", "password": "corta", "first_name": "A", "last_name": "B"},
    )
    assert response.status_code == 422


async def test_password_reset_changes_password_and_revokes_sessions(
    client: httpx.AsyncClient, factory: Factory, outbox: list[tuple[str, str, str]]
) -> None:
    user = await factory.user()
    headers = await login_mobile(client, user)

    unknown = await client.post(f"{API}/password/forgot", json={"email": "nadie@example.com"})
    known = await client.post(f"{API}/password/forgot", json={"email": user.email})
    assert unknown.status_code == known.status_code == 202
    assert len(outbox) == 1

    token = _token_from(outbox[0][2])
    reset = await client.post(
        f"{API}/password/reset", json={"token": token, "new_password": "otra-contraseña-larga"}
    )
    assert reset.status_code == 204

    assert (await client.get(f"{API}/mobile/session", headers=headers)).status_code == 401
    old = await client.post(f"{API}/mobile/login", json={"email": user.email, "password": PASSWORD})
    assert old.status_code == 401
    new = await client.post(
        f"{API}/mobile/login",
        json={"email": user.email, "password": "otra-contraseña-larga"},
    )
    assert new.status_code == 200


async def test_inactive_user_cannot_use_existing_tokens(
    client: httpx.AsyncClient, factory: Factory
) -> None:
    user = await factory.user()
    headers = await login_mobile(client, user)
    user.is_active = False
    await factory.session.commit()
    assert (await client.get(f"{API}/mobile/session", headers=headers)).status_code == 401
