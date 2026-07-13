"""Add discount to delivery challan detail

Revision ID: 0014_dc_discount
Revises: 0013_odp_yields
Create Date: 2026-07-13
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0014_dc_discount"
down_revision: Union[str, None] = "0013_odp_yields"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "yoradm_delivery_challan_detail",
        sa.Column("discount", sa.Float(), nullable=True),
    )
    # Backfill from tally sales where voucher + stock item (+ packing) match.
    op.execute(
        """
        UPDATE yoradm_delivery_challan_detail AS d
        INNER JOIN tallydata_sales AS s
          ON s.voucher_no = d.voucher_no
         AND s.stock_item = d.stock_item
         AND (d.packing IS NULL OR s.packing = d.packing)
        SET d.discount = s.discount
        WHERE d.discount IS NULL
          AND s.discount IS NOT NULL
        """
    )


def downgrade() -> None:
    op.drop_column("yoradm_delivery_challan_detail", "discount")
