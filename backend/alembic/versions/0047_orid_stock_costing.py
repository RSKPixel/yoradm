"""Create yoradm_orid_stock_costing for Orid stock analysis costing inputs.

Revision ID: 0047_orid_stock_costing
Revises: 0046_orid_stock_pending
Create Date: 2026-10-13
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0047_orid_stock_costing"
down_revision: Union[str, None] = "0046_orid_stock_pending"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "yoradm_orid_stock_costing",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("orid_dhall_pct", sa.Float(), nullable=True),
        sa.Column("orid_dhall_split_pct", sa.Float(), nullable=True),
        sa.Column("orid_rejection_pct", sa.Float(), nullable=True),
        sa.Column("orid_husk_pct", sa.Float(), nullable=True),
        sa.Column("expenses_pct", sa.Float(), nullable=True),
        sa.Column("split_rate", sa.Float(), nullable=True),
        sa.Column("rejection_rate", sa.Float(), nullable=True),
        sa.Column("husk_rate", sa.Float(), nullable=True),
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
        "ix_yoradm_orid_stock_costing_created_by",
        "yoradm_orid_stock_costing",
        ["created_by"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_yoradm_orid_stock_costing_created_by",
        table_name="yoradm_orid_stock_costing",
    )
    op.drop_table("yoradm_orid_stock_costing")
