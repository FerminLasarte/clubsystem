import datetime as dt
from decimal import Decimal
from typing import Annotated, Literal, Self
from uuid import UUID

from pydantic import AwareDatetime, BaseModel, Field, StringConstraints, model_validator

from app.domain.enums import (
    CancelReason,
    CourtSurface,
    CustomerType,
    ReservationSource,
    ReservationStatus,
    Sport,
)
from app.domain.slots import AppDuration
from app.schemas.common import Money, OptionalText, PageParams, Schema

GuestName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]
Phone = Annotated[str, StringConstraints(strip_whitespace=True, max_length=50)]


# ── Panel ─────────────────────────────────────────────────────────────────────


class ReservationOut(BaseModel):
    id: UUID
    court_id: UUID
    court_name: str
    customer_type: CustomerType
    customer_name: str
    customer_phone: str | None
    user_id: UUID | None
    membership_id: UUID | None
    member_number: str | None
    status: ReservationStatus
    source: ReservationSource
    starts_at: dt.datetime
    ends_at: dt.datetime
    duration_minutes: int
    total_price: Decimal
    # Suma de los pagos no anulados de la reserva (los registra el dominio de caja).
    paid_amount: Decimal
    notes: str | None
    confirmed_at: dt.datetime | None
    cancelled_at: dt.datetime | None
    cancel_reason: CancelReason | None
    created_at: dt.datetime


class ReservationFilters(PageParams):
    """
    `date` (un día local del club) o `from`/`to` (días locales, ambos inclusive).
    `sort`: `starts_at` ascendente (vista del día) o `-starts_at` (historial).
    """

    date: dt.date | None = None
    from_: dt.date | None = Field(None, alias="from")
    to: dt.date | None = None
    status: ReservationStatus | None = None
    court_id: UUID | None = None
    sort: Literal["starts_at", "-starts_at"] = "starts_at"

    @model_validator(mode="after")
    def _one_range(self) -> Self:
        if self.date is not None:
            if self.from_ is not None or self.to is not None:
                raise ValueError("Usá `date` o `from`/`to`, no ambos.")
        elif self.from_ is None or self.to is None:
            raise ValueError("Indicá `date` o el rango `from`/`to`.")
        elif self.to < self.from_:
            raise ValueError("`to` no puede ser anterior a `from`.")
        return self

    @property
    def days(self) -> tuple[dt.date, dt.date]:
        """Primer y último día (inclusive)."""
        first, last = self.date or self.from_, self.date or self.to
        if first is None or last is None:  # el validador lo impide
            raise ValueError("Rango de fechas incompleto.")
        return first, last


class ExportRange(BaseModel):
    from_: dt.date = Field(alias="from")
    to: dt.date

    @model_validator(mode="after")
    def _ordered(self) -> Self:
        if self.to < self.from_:
            raise ValueError("`to` no puede ser anterior a `from`.")
        if (self.to - self.from_).days > 366:
            raise ValueError("El rango máximo de exportación es un año.")
        return self


class GridCourtOut(BaseModel):
    id: UUID
    name: str
    sport: Sport
    surface: CourtSurface | None
    is_indoor: bool
    is_active: bool
    reservations: list[ReservationOut]


class ReservationGridOut(BaseModel):
    date: dt.date
    timezone: str
    open_time: dt.time | None
    close_time: dt.time | None
    slot_minutes: int
    courts: list[GridCourtOut]


class ReservationCreate(BaseModel):
    """Reserva cargada por el staff: de un socio (`membership_id`) o de un invitado."""

    court_id: UUID
    starts_at: AwareDatetime
    ends_at: AwareDatetime
    membership_id: UUID | None = None
    guest_name: GuestName | None = None
    guest_phone: Phone | None = None
    # Si no viene, se usa la tarifa de la cancha (domain/pricing.py).
    price_override: Money | None = None
    notes: OptionalText | None = None

    @model_validator(mode="after")
    def _customer(self) -> Self:
        if (self.membership_id is None) == (self.guest_name is None):
            raise ValueError("Indicá un socio (`membership_id`) o un invitado (`guest_name`).")
        if self.membership_id is not None and self.guest_phone is not None:
            raise ValueError("`guest_phone` solo aplica a invitados.")
        if self.ends_at <= self.starts_at:
            raise ValueError("`ends_at` debe ser posterior a `starts_at`.")
        return self

    @property
    def customer_type(self) -> CustomerType:
        return CustomerType.MEMBER if self.membership_id else CustomerType.GUEST


class ReservationUpdate(BaseModel):
    """
    Solo se modifican los campos enviados. Reprogramar exige `starts_at` y `ends_at` juntos.
    Si cambia la cancha o la duración, el precio se recalcula salvo `price_override`.
    """

    notes: OptionalText | None = None
    court_id: UUID | None = None
    starts_at: AwareDatetime | None = None
    ends_at: AwareDatetime | None = None
    price_override: Money | None = None

    @model_validator(mode="after")
    def _times(self) -> Self:
        if (self.starts_at is None) != (self.ends_at is None):
            raise ValueError("Para reprogramar enviá `starts_at` y `ends_at`.")
        if self.starts_at and self.ends_at and self.ends_at <= self.starts_at:
            raise ValueError("`ends_at` debe ser posterior a `starts_at`.")
        return self


# ── App del socio ─────────────────────────────────────────────────────────────


class SlotOut(BaseModel):
    starts_at: dt.datetime
    ends_at: dt.datetime


class CourtAvailabilityOut(BaseModel):
    court_id: UUID
    name: str
    sport: Sport
    surface: CourtSurface | None
    is_indoor: bool
    # Precio final para el socio por la duración pedida.
    price: Money
    slots: list[SlotOut]


class AvailabilityOut(BaseModel):
    date: dt.date
    timezone: str
    duration_minutes: int
    courts: list[CourtAvailabilityOut]


class MemberReservationCreate(BaseModel):
    court_id: UUID
    starts_at: AwareDatetime
    duration_minutes: AppDuration


class MyReservationsQuery(PageParams):
    # upcoming: pendientes o confirmadas que no terminaron; past: el resto.
    scope: Literal["upcoming", "past"] = "upcoming"


class ClubBrief(Schema):
    id: UUID
    name: str
    logo_url: str | None
    timezone: str


class CourtBrief(Schema):
    id: UUID
    name: str
    sport: Sport
    surface: CourtSurface | None
    is_indoor: bool


class MyReservationOut(BaseModel):
    id: UUID
    status: ReservationStatus
    starts_at: dt.datetime
    ends_at: dt.datetime
    duration_minutes: int
    total_price: Money
    cancel_reason: CancelReason | None
    created_at: dt.datetime
    club: ClubBrief
    court: CourtBrief
    # Calculados en el backend: si el socio puede cancelarla ahora y, para las confirmadas,
    # hasta cuándo (`null` en las pendientes, que se cancelan siempre).
    can_cancel: bool
    cancel_deadline: dt.datetime | None
