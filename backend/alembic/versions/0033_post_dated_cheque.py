"""Create yoradm_post_dated_cheque table

Revision ID: 0033_post_dated_cheque
Revises: 0032_tds_expense_source
Create Date: 2026-07-22
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0033_post_dated_cheque"
down_revision: Union[str, None] = "0032_tds_expense_source"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "yoradm_post_dated_cheque",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("party", sa.String(length=255), nullable=False),
        sa.Column("cheque_no", sa.String(length=64), nullable=False),
        sa.Column("cheque_date", sa.Date(), nullable=False),
        sa.Column("cheque_present_date", sa.Date(), nullable=True),
        sa.Column("cheque_amount", sa.Float(), nullable=False),
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
        op.f("ix_yoradm_post_dated_cheque_party"),
        "yoradm_post_dated_cheque",
        ["party"],
        unique=False,
    )
    op.create_index(
        op.f("ix_yoradm_post_dated_cheque_cheque_no"),
        "yoradm_post_dated_cheque",
        ["cheque_no"],
        unique=False,
    )
    op.create_index(
        op.f("ix_yoradm_post_dated_cheque_cheque_date"),
        "yoradm_post_dated_cheque",
        ["cheque_date"],
        unique=False,
    )
    op.create_index(
        op.f("ix_yoradm_post_dated_cheque_created_by"),
        "yoradm_post_dated_cheque",
        ["created_by"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_yoradm_post_dated_cheque_created_by"),
        table_name="yoradm_post_dated_cheque",
    )
    op.drop_index(
        op.f("ix_yoradm_post_dated_cheque_cheque_date"),
        table_name="yoradm_post_dated_cheque",
    )
    op.drop_index(
        op.f("ix_yoradm_post_dated_cheque_cheque_no"),
        table_name="yoradm_post_dated_cheque",
    )
    op.drop_index(
        op.f("ix_yoradm_post_dated_cheque_party"),
        table_name="yoradm_post_dated_cheque",
    )
    op.drop_table("yoradm_post_dated_cheque")
