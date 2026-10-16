"""Add raw_qty_source to yoradm_orid_stock_costing.

Revision ID: 0050_orid_costing_raw_source
Revises: 0049_orid_workings_sales_mode
Create Date: 2026-10-14
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0050_orid_costing_raw_source"
down_revision: Union[str, None] = "0049_orid_workings_sales_mode"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "yoradm_orid_stock_costing",
        sa.Column(
            "raw_qty_source",
            sa.String(length=32),
            nullable=True,
            server_default="both",
        ),
    )


def downgrade() -> None:
    op.drop_column("yoradm_orid_stock_costing", "raw_qty_source")
