"""Add manual_lot_id to yoradm_orid_stock_costing.

Revision ID: 0054_orid_costing_manual_lot
Revises: 0053_orid_costing_manual_exp
Create Date: 2026-10-23
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0054_orid_costing_manual_lot"
down_revision: Union[str, None] = "0053_orid_costing_manual_exp"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "yoradm_orid_stock_costing",
        sa.Column("manual_lot_id", sa.Integer(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("yoradm_orid_stock_costing", "manual_lot_id")
