"""
Datos de desarrollo (ficticios). Idempotente: si el club demo ya existe, no hace nada.

Uso:  poetry run python scripts/seed_dev.py
Usa MIGRATIONS_DATABASE_URL (rol dueño, sin RLS). Nunca correr en producción.
"""

import asyncio
import secrets
import sys
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import bcrypt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.core.config import get_settings
from app.domain.enums import (
    CustomerType,
    MembershipStatus,
    ReservationSource,
    ReservationStatus,
    Sport,
    StaffRole,
    StaffStatus,
    StockUnit,
)
from app.models import (
    Club,
    ClubMembership,
    ClubNews,
    ClubStaff,
    Court,
    MembershipPlan,
    Reservation,
    StockItem,
    User,
)

FIRST_NAMES = ["Lucía", "Martín", "Sofía", "Tomás", "Valentina", "Joaquín", "Camila", "Mateo"]
LAST_NAMES = ["Gómez", "Fernández", "López", "Martínez", "Díaz", "Pérez", "Romero", "Sosa"]


async def main() -> None:
    settings = get_settings()
    if settings.is_production:
        raise SystemExit("seed_dev.py no se ejecuta en producción.")

    password = secrets.token_urlsafe(9)
    pw_hash = bcrypt.hashpw(password.encode(), bcrypt.gensalt(12)).decode()
    now = datetime.now(UTC)

    engine = create_async_engine(settings.MIGRATIONS_DATABASE_URL)
    async with async_sessionmaker(engine, expire_on_commit=False)() as session, session.begin():
        if (await session.execute(select(Club).where(Club.slug == "club-demo"))).scalar():
            print(
                "Ya hay datos de demo. Para regenerarlos: alembic downgrade base && upgrade head."
            )
            return

        demo = Club(
            slug="club-demo",
            name="Club Demo",
            sport_types=[Sport.PADEL.value, Sport.TENNIS.value],
            city="Rosario",
            open_time=datetime.strptime("08:00", "%H:%M").time(),  # noqa: DTZ007
            close_time=datetime.strptime("23:00", "%H:%M").time(),  # noqa: DTZ007
            primary_color="#0F172A",
            accent_color="#2563EB",
        )
        other = Club(slug="club-norte", name="Club Norte", sport_types=[Sport.FOOTBALL.value])
        session.add_all([demo, other])
        await session.flush()

        def user(email: str, first: str, last: str, dni: str | None = None) -> User:
            return User(
                email=email,
                password_hash=pw_hash,
                first_name=first,
                last_name=last,
                dni=dni,
                email_verified_at=now,
            )

        owner = user("owner@demo.test", "Olivia", "Dueña")
        clerk = user("recepcion@demo.test", "Ramiro", "Recepción")
        storekeeper = user("deposito@demo.test", "Diego", "Depósito")
        session.add_all([owner, clerk, storekeeper])
        await session.flush()
        session.add_all(
            [
                ClubStaff(
                    club_id=demo.id,
                    user_id=owner.id,
                    email=owner.email,
                    roles=[StaffRole.OWNER.value],
                    status=StaffStatus.ACTIVE,
                ),
                ClubStaff(
                    club_id=other.id,
                    user_id=owner.id,
                    email=owner.email,
                    roles=[StaffRole.OWNER.value],
                    status=StaffStatus.ACTIVE,
                ),
                ClubStaff(
                    club_id=demo.id,
                    user_id=clerk.id,
                    email=clerk.email,
                    roles=[StaffRole.RESERVATIONS_MANAGER.value],
                    status=StaffStatus.ACTIVE,
                ),
                ClubStaff(
                    club_id=demo.id,
                    user_id=storekeeper.id,
                    email=storekeeper.email,
                    roles=[StaffRole.STOCK_MANAGER.value],
                    status=StaffStatus.ACTIVE,
                ),
            ]
        )

        base = MembershipPlan(club_id=demo.id, name="Base", monthly_fee=Decimal("15000"))
        family = MembershipPlan(club_id=demo.id, name="Familiar", monthly_fee=Decimal("32000"))
        session.add_all([base, family])
        await session.flush()

        members: list[User] = []
        for i, (first, last) in enumerate(zip(FIRST_NAMES, LAST_NAMES, strict=True)):
            members.append(user(f"socio{i + 1}@demo.test", first, last, dni=f"3{i}111222"))
        session.add_all(members)
        await session.flush()
        for i, member in enumerate(members):
            status = (
                MembershipStatus.PENDING if i == len(members) - 1 else MembershipStatus.APPROVED
            )
            session.add(
                ClubMembership(
                    club_id=demo.id,
                    user_id=member.id,
                    status=status,
                    plan_id=(family if i % 3 == 0 else base).id if status == "APPROVED" else None,
                    member_number=f"{100 + i}" if status == "APPROVED" else None,
                    joined_on=date(2026, 1 + i % 9, 1) if status == "APPROVED" else None,
                    requested_at=now - timedelta(days=30 - i),
                )
            )

        courts = [
            Court(
                club_id=demo.id,
                name=f"Pádel {n}",
                sport=Sport.PADEL,
                is_indoor=n == 1,
                price_member=Decimal("12000"),
                price_guest=Decimal("18000"),
            )
            for n in (1, 2, 3)
        ] + [
            Court(
                club_id=demo.id,
                name="Tenis 1",
                sport=Sport.TENNIS,
                capacity=2,
                price_member=Decimal("10000"),
                price_guest=Decimal("15000"),
            )
        ]
        session.add_all(courts)
        await session.flush()

        tomorrow_18 = (now + timedelta(days=1)).replace(hour=21, minute=0, second=0, microsecond=0)
        session.add_all(
            [
                Reservation(
                    club_id=demo.id,
                    court_id=courts[0].id,
                    customer_type=CustomerType.MEMBER,
                    user_id=members[0].id,
                    status=ReservationStatus.CONFIRMED,
                    source=ReservationSource.PANEL,
                    starts_at=tomorrow_18,
                    ends_at=tomorrow_18 + timedelta(minutes=90),
                    total_price=Decimal("18000"),
                ),
                Reservation(
                    club_id=demo.id,
                    court_id=courts[1].id,
                    customer_type=CustomerType.MEMBER,
                    user_id=members[1].id,
                    status=ReservationStatus.PENDING,
                    source=ReservationSource.APP,
                    starts_at=tomorrow_18,
                    ends_at=tomorrow_18 + timedelta(minutes=60),
                    total_price=Decimal("12000"),
                ),
                Reservation(
                    club_id=demo.id,
                    court_id=courts[2].id,
                    customer_type=CustomerType.GUEST,
                    guest_name="Invitado Ejemplo",
                    status=ReservationStatus.CONFIRMED,
                    source=ReservationSource.PANEL,
                    starts_at=tomorrow_18,
                    ends_at=tomorrow_18 + timedelta(minutes=60),
                    total_price=Decimal("18000"),
                ),
            ]
        )

        session.add_all(
            [
                StockItem(
                    club_id=demo.id,
                    name="Pelotas de pádel (tubo)",
                    category="Pelotas",
                    unit=StockUnit.PACK,
                    quantity=Decimal("24"),
                    min_quantity=Decimal("10"),
                    unit_cost=Decimal("6500"),
                    unit_price=Decimal("9000"),
                ),
                StockItem(
                    club_id=demo.id,
                    name="Agua mineral 500 ml",
                    category="Bebidas",
                    unit=StockUnit.UNIT,
                    quantity=Decimal("6"),
                    min_quantity=Decimal("12"),
                    unit_cost=Decimal("500"),
                    unit_price=Decimal("1200"),
                ),
            ]
        )
        session.add(
            ClubNews(
                club_id=demo.id,
                title="Torneo de primavera",
                body="Inscripciones abiertas hasta el viernes en recepción.",
                tag="Torneo",
                created_by_id=owner.id,
            )
        )

    await engine.dispose()
    print("Datos de demo creados. Contraseña de todas las cuentas:", password)
    print("  Panel: owner@demo.test (OWNER de 2 clubes), recepcion@demo.test, deposito@demo.test")
    print("  App:   socio1@demo.test … socio8@demo.test (DNI 30111222 …)")


if __name__ == "__main__":
    asyncio.run(main())
