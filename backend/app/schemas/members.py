from datetime import date, datetime
from decimal import Decimal
from typing import Annotated, Literal
from uuid import UUID

from pydantic import BaseModel, EmailStr, StringConstraints

from app.domain.enums import Gender, MembershipStatus
from app.schemas.auth import Dni, Name
from app.schemas.clubs import ClubDirectoryOut
from app.schemas.common import Money, OptionalText, PageParams, Schema

PlanName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)]
MemberNumber = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=50)]
Phone = Annotated[str, StringConstraints(strip_whitespace=True, max_length=50)]
SearchText = Annotated[str, StringConstraints(strip_whitespace=True, max_length=100)]

# ── Planes ──────────────────────────────────────────────────────────────────


class PlanOut(Schema):
    id: UUID
    name: str
    monthly_fee: Decimal
    is_active: bool


class PlanCreate(BaseModel):
    name: PlanName
    monthly_fee: Money


class PlanUpdate(BaseModel):
    name: PlanName | None = None
    monthly_fee: Money | None = None
    is_active: bool | None = None


class PlanSummaryOut(Schema):
    id: UUID
    name: str
    monthly_fee: Decimal


# ── Socios (panel) ──────────────────────────────────────────────────────────


class MemberPersonOut(Schema):
    """Datos de identidad del usuario. Solo lectura para el club."""

    id: UUID
    email: str
    first_name: str
    last_name: str
    phone: str | None
    dni: str | None
    birth_date: date | None
    gender: Gender | None
    avatar_url: str | None


class MemberOut(BaseModel):
    """Una membresía del club con los datos de la persona."""

    id: UUID
    status: MembershipStatus
    member_number: str | None
    joined_on: date | None
    notes: str | None
    requested_at: datetime | None
    decided_at: datetime | None
    created_at: datetime
    plan: PlanSummaryOut | None
    user: MemberPersonOut
    # Inicio de la última reserva no cancelada del socio en este club.
    last_reservation_at: datetime | None


class MemberFilters(BaseModel):
    search: SearchText | None = None
    # Sin filtro: socios activos e inactivos (las solicitudes tienen su propio listado).
    status: MembershipStatus | None = None
    plan_id: UUID | None = None


class MemberListParams(MemberFilters, PageParams):
    pass


class MemberStatsOut(BaseModel):
    pending: int
    approved: int
    inactive: int
    rejected: int
    # Altas (joined_on) del mes en curso, en la zona horaria del club.
    joined_this_month: int


class MemberCreate(BaseModel):
    email: EmailStr
    first_name: Name
    last_name: Name
    phone: Phone | None = None
    dni: Dni | None = None
    plan_id: UUID | None = None
    member_number: MemberNumber | None = None
    notes: OptionalText | None = None


class MemberUpdate(BaseModel):
    """Solo se modifican los campos enviados. `null` limpia plan, número y notas."""

    plan_id: UUID | None = None
    member_number: MemberNumber | None = None
    joined_on: date | None = None
    notes: OptionalText | None = None
    status: Literal[MembershipStatus.APPROVED, MembershipStatus.INACTIVE] | None = None


class ApproveRequest(BaseModel):
    plan_id: UUID | None = None
    member_number: MemberNumber | None = None


# ── App del socio ───────────────────────────────────────────────────────────


class ClubDirectoryItemOut(ClubDirectoryOut):
    my_membership_status: MembershipStatus | None = None


class MyMembershipOut(BaseModel):
    id: UUID
    status: MembershipStatus
    member_number: str | None
    joined_on: date | None
    requested_at: datetime | None
    club: ClubDirectoryOut
    plan: PlanSummaryOut | None
