"""Reservas: el usuario ve las canchas de sus propias reservas (RLS de courts).

Sin esto, el historial de reservas de la app pierde las de clubes donde la persona
ya no es socia aprobada (la política solo mostraba canchas de clubes donde lo es).

Revision ID: 7a18dd3a60a7
Revises: b005996bf352
Create Date: 2026-10-06 12:00:00.000000+00:00
"""

from collections.abc import Sequence

from alembic import op

revision: str = "7a18dd3a60a7"
down_revision: str | None = "b005996bf352"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_BASE = "club_id = app_current_club_id() OR club_id IN (SELECT app_member_club_ids())"
_OWN = "id IN (SELECT court_id FROM reservations WHERE user_id = app_current_user_id())"


def _replace_courts_select(using: str) -> None:
    op.execute("DROP POLICY tenant_select ON courts")
    op.execute(f"CREATE POLICY tenant_select ON courts FOR SELECT USING ({using})")


def upgrade() -> None:
    _replace_courts_select(f"{_BASE} OR {_OWN}")


def downgrade() -> None:
    _replace_courts_select(_BASE)
