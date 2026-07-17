"""Create packing purchase table

Revision ID: 0025_packing_purchase
Revises: 0024_drop_packing_stock_month
Create Date: 2026-07-17
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0025_packing_purchase"
down_revision: Union[str, None] = "0024_drop_packing_stock_month"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "yoradm_packing_purchase",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("sku_id", sa.Integer(), nullable=False),
        sa.Column("purchase_date", sa.Date(), nullable=False),
        sa.Column("qty", sa.Float(), nullable=False),
        sa.Column("rate", sa.Float(), nullable=True),
        sa.Column("supplier", sa.String(length=255), nullable=True),
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
    )
    op.create_index(
        "ix_yoradm_packing_purchase_sku_id", "yoradm_packing_purchase", ["sku_id"]
    )
    op.create_index(
        "ix_yoradm_packing_purchase_purchase_date",
        "yoradm_packing_purchase",
        ["purchase_date"],
    )
    op.create_index(
        "ix_yoradm_packing_purchase_supplier",
        "yoradm_packing_purchase",
        ["supplier"],
    )


def downgrade() -> None:
    op.drop_table("yoradm_packing_purchase")
