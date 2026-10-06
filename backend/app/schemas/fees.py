from datetime import date, datetime
from decimal import Decimal
from typing import Annotated
from uuid import UUID

from pydantic import BaseModel, Field, StringConstraints

from app.domain.enums import FeeStatus, PaymentMethod
from app.schemas.common import PageParams

Year = Annotated[int, Field(ge=2000, le=2100)]
Month = Annotated[int, Field(ge=1, le=12)]


class FeeOut(BaseModel):
    id: UUID
    membership_id: UUID
    member_name: str
    member_number: str | None
    plan_name: str
    year: int
    month: int
    amount: Decimal
    status: FeeStatus
    due_date: date
    # PENDING con vencimiento anterior a hoy (en la zona del club).
    is_overdue: bool
    payment_id: UUID | None
    paid_at: datetime | None
    payment_method: PaymentMethod | None
    cancelled_at: datetime | None
    created_at: datetime


class FeeFilters(PageParams):
    year: Year | None = None
    month: Month | None = None
    status: FeeStatus | None = None
    search: Annotated[str, StringConstraints(strip_whitespace=True, max_length=100)] | None = None


class FeeGenerateRequest(BaseModel):
    year: Year
    month: Month
    # Si el mes tiene menos días, vence el último día del mes.
    due_day: Annotated[int, Field(ge=1, le=31)] = 10


class FeeGenerateOut(BaseModel):
    created: int
    # Socios que ya tenían una cuota para el período (incluso cancelada).
    skipped: int
    # Socios aprobados sin plan activo con monto mayor a cero.
    without_plan: int


class FeePayRequest(BaseModel):
    method: PaymentMethod


class FeeTotals(BaseModel):
    count: int
    amount: Decimal


class FeeSummaryOut(BaseModel):
    year: int
    month: int
    issued: FeeTotals
    collected: FeeTotals
    pending: FeeTotals
