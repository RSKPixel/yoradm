"""Create yoradm_party_collection_performance table

Revision ID: 0037_party_collection_perf
Revises: 0036_pdc_status_cleared
Create Date: 2026-07-22
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0037_party_collection_perf"
down_revision: Union[str, None] = "0036_pdc_status_cleared"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "yoradm_party_collection_performance",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("ledger_name", sa.String(length=255), nullable=False),
        sa.Column("avg_days", sa.Float(), nullable=False, server_default="0"),
        sa.Column("matched_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("matched_amount", sa.Float(), nullable=False, server_default="0"),
        sa.Column("date_from", sa.Date(), nullable=False),
        sa.Column("date_to", sa.Date(), nullable=False),
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
            "ledger_name", name="uq_yoradm_party_collection_perf_ledger"
        ),
    )
    op.create_index(
        op.f("ix_yoradm_party_collection_performance_ledger_name"),
        "yoradm_party_collection_performance",
        ["ledger_name"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_yoradm_party_collection_performance_ledger_name"),
        table_name="yoradm_party_collection_performance",
    )
    op.drop_table("yoradm_party_collection_performance")
