"""Rate limit por identificador (email o usuario), que se suma al de IP, sin revelar cuentas."""

from typing import Any

import httpx
import pytest
from limits import parse

from app.api.rate_limit import limit_email, limiter
from app.core.config import get_settings
from app.core.errors import TooManyRequests
from app.services import auth as auth_service
from tests.factories import PASSWORD, Factory, login_mobile

API = "/api/v1/auth"
WRONG = "otra-contraseña-123"


def _allowed(limit: str) -> int:
    return parse(limit).amount


@pytest.fixture
def ips(monkeypatch: pytest.MonkeyPatch) -> None:
    """Cada test elige la IP del cliente con X-Real-IP, como detrás del proxy de Railway."""
    monkeypatch.setattr(get_settings(), "TRUSTED_IP_HEADER", "x-real-ip")


def _from(ip: str) -> dict[str, str]:
    return {"x-real-ip": ip}


@pytest.fixture
def verify_calls(monkeypatch: pytest.MonkeyPatch) -> list[str | None]:
    """Registra cada verificación de contraseña (bcrypt), con el hash contra el que se hizo."""
    calls: list[str | None] = []
    real = auth_service.verify_password

    async def _spy(plain: str, hashed: str | None) -> bool:
        calls.append(hashed)
        return await real(plain, hashed)

    monkeypatch.setattr(auth_service, "verify_password", _spy)
    return calls


@pytest.fixture
def outbox(monkeypatch: pytest.MonkeyPatch) -> list[str]:
    sent: list[str] = []

    async def _capture(to: str, subject: str, body: str) -> None:
        sent.append(to)

    monkeypatch.setattr(auth_service, "send_email", _capture)
    return sent


async def test_login_is_limited_per_email_across_ips_and_clients(
    client: httpx.AsyncClient, factory: Factory, ips: None
) -> None:
    user = await factory.user()
    other = await factory.user()
    allowed = _allowed(get_settings().LOGIN_EMAIL_RATE_LIMIT)

    # Cada intento desde una IP distinta, alternando panel y app y variando mayúsculas:
    # el límite por IP no los frena, el del email sí.
    for i in range(allowed):
        path = f"{API}/web/login" if i % 2 else f"{API}/mobile/login"
        email = user.email.upper() if i % 3 else user.email
        response = await client.post(
            path, json={"email": email, "password": WRONG}, headers=_from(f"203.0.113.{i}")
        )
        assert response.status_code == 401

    for path in (f"{API}/web/login", f"{API}/mobile/login"):
        # Ni con la contraseña correcta, ni desde una IP nueva.
        blocked = await client.post(
            path, json={"email": user.email, "password": PASSWORD}, headers=_from("198.51.100.1")
        )
        assert blocked.status_code == 429
        assert blocked.json()["error"]["code"] == "rate_limited"

    # Otra cuenta, desde una IP ya usada, entra normalmente.
    ok = await client.post(
        f"{API}/mobile/login",
        json={"email": other.email, "password": PASSWORD},
        headers=_from("203.0.113.0"),
    )
    assert ok.status_code == 200


@pytest.mark.parametrize("exists", [True, False])
async def test_login_lockout_does_not_reveal_whether_the_account_exists(
    client: httpx.AsyncClient,
    factory: Factory,
    verify_calls: list[str | None],
    monkeypatch: pytest.MonkeyPatch,
    exists: bool,
) -> None:
    email = (await factory.user()).email if exists else "nadie@example.com"
    allowed = _allowed(get_settings().LOGIN_EMAIL_RATE_LIMIT)

    responses = [
        await client.post(f"{API}/mobile/login", json={"email": email, "password": WRONG})
        for _ in range(allowed)
    ]
    assert {(r.status_code, r.json()["error"]["code"]) for r in responses} == {
        (401, "invalid_credentials")
    }
    # Mismo tiempo exista o no: un bcrypt por intento (contra el hash dummy si no existe).
    assert len(verify_calls) == allowed
    assert all((hashed is not None) == exists for hashed in verify_calls)

    # Ya bloqueado: 429 sin buscar al usuario ni correr bcrypt.
    lookups: list[str] = []
    real_authenticate = auth_service.AuthService.authenticate

    async def _spy(self: auth_service.AuthService, email: str, password: str) -> Any:
        lookups.append(email)
        return await real_authenticate(self, email, password)

    monkeypatch.setattr(auth_service.AuthService, "authenticate", _spy)
    blocked = await client.post(f"{API}/mobile/login", json={"email": email, "password": WRONG})
    assert blocked.status_code == 429
    assert lookups == []
    assert len(verify_calls) == allowed


