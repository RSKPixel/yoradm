"""Create yoradm_orid_stock_pending for Orid stock analysis pendings.

Revision ID: 0046_orid_stock_pending
Revises: 0045_yoradm_tally_import
Create Date: 2026-10-13
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0046_orid_stock_pending"
down_revision: Union[str, None] = "0045_yoradm_tally_import"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "yoradm_orid_stock_pending",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("stock_group", sa.String(length=64), nullable=False),
        sa.Column("broker", sa.String(length=255), nullable=True),
        sa.Column("po_date", sa.Date(), nullable=True),
        sa.Column("delivery_date", sa.Date(), nullable=True),
        sa.Column("qty", sa.Float(), nullable=True),
        sa.Column("rate", sa.Float(), nullable=True),
        sa.Column("status", sa.String(length=32), nullable=False),
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
        "ix_yoradm_orid_stock_pending_stock_group",
        "yoradm_orid_stock_pending",
        ["stock_group"],
    )
    op.create_index(
        "ix_yoradm_orid_stock_pending_status",
        "yoradm_orid_stock_pending",
        ["status"],
    )
    op.create_index(
        "ix_yoradm_orid_stock_pending_created_by",
        "yoradm_orid_stock_pending",
        ["created_by"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_yoradm_orid_stock_pending_created_by",
        table_name="yoradm_orid_stock_pending",
    )
    op.drop_index(
        "ix_yoradm_orid_stock_pending_status",
        table_name="yoradm_orid_stock_pending",
    )
    op.drop_index(
        "ix_yoradm_orid_stock_pending_stock_group",
        table_name="yoradm_orid_stock_pending",
    )
    op.drop_table("yoradm_orid_stock_pending")
