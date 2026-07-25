"""Create yoradm_post_dated_cheque_allocation

Revision ID: 0034_pdc_allocation
Revises: 0033_post_dated_cheque
Create Date: 2026-07-22
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0034_pdc_allocation"
down_revision: Union[str, None] = "0033_post_dated_cheque"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "yoradm_post_dated_cheque_allocation",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("cheque_id", sa.Integer(), nullable=False),
        sa.Column("party", sa.String(length=255), nullable=False),
        sa.Column("receivable_id", sa.BigInteger(), nullable=True),
        sa.Column("invoice_no", sa.String(length=128), nullable=False),
        sa.Column("allocated_amount", sa.Float(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["cheque_id"],
            ["yoradm_post_dated_cheque.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_yoradm_pdc_alloc_cheque_id"),
        "yoradm_post_dated_cheque_allocation",
        ["cheque_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_yoradm_pdc_alloc_party"),
        "yoradm_post_dated_cheque_allocation",
        ["party"],
        unique=False,
    )
    op.create_index(
        op.f("ix_yoradm_pdc_alloc_invoice_no"),
        "yoradm_post_dated_cheque_allocation",
        ["invoice_no"],
        unique=False,
    )
    op.create_index(
        op.f("ix_yoradm_pdc_alloc_receivable_id"),
        "yoradm_post_dated_cheque_allocation",
        ["receivable_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_yoradm_pdc_alloc_receivable_id"),
        table_name="yoradm_post_dated_cheque_allocation",
    )
    op.drop_index(
        op.f("ix_yoradm_pdc_alloc_invoice_no"),
        table_name="yoradm_post_dated_cheque_allocation",
    )
    op.drop_index(
        op.f("ix_yoradm_pdc_alloc_party"),
        table_name="yoradm_post_dated_cheque_allocation",
    )
    op.drop_index(
        op.f("ix_yoradm_pdc_alloc_cheque_id"),
        table_name="yoradm_post_dated_cheque_allocation",
    )
    op.drop_table("yoradm_post_dated_cheque_allocation")
