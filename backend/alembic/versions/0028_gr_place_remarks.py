"""Add place and remarks to goods receipt

Revision ID: 0028_gr_place_remarks
Revises: 0027_company_tds
Create Date: 2026-07-18
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0028_gr_place_remarks"
down_revision: Union[str, None] = "0027_company_tds"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "yoradm_goods_receipt",
        sa.Column("place", sa.String(length=128), nullable=True),
    )
    op.add_column(
        "yoradm_goods_receipt",
        sa.Column("remarks", sa.String(length=512), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("yoradm_goods_receipt", "remarks")
    op.drop_column("yoradm_goods_receipt", "place")
