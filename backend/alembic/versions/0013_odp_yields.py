"""Add wet flour yield and split pct to odp

Revision ID: 0013_odp_yields
Revises: 0012_odp_status
Create Date: 2026-07-13
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0013_odp_yields"
down_revision: Union[str, None] = "0012_odp_status"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "yoradm_orid_dhall_production",
        sa.Column("wet_flour_yield", sa.String(length=64), nullable=True),
    )
    op.add_column(
        "yoradm_orid_dhall_production",
        sa.Column("split_pct", sa.String(length=64), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("yoradm_orid_dhall_production", "split_pct")
    op.drop_column("yoradm_orid_dhall_production", "wet_flour_yield")
