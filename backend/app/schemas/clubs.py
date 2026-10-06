from datetime import time
from typing import Annotated
from uuid import UUID
from zoneinfo import available_timezones

from pydantic import AfterValidator, AnyHttpUrl, BaseModel, EmailStr, Field, StringConstraints

from app.domain.cancellation import MAX_MEMBER_CANCEL_NOTICE_HOURS
from app.domain.enums import Sport
from app.schemas.common import HexColor, Schema

Text100 = Annotated[str, StringConstraints(strip_whitespace=True, max_length=100)]
Text255 = Annotated[str, StringConstraints(strip_whitespace=True, max_length=255)]
ClubName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=255)]


def _known_timezone(value: str) -> str:
    if value not in available_timezones():
        raise ValueError("Zona horaria desconocida")
    return value


TimeZone = Annotated[str, AfterValidator(_known_timezone)]


class ClubOut(Schema):
    id: UUID
    slug: str
    name: str
    sport_types: list[Sport]
    logo_url: str | None
    primary_color: str
    timezone: str
    accent_color: str
    address: str | None
    city: str | None
    country: str
    timezone: str
    phone: str | None
    email: str | None
    website: str | None
    open_time: time | None
    close_time: time | None
    member_cancel_notice_hours: int


class ClubUpdate(BaseModel):
    """Solo se modifican los campos enviados. `null` limpia los opcionales."""

    name: ClubName | None = None
    sport_types: list[Sport] | None = None
    logo_url: AnyHttpUrl | None = None
    primary_color: HexColor | None = None
    accent_color: HexColor | None = None
    address: Text255 | None = None
    city: Text100 | None = None
    timezone: TimeZone | None = None
    phone: Annotated[str, StringConstraints(strip_whitespace=True, max_length=50)] | None = None
    email: EmailStr | None = None
    website: AnyHttpUrl | None = None
    open_time: time | None = None
    close_time: time | None = None
    member_cancel_notice_hours: (
        Annotated[int, Field(ge=0, le=MAX_MEMBER_CANCEL_NOTICE_HOURS)] | None
    ) = None


class ClubCreate(BaseModel):
    """Alta de un club por un operador (scripts/create_club.py), con la invitación a su dueño."""

    slug: Annotated[str, StringConstraints(pattern=r"^[a-z0-9]+(-[a-z0-9]+)*$", max_length=100)]
    name: ClubName
    owner_email: EmailStr
    sport_types: list[Sport] = Field(default_factory=list)
    city: Text100 | None = None
    timezone: TimeZone | None = None  # None: la del modelo (Buenos Aires)


class ClubDirectoryOut(Schema):
    """Datos públicos de un club para el directorio de la app."""

    id: UUID
    slug: str
    name: str
    city: str | None
    sport_types: list[Sport]
    logo_url: str | None
    primary_color: str
    timezone: str
