"""Create yoradm_brokerage_rate for monthly per-item rates

Revision ID: 0039_brokerage_rate
Revises: 0038_tds_head_payment
Create Date: 2026-08-02
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0039_brokerage_rate"
down_revision: Union[str, None] = "0038_tds_head_payment"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "yoradm_brokerage_rate",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("fy_start", sa.Integer(), nullable=False),
        sa.Column("month", sa.Integer(), nullable=False),
        sa.Column("broker", sa.String(length=255), nullable=False),
        sa.Column("side", sa.String(length=16), nullable=False),
        sa.Column("stock_item", sa.String(length=255), nullable=False),
        sa.Column("rate_per_quintal", sa.Float(), nullable=False),
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
            onupdate=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "fy_start",
            "month",
            "broker",
            "side",
            "stock_item",
            name="uq_yoradm_brokerage_rate_key",
        ),
    )
    op.create_index(
        "ix_yoradm_brokerage_rate_fy_month_broker",
        "yoradm_brokerage_rate",
        ["fy_start", "month", "broker"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_yoradm_brokerage_rate_fy_month_broker",
        table_name="yoradm_brokerage_rate",
    )
    op.drop_table("yoradm_brokerage_rate")
