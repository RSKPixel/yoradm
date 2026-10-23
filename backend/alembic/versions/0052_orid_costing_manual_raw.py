"""Add manual_raw_qty / manual_raw_rate to yoradm_orid_stock_costing.

Revision ID: 0052_orid_costing_manual_raw
Revises: 0051_drop_yoradm_tally_import
Create Date: 2026-10-23
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0052_orid_costing_manual_raw"
down_revision: Union[str, None] = "0051_drop_yoradm_tally_import"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "yoradm_orid_stock_costing",
        sa.Column("manual_raw_qty", sa.Float(), nullable=True),
    )
    op.add_column(
        "yoradm_orid_stock_costing",
        sa.Column("manual_raw_rate", sa.Float(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("yoradm_orid_stock_costing", "manual_raw_rate")
    op.drop_column("yoradm_orid_stock_costing", "manual_raw_qty")
