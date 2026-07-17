"""Create packing material FY stock table

Revision ID: 0019_packing_stock_fy
Revises: 0018_packing_sku_stock_group
Create Date: 2026-07-16
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0019_packing_stock_fy"
down_revision: Union[str, None] = "0018_packing_sku_stock_group"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "yoradm_packing_stock_fy",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("sku_id", sa.Integer(), nullable=False),
        sa.Column("fy_start", sa.Integer(), nullable=False),
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
        sa.UniqueConstraint("sku_id", "fy_start", name="uq_yoradm_packing_stock_fy_sku_fy"),
    )
    op.create_index("ix_yoradm_packing_stock_fy_sku_id", "yoradm_packing_stock_fy", ["sku_id"])
    op.create_index("ix_yoradm_packing_stock_fy_fy_start", "yoradm_packing_stock_fy", ["fy_start"])


def downgrade() -> None:
    op.drop_index("ix_yoradm_packing_stock_fy_fy_start", table_name="yoradm_packing_stock_fy")
    op.drop_index("ix_yoradm_packing_stock_fy_sku_id", table_name="yoradm_packing_stock_fy")
    op.drop_table("yoradm_packing_stock_fy")
