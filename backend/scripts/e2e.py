"""
Base y API para los tests e2e de humo (Playwright en apps/web, Maestro en apps/mobile).

  python scripts/e2e.py seed           # vacía la base de test y carga e2e_fixtures.json
  python scripts/e2e.py serve --port 8001

Usa TEST_DATABASE_URL y TEST_MIGRATIONS_DATABASE_URL (del entorno o de backend/.env), la misma
base que pytest: no correr los dos a la vez. Se niega a tocar una base cuyo nombre no termine
en `_test`.
"""

import argparse
import asyncio
import json
import os
import subprocess
import sys
from datetime import UTC, date, datetime, time, timedelta
from decimal import Decimal
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy.engine import make_url

BACKEND = Path(__file__).resolve().parents[1]
FIXTURES = json.loads((Path(__file__).with_name("e2e_fixtures.json")).read_text())
TIMEZONE = "America/Argentina/Buenos_Aires"


class _TestDatabases(BaseSettings):
    model_config = SettingsConfigDict(env_file=BACKEND / ".env", extra="ignore")

    TEST_DATABASE_URL: str
    TEST_MIGRATIONS_DATABASE_URL: str


def _e2e_environment() -> dict[str, str]:
    dbs = _TestDatabases()  # type: ignore[call-arg]  # los valores vienen del entorno
    for url in (dbs.TEST_DATABASE_URL, dbs.TEST_MIGRATIONS_DATABASE_URL):
        if not (make_url(url).database or "").endswith("_test"):
            raise SystemExit("Los e2e solo corren contra una base cuyo nombre termine en _test.")
    return {
        "ENV": "test",
        "DATABASE_URL": dbs.TEST_DATABASE_URL,
        "MIGRATIONS_DATABASE_URL": dbs.TEST_MIGRATIONS_DATABASE_URL,
        "JWT_SECRET_KEY": "e2e-secret-" + "x" * 40,
        "COOKIE_SECURE": "false",
        "AUTH_RATE_LIMIT": "1000/minute",
        "EMAIL_BACKEND": "console",
        "ANTHROPIC_API_KEY": "",
        "PROXY_SHARED_SECRET": "",
        "TRUSTED_IP_HEADER": "",
    }


# El entorno se fija antes de importar la app (Settings se lee una sola vez).
os.environ.update(_e2e_environment())
sys.path.insert(0, str(BACKEND))

import bcrypt  # noqa: E402
from sqlalchemy import text  # noqa: E402
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine  # noqa: E402

from app.core.time import today_in, tz, utcnow  # noqa: E402
from app.domain.enums import (  # noqa: E402
    CustomerType,
    FeeStatus,
    MembershipStatus,
    ReservationSource,
    ReservationStatus,
    Sport,
    StaffRole,
    StaffStatus,
)
from app.models import (  # noqa: E402
    Base,
    Club,
    ClubMembership,
    ClubStaff,
    Court,
    MembershipFee,
    MembershipPlan,
    Reservation,
    User,
)


def migrate() -> None:
    subprocess.run([sys.executable, "-m", "alembic", "upgrade", "head"], cwd=BACKEND, check=True)


async def seed() -> None:
    engine = create_async_engine(os.environ["MIGRATIONS_DATABASE_URL"])
    zone = tz(TIMEZONE)
    today = today_in(zone)
    now = utcnow()
    pw_hash = bcrypt.hashpw(FIXTURES["password"].encode(), bcrypt.gensalt()).decode()
    first_name, last_name = FIXTURES["member_name"].split(" ", 1)

    async with async_sessionmaker(engine, expire_on_commit=False)() as session, session.begin():
        tables = ", ".join(t.name for t in Base.metadata.sorted_tables)
        await session.execute(text(f"TRUNCATE {tables} CASCADE"))

        club = Club(
            slug="club-e2e",
            name=FIXTURES["club_name"],
            sport_types=[Sport.PADEL.value],
            timezone=TIMEZONE,
            open_time=time(8),
            close_time=time(23),
        )
        owner = User(
            email=FIXTURES["owner_email"],
            password_hash=pw_hash,
            first_name="Dueña",
            last_name="E2E",
            email_verified_at=now,
        )
        member = User(
            email=FIXTURES["member_email"],
            password_hash=pw_hash,
            first_name=first_name,
            last_name=last_name,
            email_verified_at=now,
        )
        session.add_all([club, owner, member])
        await session.flush()

        plan = MembershipPlan(club_id=club.id, name="Base", monthly_fee=Decimal("15000"))
        courts = [
            Court(
                club_id=club.id,
                name=name,
                sport=Sport.PADEL,
                price_member=Decimal("12000"),
                price_guest=Decimal("18000"),
            )
            for name in FIXTURES["courts"]
        ]
        session.add_all([plan, *courts])
        await session.flush()

        membership = ClubMembership(
            club_id=club.id,
            user_id=member.id,
            status=MembershipStatus.APPROVED,
            plan_id=plan.id,
            member_number="1",
            joined_on=today,
            requested_at=now,
            decided_at=now,
        )
        session.add_all(
            [
                ClubStaff(
                    club_id=club.id,
                    user_id=owner.id,
                    email=owner.email,
                    roles=[StaffRole.OWNER.value],
                    status=StaffStatus.ACTIVE,
                ),
                membership,
            ]
        )
        await session.flush()

        # Lo que el panel tiene que resolver: una reserva de la app sin confirmar (mañana,
        # en la última cancha) y la cuota del mes sin cobrar.
        hour, minute = map(int, FIXTURES["pending_reservation_time"].split(":"))
        starts_at = datetime.combine(today + timedelta(days=1), time(hour, minute), tzinfo=zone)
        session.add_all(
            [
                Reservation(
                    club_id=club.id,
                    court_id=courts[-1].id,
                    customer_type=CustomerType.MEMBER,
                    user_id=member.id,
                    status=ReservationStatus.PENDING,
                    source=ReservationSource.APP,
                    starts_at=starts_at.astimezone(UTC),
                    ends_at=(starts_at + timedelta(hours=1)).astimezone(UTC),
                    total_price=courts[-1].price_member,
                ),
                MembershipFee(
                    club_id=club.id,
                    membership_id=membership.id,
                    plan_name=plan.name,
                    year=today.year,
                    month=today.month,
                    amount=plan.monthly_fee,
                    status=FeeStatus.PENDING,
                    due_date=date(today.year, today.month, 10),
                ),
            ]
        )

    await engine.dispose()
    print(f"Base e2e lista: {FIXTURES['club_name']}, {FIXTURES['owner_email']} (panel) ", end="")
    print(f"y {FIXTURES['member_email']} (app).")


def serve(port: int) -> None:
    uvicorn = [sys.executable, "-m", "uvicorn", "app.main:app", "--port", str(port)]
    os.chdir(BACKEND)
    os.execv(sys.executable, uvicorn)  # noqa: S606


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Base y API para los e2e de humo.")
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("seed", help="vacía la base de test y carga los datos de e2e")
    serve_parser = commands.add_parser("serve", help="levanta la API contra la base de test")
    serve_parser.add_argument("--port", type=int, default=8001)
    args = parser.parse_args()
    if args.command == "seed":
        migrate()
        asyncio.run(seed())
    else:
        serve(args.port)