async def test_lockout_response_is_the_same_for_existing_and_unknown_accounts(
    client: httpx.AsyncClient, factory: Factory, outbox: list[str]
) -> None:
    user = await factory.user()
    settings = get_settings()

    async def exhaust(path: str, limit: str, email: str, **extra: str) -> list[httpx.Response]:
        return [
            await client.post(path, json={"email": email, **extra})
            for _ in range(_allowed(limit) + 1)
        ]

    for path, limit, extra in (
        (f"{API}/web/login", settings.LOGIN_EMAIL_RATE_LIMIT, {"password": WRONG}),
        (f"{API}/password/forgot", settings.PASSWORD_FORGOT_EMAIL_RATE_LIMIT, {}),
    ):
        known = await exhaust(path, limit, user.email, **extra)
        unknown = await exhaust(path, limit, "nadie@example.com", **extra)
        assert [(r.status_code, r.content) for r in known] == [
            (r.status_code, r.content) for r in unknown
        ]
        assert known[-1].status_code == 429

    # "Olvidé mi contraseña": solo los pedidos dentro del límite mandan el email.
    assert outbox == [user.email] * _allowed(settings.PASSWORD_FORGOT_EMAIL_RATE_LIMIT)


async def test_ip_and_email_limits_add_up(
    client: httpx.AsyncClient, factory: Factory, ips: None, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(get_settings(), "AUTH_RATE_LIMIT", "3/minute")
    user = await factory.user()
    allowed = _allowed(get_settings().LOGIN_EMAIL_RATE_LIMIT)

    async def attempt(ip: str) -> int:
        response = await client.post(
            f"{API}/web/login", json={"email": user.email, "password": WRONG}, headers=_from(ip)
        )
        return response.status_code

    # Una sola IP: corta el límite por IP, y los pedidos que rechaza no gastan el del email.
    assert [await attempt("203.0.113.1") for _ in range(8)] == [401] * 3 + [429] * 5
    # Desde otras IPs quedan los intentos restantes del email, y después corta el del email.
    statuses = [await attempt(f"198.51.100.{i}") for i in range(allowed - 3 + 1)]
    assert statuses == [401] * (allowed - 3) + [429]

    # Los dos 429 son indistinguibles.
    by_ip = await client.post(
        f"{API}/web/login",
        json={"email": "x@example.com", "password": WRONG},
        headers=_from("203.0.113.1"),
    )
    by_email = await client.post(
        f"{API}/web/login",
        json={"email": user.email, "password": WRONG},
        headers=_from("192.0.2.1"),
    )
    assert by_ip.status_code == by_email.status_code == 429
    assert by_ip.content == by_email.content


async def test_register_is_limited_per_email(client: httpx.AsyncClient) -> None:
    allowed = _allowed(get_settings().REGISTER_EMAIL_RATE_LIMIT)
    body = {"email": "nuevo@example.com", "password": PASSWORD, "first_name": "A", "last_name": "B"}
    statuses = [
        (await client.post(f"{API}/register", json=body)).status_code for _ in range(allowed + 1)
    ]
    assert statuses[-1] == 429
    other = {**body, "email": "otro@example.com"}
    assert (await client.post(f"{API}/register", json=other)).status_code == 201


async def test_password_change_is_limited_per_user(
    client: httpx.AsyncClient, factory: Factory
) -> None:
    user = await factory.user()
    headers = await login_mobile(client, user)
    allowed = _allowed(get_settings().PASSWORD_CHANGE_USER_RATE_LIMIT)

    def change(current: str, auth: dict[str, str]):
        return client.post(
            "/api/v1/me/password",
            json={"current_password": current, "new_password": "nueva-contraseña-123"},
            headers=auth,
        )

    for _ in range(allowed):
        wrong = await change(WRONG, headers)
        assert wrong.json()["error"]["code"] == "wrong_password"
    assert (await change(PASSWORD, headers)).status_code == 429

    # El cupo es de ese usuario, no de la IP.
    other_headers = await login_mobile(client, await factory.user())
    assert (await change(PASSWORD, other_headers)).status_code == 204


async def test_verification_resend_is_limited_per_user(
    client: httpx.AsyncClient, factory: Factory, outbox: list[str]
) -> None:
    user = await factory.user(email_verified_at=None)
    headers = await login_mobile(client, user)
    allowed = _allowed(get_settings().VERIFY_RESEND_USER_RATE_LIMIT)

    statuses = [
        (await client.post(f"{API}/verify-email/resend", headers=headers)).status_code
        for _ in range(allowed + 1)
    ]
    assert statuses == [202] * allowed + [429]
    assert len(outbox) == allowed


def test_identifier_limit_keeps_working_if_the_storage_fails(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    # Directo sobre el helper: por HTTP, slowapi también daría el storage por caído y el resto
    # de los tests correría con su respaldo.
    def _unreachable(*_: object) -> bool:
        raise ValueError("storage caído")  # MemoryStorage.base_exceptions

    monkeypatch.setattr(limiter.limiter, "hit", _unreachable)
    for _ in range(3):
        limit_email("test", "caido@example.com", "3/hour")
    with pytest.raises(TooManyRequests):
        limit_email("test", "CAIDO@example.com ", "3/hour")
