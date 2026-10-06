from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel

from app.domain.enums import CustomerType, ReservationStatus, StockUnit
from app.schemas.fees import FeeSummaryOut


class UpcomingReservation(BaseModel):
    id: UUID
    court_name: str
    customer_name: str
    customer_type: CustomerType
    starts_at: datetime
    ends_at: datetime
    status: ReservationStatus


class LowStockItem(BaseModel):
    id: UUID
    name: str
    quantity: Decimal
    min_quantity: Decimal
    unit: StockUnit


class LowStockOut(BaseModel):
    count: int
    items: list[LowStockItem]


class DashboardOperationsOut(BaseModel):
    date: date
    reservations_today: int
    active_courts: int
    # Horas reservadas sobre horas operables (horario del club × canchas activas).
    occupancy_pct: Decimal
    # Reservas activas del día que todavía no terminaron (en curso o por empezar).
    # null si el rol no tiene permiso para ver reservas / socios.
    upcoming_reservations: list[UpcomingReservation] | None
    pending_membership_requests: int | None
    # null si el rol no tiene permiso de lectura de stock.
    low_stock: LowStockOut | None


class MonthFinance(BaseModel):
    year: int
    month: int
    income: Decimal
    cash_outflow: Decimal
    expenses: Decimal
    net: Decimal


class DashboardFinanceOut(BaseModel):
    current: MonthFinance
    fees: FeeSummaryOut
    # Últimos 6 meses (incluido el actual), del más viejo al más nuevo.
    series: list[MonthFinance]
