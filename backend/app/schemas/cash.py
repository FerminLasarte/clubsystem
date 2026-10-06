from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from pydantic import AwareDatetime, BaseModel

from app.domain.enums import PaymentMethod, TransactionType
from app.schemas.common import PositiveMoney, ShortText


class MovementMember(BaseModel):
    membership_id: UUID
    full_name: str
    member_number: str | None


class MovementReservation(BaseModel):
    reservation_id: UUID
    court_name: str
    customer_name: str
    starts_at: datetime
    ends_at: datetime


class MovementOut(BaseModel):
    id: UUID
    type: TransactionType
    amount: Decimal
    method: PaymentMethod
    description: str
    occurred_at: datetime
    created_at: datetime
    created_by_name: str | None
    member: MovementMember | None
    reservation: MovementReservation | None
    voided_at: datetime | None
    void_reason: str | None


class MethodTotals(BaseModel):
    method: PaymentMethod
    income: Decimal
    outflow: Decimal
    net: Decimal


class CashSummary(BaseModel):
    """Solo pagos no anulados."""

    income: Decimal
    outflow: Decimal
    net: Decimal
    by_method: list[MethodTotals]


class CashDayOut(BaseModel):
    date: date
    timezone: str
    movements: list[MovementOut]
    summary: CashSummary


class PaymentCreate(BaseModel):
    type: TransactionType
    amount: PositiveMoney
    method: PaymentMethod
    description: ShortText
    occurred_at: AwareDatetime | None = None
    membership_id: UUID | None = None
    reservation_id: UUID | None = None


class PaymentVoid(BaseModel):
    reason: ShortText
