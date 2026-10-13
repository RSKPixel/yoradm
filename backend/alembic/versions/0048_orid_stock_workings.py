"""Create yoradm_orid_stock_workings for Orid stock analysis workings snapshot.

Revision ID: 0048_orid_stock_workings
Revises: 0047_orid_stock_costing
Create Date: 2026-10-13
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0048_orid_stock_workings"
down_revision: Union[str, None] = "0047_orid_stock_costing"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "yoradm_orid_stock_workings",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("as_of", sa.Date(), nullable=True),
        sa.Column("estimated_sales_50kg", sa.Float(), nullable=True),
        sa.Column("qty_in_50kg", sa.Float(), nullable=True),
        sa.Column("estimated_days", sa.Float(), nullable=True),
        sa.Column("rows_json", sa.JSON(), nullable=True),
        sa.Column("created_by", sa.Integer(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["created_by"],
            ["yoradm_users.id"],
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_yoradm_orid_stock_workings_as_of",
        "yoradm_orid_stock_workings",
        ["as_of"],
    )
    op.create_index(
        "ix_yoradm_orid_stock_workings_created_by",
        "yoradm_orid_stock_workings",
        ["created_by"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_yoradm_orid_stock_workings_created_by",
        table_name="yoradm_orid_stock_workings",
    )
    op.drop_index(
        "ix_yoradm_orid_stock_workings_as_of",
        table_name="yoradm_orid_stock_workings",
    )
    op.drop_table("yoradm_orid_stock_workings")
