"""Add status to orid dhall production

Revision ID: 0012_odp_status
Revises: 0011_dc_detail_amount
Create Date: 2026-07-13
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0012_odp_status"
down_revision: Union[str, None] = "0011_dc_detail_amount"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    cols = {c["name"] for c in inspector.get_columns("yoradm_orid_dhall_production")}
    if "status" not in cols:
        op.add_column(
            "yoradm_orid_dhall_production",
            sa.Column(
                "status",
                sa.String(length=16),
                nullable=False,
                server_default="Open",
            ),
        )


def downgrade() -> None:
    op.drop_column("yoradm_orid_dhall_production", "status")
