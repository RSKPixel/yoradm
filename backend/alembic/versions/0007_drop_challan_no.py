"""Drop challan_no from delivery challan; id is the challan number

Revision ID: 0007_drop_challan_no
Revises: 0006_delivery_challan
Create Date: 2026-07-12
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0007_drop_challan_no"
down_revision: Union[str, None] = "0006_delivery_challan"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # MySQL drops indexes on this column automatically with the column.
    op.drop_column("yoradm_delivery_challan", "challan_no")


def downgrade() -> None:
    op.add_column(
        "yoradm_delivery_challan",
        sa.Column("challan_no", sa.String(length=64), nullable=False),
    )
    op.create_index(
        op.f("ix_yoradm_delivery_challan_challan_no"),
        "yoradm_delivery_challan",
        ["challan_no"],
        unique=True,
    )
