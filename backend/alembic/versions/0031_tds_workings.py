"""Create yoradm_tds_workings table

Revision ID: 0031_tds_workings
Revises: 0030_payroll_attendance
Create Date: 2026-07-21
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0031_tds_workings"
down_revision: Union[str, None] = "0030_payroll_attendance"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "yoradm_tds_workings",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("source_id", sa.BigInteger(), nullable=False),
        sa.Column("voucher_date", sa.Date(), nullable=True),
        sa.Column("voucher_no", sa.String(length=64), nullable=True),
        sa.Column("party", sa.String(length=255), nullable=True),
        sa.Column("pan", sa.String(length=32), nullable=True),
        sa.Column("tds_head", sa.String(length=255), nullable=True),
        sa.Column("amount", sa.Float(), nullable=False, server_default="0"),
        sa.Column("narration", sa.Text(), nullable=True),
        sa.Column("bill_no", sa.String(length=128), nullable=True),
        sa.Column("bill_type", sa.String(length=64), nullable=True),
        sa.Column("expenses_date", sa.Date(), nullable=True),
        sa.Column("expenses_amount", sa.Float(), nullable=True),
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
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("source_id", name="uq_yoradm_tds_workings_source_id"),
    )
    op.create_index(
        op.f("ix_yoradm_tds_workings_source_id"),
        "yoradm_tds_workings",
        ["source_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_yoradm_tds_workings_voucher_date"),
        "yoradm_tds_workings",
        ["voucher_date"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_yoradm_tds_workings_voucher_date"), table_name="yoradm_tds_workings")
    op.drop_index(op.f("ix_yoradm_tds_workings_source_id"), table_name="yoradm_tds_workings")
    op.drop_table("yoradm_tds_workings")
