"""Add Orid Dhall Costing fields to yoradm_orid_stock_costing.

Revision ID: 0056_orid_costing_dhall
Revises: 0055_orid_monthly_opening
Create Date: 2026-10-25
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0056_orid_costing_dhall"
down_revision: Union[str, None] = "0055_orid_monthly_opening"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "yoradm_orid_stock_costing",
        sa.Column("dhall_cost_rate", sa.Float(), nullable=True),
    )
    op.add_column(
        "yoradm_orid_stock_costing",
        sa.Column("dhall_overheads_pct", sa.Float(), nullable=True),
    )
    op.add_column(
        "yoradm_orid_stock_costing",
        sa.Column("dhall_discount_pct", sa.Float(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("yoradm_orid_stock_costing", "dhall_discount_pct")
    op.drop_column("yoradm_orid_stock_costing", "dhall_overheads_pct")
    op.drop_column("yoradm_orid_stock_costing", "dhall_cost_rate")
