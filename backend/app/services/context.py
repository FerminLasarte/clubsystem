"""Contexto del request (quién actúa y en qué club) que reciben los services."""

from dataclasses import dataclass
from uuid import UUID

from app.domain.permissions import Permission
from app.models import Club, ClubMembership, User


@dataclass(frozen=True)
class StaffContext:
    user: User
    club: Club
    roles: list[str]
    permissions: frozenset[Permission]

    @property
    def club_id(self) -> UUID:
        return self.club.id

    @property
    def user_id(self) -> UUID:
        return self.user.id


@dataclass(frozen=True)
class MemberContext:
    user: User
    club: Club
    membership: ClubMembership
