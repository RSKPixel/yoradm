"""Add manual_mfg_expenses_pct / manual_overheads_pct to yoradm_orid_stock_costing.

Revision ID: 0053_orid_costing_manual_exp
Revises: 0052_orid_costing_manual_raw
Create Date: 2026-10-23
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0053_orid_costing_manual_exp"
down_revision: Union[str, None] = "0052_orid_costing_manual_raw"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "yoradm_orid_stock_costing",
        sa.Column("manual_mfg_expenses_pct", sa.Float(), nullable=True),
    )
    op.add_column(
        "yoradm_orid_stock_costing",
        sa.Column("manual_overheads_pct", sa.Float(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("yoradm_orid_stock_costing", "manual_overheads_pct")
    op.drop_column("yoradm_orid_stock_costing", "manual_mfg_expenses_pct")
