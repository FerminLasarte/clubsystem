from datetime import datetime
from typing import Annotated, Literal
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field, StringConstraints

from app.domain.enums import StaffRole, StaffStatus
from app.schemas.auth import Name
from app.schemas.common import Schema


class StaffMemberOut(Schema):
    id: UUID
    email: str
    full_name: str | None
    roles: list[StaffRole]
    status: StaffStatus
    is_self: bool
    created_at: datetime


class InviteRequest(BaseModel):
    email: EmailStr
    roles: Annotated[list[StaffRole], Field(min_length=1)]


class RolesUpdate(BaseModel):
    roles: Annotated[list[StaffRole], Field(min_length=1)]


class InvitationPreviewOut(BaseModel):
    club_name: str
    club_logo_url: str | None
    email: str
    roles: list[StaffRole]
    # new: hay que crear la cuenta · unverified: existe sin verificar (se define contraseña)
    # existing: cuenta verificada (se pide la contraseña actual)
    account: Literal["new", "unverified", "existing"]


class AcceptInvitationRequest(BaseModel):
    token: str
    password: Annotated[str, StringConstraints(min_length=1, max_length=72)]
    first_name: Name | None = None
    last_name: Name | None = None
