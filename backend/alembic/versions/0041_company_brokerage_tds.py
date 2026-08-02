"""Add brokerage_tds_pct to company

Revision ID: 0041_company_brokerage_tds
Revises: 0040_brokerage_setting
Create Date: 2026-08-02
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0041_company_brokerage_tds"
down_revision: Union[str, None] = "0040_brokerage_setting"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "yoradm_company",
        sa.Column("brokerage_tds_pct", sa.Float(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("yoradm_company", "brokerage_tds_pct")
