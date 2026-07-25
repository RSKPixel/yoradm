"""Create yoradm_tds_head_payment for month payment date/PDF

Revision ID: 0038_tds_head_payment
Revises: 0037_party_collection_perf
Create Date: 2026-07-25
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0038_tds_head_payment"
down_revision: Union[str, None] = "0037_party_collection_perf"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "yoradm_tds_head_payment",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("fy_start", sa.Integer(), nullable=False),
        sa.Column("month", sa.Integer(), nullable=False),
        sa.Column("tds_head", sa.String(length=255), nullable=False),
        sa.Column("payment_date", sa.Date(), nullable=True),
        sa.Column("pdf_data", sa.LargeBinary(length=(16 * 1024 * 1024) - 1), nullable=True),
        sa.Column("pdf_filename", sa.String(length=255), nullable=True),
        sa.Column("pdf_content_type", sa.String(length=128), nullable=True),
        sa.Column("pdf_size", sa.Integer(), nullable=True),
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
        sa.UniqueConstraint(
            "fy_start",
            "month",
            "tds_head",
            name="uq_yoradm_tds_head_payment_fy_month_head",
        ),
    )
    op.create_index(
        "ix_yoradm_tds_head_payment_fy_month",
        "yoradm_tds_head_payment",
        ["fy_start", "month"],
    )


def downgrade() -> None:
    op.drop_index("ix_yoradm_tds_head_payment_fy_month", table_name="yoradm_tds_head_payment")
    op.drop_table("yoradm_tds_head_payment")
