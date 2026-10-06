"""Creación de datos de prueba con el rol dueño (sin RLS). Cada método hace commit."""

import itertools
from datetime import UTC, date, datetime
from decimal import Decimal

import bcrypt
import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.enums import (
    CustomerType,
    ExpenseCategory,
    FeeStatus,
    MembershipStatus,
    PaymentMethod,
    ReservationSource,
    ReservationStatus,
    Sport,
    StaffRole,
    StaffStatus,
    TransactionType,
)
from app.models import (
    Club,
    ClubMembership,
    ClubNews,
    ClubStaff,
    Court,
    Expense,
    MembershipFee,
    MembershipPlan,
    Payment,
    Reservation,
    StockItem,
    User,
)

PASSWORD = "contraseña-segura-123"
# bcrypt con costo bajo: solo para tests.
_PASSWORD_HASH = bcrypt.hashpw(PASSWORD.encode(), bcrypt.gensalt(4)).decode()
_seq = itertools.count(1)


class Factory:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def _save[T](self, obj: T) -> T:
        self.session.add(obj)
        await self.session.commit()
        return obj

    async def club(self, **kw: object) -> Club:
        n = next(_seq)
        defaults: dict[str, object] = {
            "slug": f"club-{n}",
            "name": f"Club {n}",
            "sport_types": [Sport.PADEL.value],
        }
        return await self._save(Club(**{**defaults, **kw}))

    async def user(self, **kw: object) -> User:
        n = next(_seq)
        defaults: dict[str, object] = {
            "email": f"user{n}@example.com",
            "password_hash": _PASSWORD_HASH,
            "first_name": "Nombre",
            "last_name": f"Apellido{n}",
            "email_verified_at": datetime.now(UTC),
        }
        return await self._save(User(**{**defaults, **kw}))

    async def staff(
        self, club: Club, user: User | None = None, roles: list[StaffRole] | None = None
    ) -> tuple[User, ClubStaff]:
        user = user or await self.user()
        staff = await self._save(
            ClubStaff(
                club_id=club.id,
                user_id=user.id,
                email=user.email,
                roles=[r.value for r in (roles or [StaffRole.OWNER])],
                status=StaffStatus.ACTIVE,
            )
        )
        return user, staff

    async def plan(self, club: Club, name: str = "Base", fee: str = "10000") -> MembershipPlan:
        return await self._save(
            MembershipPlan(club_id=club.id, name=name, monthly_fee=Decimal(fee))
        )

    async def membership(
        self,
        club: Club,
        user: User | None = None,
        status: MembershipStatus = MembershipStatus.APPROVED,
        plan: MembershipPlan | None = None,
    ) -> tuple[User, ClubMembership]:
        user = user or await self.user()
        membership = await self._save(
            ClubMembership(
                club_id=club.id,
                user_id=user.id,
                status=status,
                plan_id=plan.id if plan else None,
                joined_on=date.today() if status == MembershipStatus.APPROVED else None,
            )
        )
        return user, membership

    async def court(self, club: Club, **kw: object) -> Court:
        n = next(_seq)
        defaults: dict[str, object] = {
            "club_id": club.id,
            "name": f"Cancha {n}",
            "sport": Sport.PADEL,
            "price_member": Decimal("8000"),
            "price_guest": Decimal("12000"),
        }
        return await self._save(Court(**{**defaults, **kw}))

    async def reservation(
        self, court: Court, user: User, starts_at: datetime, ends_at: datetime, **kw: object
    ) -> Reservation:
        defaults: dict[str, object] = {
            "club_id": court.club_id,
            "court_id": court.id,
            "customer_type": CustomerType.MEMBER,
            "user_id": user.id,
            "status": ReservationStatus.CONFIRMED,
            "source": ReservationSource.PANEL,
            "starts_at": starts_at,
            "ends_at": ends_at,
            "total_price": Decimal("8000"),
        }
        return await self._save(Reservation(**{**defaults, **kw}))

    async def stock_item(self, club: Club, **kw: object) -> StockItem:
        n = next(_seq)
        defaults: dict[str, object] = {"club_id": club.id, "name": f"Item {n}"}
        return await self._save(StockItem(**{**defaults, **kw}))

    async def news(self, club: Club, **kw: object) -> ClubNews:
        n = next(_seq)
        defaults: dict[str, object] = {"club_id": club.id, "title": f"Novedad {n}", "body": "..."}
        return await self._save(ClubNews(**{**defaults, **kw}))

    async def payment(self, club: Club, amount: str = "1000", **kw: object) -> Payment:
        defaults: dict[str, object] = {
            "club_id": club.id,
            "type": TransactionType.INCOME,
            "amount": Decimal(amount),
            "method": PaymentMethod.CASH,
            "description": "Movimiento de prueba",
            "occurred_at": datetime.now(UTC),
        }
        return await self._save(Payment(**{**defaults, **kw}))

    async def reservation_payment(
        self, reservation: Reservation, amount: str, **kw: object
    ) -> Payment:
        defaults: dict[str, object] = {
            "club_id": reservation.club_id,
            "reservation_id": reservation.id,
            "type": TransactionType.INCOME,
            "amount": Decimal(amount),
            "method": PaymentMethod.CASH,
            "description": "Cobro de reserva",
            "occurred_at": datetime.now(UTC),
        }
        return await self._save(Payment(**{**defaults, **kw}))

    async def fee(
        self, membership: ClubMembership, year: int, month: int, amount: str = "10000", **kw: object
    ) -> MembershipFee:
        defaults: dict[str, object] = {
            "club_id": membership.club_id,
            "membership_id": membership.id,
            "plan_name": "Base",
            "year": year,
            "month": month,
            "amount": Decimal(amount),
            "status": FeeStatus.PENDING,
            "due_date": date(year, month, 10),
        }
        return await self._save(MembershipFee(**{**defaults, **kw}))

    async def expense(self, club: Club, amount: str = "1000", **kw: object) -> Expense:
        """Gasto cargado directo en la base (sin pasar por el análisis estadístico)."""
        defaults: dict[str, object] = {
            "club_id": club.id,
            "category": ExpenseCategory.MAINTENANCE,
            "description": "Gasto de prueba",
            "amount": Decimal(amount),
            "expense_date": date.today(),
        }
        return await self._save(Expense(**{**defaults, **kw}))


async def login_web(client: httpx.AsyncClient, user: User) -> httpx.Response:
    response = await client.post(
        "/api/v1/auth/web/login", json={"email": user.email, "password": PASSWORD}
    )
    assert response.status_code == 200, response.text
    return response


async def switch_club(client: httpx.AsyncClient, club: Club) -> None:
    response = await client.post("/api/v1/auth/web/switch-club", json={"club_id": str(club.id)})
    assert response.status_code == 200, response.text


async def login_mobile(client: httpx.AsyncClient, user: User) -> dict[str, str]:
    """Devuelve headers con el Bearer del usuario."""
    response = await client.post(
        "/api/v1/auth/mobile/login", json={"identifier": user.email, "password": PASSWORD}
    )
    assert response.status_code == 200, response.text
    return {"authorization": f"Bearer {response.json()['access_token']}"}
