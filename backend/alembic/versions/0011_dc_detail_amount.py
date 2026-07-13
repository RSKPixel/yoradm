"""Add amount to delivery challan detail

Revision ID: 0011_dc_detail_amount
Revises: 0010_orid_dhall_production
Create Date: 2026-07-12
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0011_dc_detail_amount"
down_revision: Union[str, None] = "0010_orid_dhall_production"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "yoradm_delivery_challan_detail",
        sa.Column("amount", sa.Float(), nullable=True),
    )
    # Backfill from tally sales where voucher + stock item (+ packing) match.
    op.execute(
        """
        UPDATE yoradm_delivery_challan_detail AS d
        INNER JOIN tallydata_sales AS s
          ON s.voucher_no = d.voucher_no
         AND s.stock_item = d.stock_item
         AND (d.packing IS NULL OR s.packing = d.packing)
        SET d.amount = s.amount
        WHERE d.amount IS NULL
          AND s.amount IS NOT NULL
        """
    )


def downgrade() -> None:
    op.drop_column("yoradm_delivery_challan_detail", "amount")
