from datetime import datetime
from typing import Annotated
from uuid import UUID

from pydantic import AwareDatetime, BaseModel, StringConstraints

from app.schemas.common import Schema


class NewsCreate(BaseModel):
    title: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]
    body: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=5000)]
    tag: (
        Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=50)] | None
    ) = None
    expires_at: AwareDatetime | None = None


class NewsOut(Schema):
    id: UUID
    title: str
    body: str
    tag: str | None
    expires_at: datetime | None
    created_at: datetime
    created_by_name: str | None
    is_expired: bool


class MemberNewsOut(Schema):
    """Novedad vigente vista desde la app, con la identidad del club que la publica."""

    id: UUID
    club_id: UUID
    club_name: str
    club_color: str
    club_timezone: str
    title: str
    body: str
    tag: str | None
    expires_at: datetime | None
    created_at: datetime
