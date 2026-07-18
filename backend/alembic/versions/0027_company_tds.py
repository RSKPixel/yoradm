"""Add TDS purchase settings to company

Revision ID: 0027_company_tds
Revises: 0026_goods_receipt
Create Date: 2026-07-18
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0027_company_tds"
down_revision: Union[str, None] = "0026_goods_receipt"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "yoradm_company",
        sa.Column("tds_purchase_pct", sa.Float(), nullable=True),
    )
    op.add_column(
        "yoradm_company",
        sa.Column("tds_threshold", sa.Float(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("yoradm_company", "tds_threshold")
    op.drop_column("yoradm_company", "tds_purchase_pct")
