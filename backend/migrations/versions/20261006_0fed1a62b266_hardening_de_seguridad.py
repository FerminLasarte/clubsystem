"""hardening de seguridad

Revision ID: 0fed1a62b266
Revises: 61f74649d3b4
Create Date: 2026-10-06 05:18:21.269091+00:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

from app.core.config import get_settings

revision: str = '0fed1a62b266'
down_revision: str | None = '61f74649d3b4'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    app_role = _app_role()

    # Invitaciones de membresía iniciadas por el club (la persona acepta desde la app).
    op.add_column(
        "club_memberships", sa.Column("invited_at", sa.DateTime(timezone=True), nullable=True)
    )
    op.drop_constraint(op.f("ck_club_memberships_membership_status"), "club_memberships", type_="check")
    op.create_check_constraint(
        op.f("ck_club_memberships_membership_status"),
        "club_memberships",
        "status IN ('INVITED', 'PENDING', 'APPROVED', 'REJECTED', 'INACTIVE')",
    )

    # club_staff: la lectura por email (no verificado) no la usa nadie: se quita.
    op.execute("DROP POLICY tenant_select ON club_staff")
    op.execute(
        "CREATE POLICY tenant_select ON club_staff FOR SELECT"
        " USING (club_id = app_current_club_id() OR user_id = app_current_user_id())"
    )
    op.execute("DROP FUNCTION app_current_user_email()")

    # Funciones SECURITY DEFINER: search_path explícito con pg_temp al final.
    for fn in ("app_member_club_ids()", "app_invitation_club(text)"):
        op.execute(f"ALTER FUNCTION {fn} SET search_path = pg_catalog, public, pg_temp")

    # Consumo diario del LLM por club (tope de costo independiente del estado de los gastos).
    op.create_table(
        "anomaly_llm_usage",
        sa.Column("club_id", sa.UUID(), nullable=False),
        sa.Column("day", sa.Date(), nullable=False),
        sa.Column("requests", sa.Integer(), server_default="0", nullable=False),
        sa.ForeignKeyConstraint(
            ["club_id"],
            ["clubs.id"],
            name=op.f("fk_anomaly_llm_usage_club_id_clubs"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("club_id", "day", name=op.f("pk_anomaly_llm_usage")),
    )
    op.execute("ALTER TABLE anomaly_llm_usage ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE anomaly_llm_usage FORCE ROW LEVEL SECURITY")
    op.execute(
        "CREATE POLICY tenant_all ON anomaly_llm_usage FOR ALL"
        " USING (club_id = app_current_club_id()) WITH CHECK (club_id = app_current_club_id())"
    )
    op.execute(f"GRANT SELECT, INSERT, UPDATE ON anomaly_llm_usage TO {app_role}")


def downgrade() -> None:
    op.drop_table("anomaly_llm_usage")
    for fn in ("app_member_club_ids()", "app_invitation_club(text)"):
        op.execute(f"ALTER FUNCTION {fn} SET search_path = public")
    op.execute(
        "CREATE FUNCTION app_current_user_email() RETURNS text LANGUAGE sql STABLE AS"
        " $$ SELECT nullif(current_setting('app.user_email', true), '')::text $$"
    )
    op.execute("DROP POLICY tenant_select ON club_staff")
    op.execute(
        "CREATE POLICY tenant_select ON club_staff FOR SELECT USING (club_id = app_current_club_id()"
        " OR user_id = app_current_user_id() OR email = app_current_user_email())"
    )
    op.execute("DELETE FROM club_memberships WHERE status = 'INVITED'")
    op.drop_constraint(op.f("ck_club_memberships_membership_status"), "club_memberships", type_="check")
    op.create_check_constraint(
        op.f("ck_club_memberships_membership_status"),
        "club_memberships",
        "status IN ('PENDING', 'APPROVED', 'REJECTED', 'INACTIVE')",
    )
    op.drop_column("club_memberships", "invited_at")


def _app_role() -> str:
    role = get_settings().DB_APP_ROLE
    if not role.replace("_", "").isalnum():
        raise ValueError(f"DB_APP_ROLE inválido: {role!r}")
    return role
