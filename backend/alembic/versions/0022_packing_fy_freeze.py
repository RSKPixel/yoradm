"""Add freeze status to packing FY stock

Revision ID: 0022_packing_fy_freeze
Revises: 0021_packing_fy_label
Create Date: 2026-07-16
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0022_packing_fy_freeze"
down_revision: Union[str, None] = "0021_packing_fy_label"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "yoradm_packing_stock_fy",
        sa.Column(
            "status",
            sa.String(length=16),
            nullable=False,
            server_default="Open",
        ),
    )
    op.create_index(
        "ix_yoradm_packing_stock_fy_status",
        "yoradm_packing_stock_fy",
        ["status"],
    )


def downgrade() -> None:
    op.drop_index("ix_yoradm_packing_stock_fy_status", table_name="yoradm_packing_stock_fy")
    op.drop_column("yoradm_packing_stock_fy", "status")
