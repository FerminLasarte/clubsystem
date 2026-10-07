"""el DNI deja de ser único: es autodeclarado, y el 409 revelaba si otra cuenta lo tenía

Revision ID: 3af1c0e5ef18
Revises: f9da7f4fb94c
Create Date: 2026-10-07 03:49:30.683690+00:00
"""

from collections.abc import Sequence

from alembic import op

revision: str = '3af1c0e5ef18'
down_revision: str | None = 'f9da7f4fb94c'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.drop_constraint(op.f('uq_users_dni'), 'users', type_='unique')


def downgrade() -> None:
    # Falla si ya hay DNIs repetidos: hay que resolverlos a mano antes de bajar.
    op.create_unique_constraint(op.f('uq_users_dni'), 'users', ['dni'])
