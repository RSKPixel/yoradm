"""Drop unused packing monthly stock table

Revision ID: 0024_drop_packing_stock_month
Revises: 0023_packing_fy_adjust
Create Date: 2026-07-17
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0024_drop_packing_stock_month"
down_revision: Union[str, None] = "0023_packing_fy_adjust"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("SET FOREIGN_KEY_CHECKS=0")
    op.drop_table("yoradm_packing_stock_month")
    op.execute("SET FOREIGN_KEY_CHECKS=1")


def downgrade() -> None:
    op.create_table(
        "yoradm_packing_stock_month",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("sku_id", sa.Integer(), nullable=False),
        sa.Column("year", sa.Integer(), nullable=False),
        sa.Column("month", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False, server_default="Open"),
        sa.Column("opening_qty", sa.Float(), nullable=False, server_default="0"),
        sa.Column("purchase_qty", sa.Float(), nullable=False, server_default="0"),
        sa.Column("sales_qty", sa.Float(), nullable=False, server_default="0"),
        sa.Column("closing_qty", sa.Float(), nullable=False, server_default="0"),
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
        sa.ForeignKeyConstraint(
            ["sku_id"], ["yoradm_packing_sku.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "sku_id", "year", "month", name="uq_yoradm_packing_stock_month_sku_period"
        ),
    )
    op.create_index("ix_yoradm_packing_stock_month_sku_id", "yoradm_packing_stock_month", ["sku_id"])
    op.create_index("ix_yoradm_packing_stock_month_year", "yoradm_packing_stock_month", ["year"])
    op.create_index("ix_yoradm_packing_stock_month_month", "yoradm_packing_stock_month", ["month"])
    op.create_index("ix_yoradm_packing_stock_month_status", "yoradm_packing_stock_month", ["status"])
