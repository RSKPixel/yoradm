"""Add adjust_qty to packing FY stock

Revision ID: 0023_packing_fy_adjust
Revises: 0022_packing_fy_freeze
Create Date: 2026-07-16
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0023_packing_fy_adjust"
down_revision: Union[str, None] = "0022_packing_fy_freeze"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "yoradm_packing_stock_fy",
        sa.Column(
            "adjust_qty",
            sa.Float(),
            nullable=False,
            server_default="0",
        ),
    )


def downgrade() -> None:
    op.drop_column("yoradm_packing_stock_fy", "adjust_qty")
