"""Add qty_adjust to brokerage_rate

Revision ID: 0042_brokerage_qty_adjust
Revises: 0041_company_brokerage_tds
Create Date: 2026-08-02
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0042_brokerage_qty_adjust"
down_revision: Union[str, None] = "0041_company_brokerage_tds"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "yoradm_brokerage_rate",
        sa.Column(
            "qty_adjust",
            sa.Float(),
            nullable=False,
            server_default="0",
        ),
    )


def downgrade() -> None:
    op.drop_column("yoradm_brokerage_rate", "qty_adjust")
