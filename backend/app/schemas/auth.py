from datetime import date
from typing import Annotated
from uuid import UUID

from pydantic import BaseModel, EmailStr, StringConstraints

from app.domain.enums import Gender, MembershipStatus, StaffRole
from app.domain.permissions import Permission
from app.schemas.common import Password, Schema

Name = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)]
Dni = Annotated[str, StringConstraints(strip_whitespace=True, pattern=r"^\d{6,10}$")]


class WebLoginRequest(BaseModel):
    email: EmailStr
    password: Annotated[str, StringConstraints(min_length=1, max_length=72)]


class MobileLoginRequest(BaseModel):
    # El DNI es un dato del perfil, no un identificador de login.
    email: EmailStr
    password: Annotated[str, StringConstraints(min_length=1, max_length=72)]


class RegisterRequest(BaseModel):
    email: EmailStr
    password: Password
    first_name: Name
    last_name: Name
    phone: Annotated[str, StringConstraints(strip_whitespace=True, max_length=50)] | None = None
    birth_date: date | None = None
    gender: Gender | None = None


class RefreshRequest(BaseModel):
    refresh_token: str


class SwitchClubRequest(BaseModel):
    club_id: UUID


class TokenRequest(BaseModel):
    token: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: Password


class UserOut(Schema):
    id: UUID
    email: str
    first_name: str
    last_name: str
    phone: str | None
    dni: str | None
    birth_date: date | None
    gender: Gender | None
    avatar_url: str | None
    email_verified: bool


class StaffClubOut(BaseModel):
    club_id: UUID
    name: str
    slug: str
    logo_url: str | None
    primary_color: str
    accent_color: str
    timezone: str
    roles: list[StaffRole]


class WebSessionOut(BaseModel):
    """Estado de la sesión del panel. El token viaja en cookies HttpOnly, no en el body."""

    user: UserOut
    clubs: list[StaffClubOut]
    active_club: StaffClubOut
    permissions: list[Permission]


class MembershipSummaryOut(BaseModel):
    membership_id: UUID
    club_id: UUID
    club_name: str
    club_slug: str
    logo_url: str | None
    primary_color: str
    status: MembershipStatus
    member_number: str | None


class MobileSessionOut(BaseModel):
    access_token: str
    refresh_token: str
    user: UserOut
    memberships: list[MembershipSummaryOut]


class MobileTokensOut(BaseModel):
    access_token: str
    refresh_token: str
