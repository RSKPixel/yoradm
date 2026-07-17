"""Add stock_group to packing SKU

Revision ID: 0018_packing_sku_stock_group
Revises: 0017_packing_material
Create Date: 2026-07-16
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0018_packing_sku_stock_group"
down_revision: Union[str, None] = "0017_packing_material"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "yoradm_packing_sku",
        sa.Column("stock_group", sa.String(length=128), nullable=True),
    )
    op.create_index(
        "ix_yoradm_packing_sku_stock_group",
        "yoradm_packing_sku",
        ["stock_group"],
    )


def downgrade() -> None:
    op.drop_index("ix_yoradm_packing_sku_stock_group", table_name="yoradm_packing_sku")
    op.drop_column("yoradm_packing_sku", "stock_group")
