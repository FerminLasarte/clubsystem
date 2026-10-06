from datetime import datetime
from typing import Annotated
from uuid import UUID

from pydantic import AnyHttpUrl, BaseModel, Field, StringConstraints

from app.domain.enums import CourtSurface, Sport
from app.schemas.common import Money, OptionalText, Schema

CourtName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)]
Capacity = Annotated[int, Field(ge=1, le=100)]


class CourtOut(Schema):
    id: UUID
    name: str
    sport: Sport
    surface: CourtSurface | None
    is_indoor: bool
    is_active: bool
    capacity: int
    price_member: Money
    price_guest: Money
    description: str | None
    image_url: str | None
    created_at: datetime
    updated_at: datetime


class CourtCreate(BaseModel):
    name: CourtName
    sport: Sport
    surface: CourtSurface | None = None
    is_indoor: bool = False
    capacity: Capacity = 4
    price_member: Money
    price_guest: Money
    description: OptionalText | None = None
    image_url: AnyHttpUrl | None = None


class CourtUpdate(BaseModel):
    """Solo se modifican los campos enviados. `is_active=false` desactiva la cancha."""

    name: CourtName | None = None
    sport: Sport | None = None
    surface: CourtSurface | None = None
    is_indoor: bool | None = None
    is_active: bool | None = None
    capacity: Capacity | None = None
    price_member: Money | None = None
    price_guest: Money | None = None
    description: OptionalText | None = None
    image_url: AnyHttpUrl | None = None


class CourtUpcomingOut(BaseModel):
    """Reservas activas (pendientes o confirmadas) que todavía no terminaron."""

    upcoming_reservations: int


class CourtDeactivate(BaseModel):
    # Cantidad que vio el usuario al confirmar. Si cambió, 409 y se vuelve a confirmar.
    cancel_upcoming_reservations: Annotated[int, Field(ge=0)]


class CourtDeactivationOut(BaseModel):
    court: CourtOut
    cancelled_reservations: int


class MemberCourtOut(Schema):
    """Cancha vista por un socio: precio por hora de socio, sin datos internos."""

    id: UUID
    name: str
    sport: Sport
    surface: CourtSurface | None
    is_indoor: bool
    capacity: int
    description: str | None
    image_url: str | None
    price_per_hour: Money
