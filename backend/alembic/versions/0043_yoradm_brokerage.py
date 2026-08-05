"""Create yoradm_brokerage for saved brokerage workings

Revision ID: 0043_yoradm_brokerage
Revises: 0042_brokerage_qty_adjust
Create Date: 2026-08-05
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0043_yoradm_brokerage"
down_revision: Union[str, None] = "0042_brokerage_qty_adjust"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "yoradm_brokerage",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("fy_start", sa.Integer(), nullable=False),
        sa.Column("month", sa.Integer(), nullable=False),
        sa.Column("broker", sa.String(length=255), nullable=False),
        sa.Column("side", sa.String(length=16), nullable=False),
        sa.Column("stock_item", sa.String(length=255), nullable=False),
        sa.Column("qty", sa.Float(), nullable=False, server_default="0"),
        sa.Column("qty_adjust", sa.Float(), nullable=False, server_default="0"),
        sa.Column("adjusted_qty", sa.Float(), nullable=False, server_default="0"),
        sa.Column("quintals", sa.Float(), nullable=False, server_default="0"),
        sa.Column("rate_per_quintal", sa.Float(), nullable=True),
        sa.Column("brokerage_amount", sa.Float(), nullable=False, server_default="0"),
        sa.Column("tds_percent", sa.Float(), nullable=True),
        sa.Column("tds_amount", sa.Float(), nullable=False, server_default="0"),
        sa.Column("net_amount", sa.Float(), nullable=False, server_default="0"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "fy_start",
            "month",
            "broker",
            "side",
            "stock_item",
            name="uq_yoradm_brokerage_key",
        ),
    )
    op.create_index(
        "ix_yoradm_brokerage_fy_month_broker",
        "yoradm_brokerage",
        ["fy_start", "month", "broker"],
    )


def downgrade() -> None:
    op.drop_index("ix_yoradm_brokerage_fy_month_broker", table_name="yoradm_brokerage")
    op.drop_table("yoradm_brokerage")
