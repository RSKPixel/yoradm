"""Create yoradm_orid_monthly_opening (manual Orid Dhall opening stock per month).

Revision ID: 0055_orid_monthly_opening
Revises: 0054_orid_costing_manual_lot
Create Date: 2026-10-25
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0055_orid_monthly_opening"
down_revision: Union[str, None] = "0054_orid_costing_manual_lot"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "yoradm_orid_monthly_opening",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("year", sa.Integer(), nullable=False),
        sa.Column("month", sa.Integer(), nullable=False),
        sa.Column("opening_qty", sa.Float(), nullable=True),
        sa.Column("opening_rate", sa.Float(), nullable=True),
        sa.Column(
            "updated_by",
            sa.Integer(),
            sa.ForeignKey("yoradm_users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.UniqueConstraint(
            "year", "month", name="uq_yoradm_orid_monthly_opening_year_month"
        ),
    )
    op.create_index(
        "ix_yoradm_orid_monthly_opening_updated_by",
        "yoradm_orid_monthly_opening",
        ["updated_by"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_yoradm_orid_monthly_opening_updated_by",
        table_name="yoradm_orid_monthly_opening",
    )
    op.drop_table("yoradm_orid_monthly_opening")
