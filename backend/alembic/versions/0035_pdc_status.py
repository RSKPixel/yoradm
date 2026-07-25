"""Add status to yoradm_post_dated_cheque

Revision ID: 0035_pdc_status
Revises: 0034_pdc_allocation
Create Date: 2026-07-22
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0035_pdc_status"
down_revision: Union[str, None] = "0034_pdc_allocation"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "yoradm_post_dated_cheque",
        sa.Column(
            "status",
            sa.String(length=32),
            nullable=False,
            server_default="Postdated",
        ),
    )
    op.create_index(
        "ix_yoradm_post_dated_cheque_status",
        "yoradm_post_dated_cheque",
        ["status"],
    )


def downgrade() -> None:
    op.drop_index("ix_yoradm_post_dated_cheque_status", table_name="yoradm_post_dated_cheque")
    op.drop_column("yoradm_post_dated_cheque", "status")
