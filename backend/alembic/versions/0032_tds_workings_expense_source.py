"""Add expense_source_id to yoradm_tds_workings

Revision ID: 0032_tds_expense_source
Revises: 0031_tds_workings
Create Date: 2026-07-22
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0032_tds_expense_source"
down_revision: Union[str, None] = "0031_tds_workings"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "yoradm_tds_workings",
        sa.Column("expense_source_id", sa.BigInteger(), nullable=True),
    )
    op.create_index(
        op.f("ix_yoradm_tds_workings_expense_source_id"),
        "yoradm_tds_workings",
        ["expense_source_id"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_yoradm_tds_workings_expense_source_id"),
        table_name="yoradm_tds_workings",
    )
    op.drop_column("yoradm_tds_workings", "expense_source_id")
