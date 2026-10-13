"""Add estimated_sales_mode to yoradm_orid_stock_workings.

Revision ID: 0049_orid_workings_sales_mode
Revises: 0048_orid_stock_workings
Create Date: 2026-10-13
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0049_orid_workings_sales_mode"
down_revision: Union[str, None] = "0048_orid_stock_workings"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "yoradm_orid_stock_workings",
        sa.Column(
            "estimated_sales_mode",
            sa.String(length=32),
            nullable=True,
            server_default="manual",
        ),
    )


def downgrade() -> None:
    op.drop_column("yoradm_orid_stock_workings", "estimated_sales_mode")
