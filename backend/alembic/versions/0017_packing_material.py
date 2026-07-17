"""Create packing material SKU and monthly stock tables

Revision ID: 0017_packing_material
Revises: 0016_odp_lot_221
Create Date: 2026-07-16
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0017_packing_material"
down_revision: Union[str, None] = "0016_odp_lot_221"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "yoradm_packing_sku",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("stock_item", sa.String(length=255), nullable=False),
        sa.Column("brand", sa.String(length=128), nullable=False),
        sa.Column("unit", sa.String(length=64), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("1")),
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
        sa.UniqueConstraint("stock_item", "brand", name="uq_yoradm_packing_sku_item_brand"),
    )
    op.create_index("ix_yoradm_packing_sku_stock_item", "yoradm_packing_sku", ["stock_item"])
    op.create_index("ix_yoradm_packing_sku_brand", "yoradm_packing_sku", ["brand"])
    op.create_index("ix_yoradm_packing_sku_is_active", "yoradm_packing_sku", ["is_active"])

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


def downgrade() -> None:
    op.execute("SET FOREIGN_KEY_CHECKS=0")
    op.drop_table("yoradm_packing_stock_month")
    op.drop_table("yoradm_packing_sku")
    op.execute("SET FOREIGN_KEY_CHECKS=1")
