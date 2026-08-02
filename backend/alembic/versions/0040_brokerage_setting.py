"""Create yoradm_brokerage_setting for period TDS percent

Revision ID: 0040_brokerage_setting
Revises: 0039_brokerage_rate
Create Date: 2026-08-02
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0040_brokerage_setting"
down_revision: Union[str, None] = "0039_brokerage_rate"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "yoradm_brokerage_setting",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("fy_start", sa.Integer(), nullable=False),
        sa.Column("month", sa.Integer(), nullable=False),
        sa.Column("broker", sa.String(length=255), nullable=False),
        sa.Column("tds_percent", sa.Float(), nullable=True),
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
            onupdate=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "fy_start",
            "month",
            "broker",
            name="uq_yoradm_brokerage_setting_key",
        ),
    )
    op.create_index(
        "ix_yoradm_brokerage_setting_fy_month_broker",
        "yoradm_brokerage_setting",
        ["fy_start", "month", "broker"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_yoradm_brokerage_setting_fy_month_broker",
        table_name="yoradm_brokerage_setting",
    )
    op.drop_table("yoradm_brokerage_setting")
