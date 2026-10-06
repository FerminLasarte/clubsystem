"""plazo de cancelación del socio desde la app (horas antes del inicio, por club)

Revision ID: f9da7f4fb94c
Revises: 0fed1a62b266
Create Date: 2026-10-06 16:25:41.989911+00:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = 'f9da7f4fb94c'
down_revision: str | None = '0fed1a62b266'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "clubs",
        sa.Column("member_cancel_notice_hours", sa.Integer(), server_default="24", nullable=False),
    )
    op.create_check_constraint(
        op.f("ck_clubs_member_cancel_notice_hours"),
        "clubs",
        "member_cancel_notice_hours BETWEEN 0 AND 336",
    )


def downgrade() -> None:
    op.drop_constraint(op.f("ck_clubs_member_cancel_notice_hours"), "clubs", type_="check")
    op.drop_column("clubs", "member_cancel_notice_hours")
