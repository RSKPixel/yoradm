"""Create delivery challan header and detail tables

Revision ID: 0006_delivery_challan
Revises: 0005_add_current_login
Create Date: 2026-07-12
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0006_delivery_challan"
down_revision: Union[str, None] = "0005_add_current_login"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "yoradm_delivery_challan",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("challan_no", sa.String(length=64), nullable=False),
        sa.Column("challan_date", sa.Date(), nullable=False),
        sa.Column("vehicle_no", sa.String(length=64), nullable=False),
        sa.Column("driver_name", sa.String(length=128), nullable=False),
        sa.Column("batch_no", sa.String(length=64), nullable=True),
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
        sa.ForeignKeyConstraint(["created_by"], ["yoradm_users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("challan_no"),
    )
    op.create_index(
        op.f("ix_yoradm_delivery_challan_challan_no"),
        "yoradm_delivery_challan",
        ["challan_no"],
        unique=True,
    )
    op.create_index(
        op.f("ix_yoradm_delivery_challan_created_by"),
        "yoradm_delivery_challan",
        ["created_by"],
        unique=False,
    )

    op.create_table(
        "yoradm_delivery_challan_detail",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("challan_id", sa.Integer(), nullable=False),
        sa.Column("voucher_no", sa.String(length=64), nullable=False),
        sa.Column("voucher_date", sa.String(length=32), nullable=True),
        sa.Column("ledger_name", sa.String(length=255), nullable=True),
        sa.Column("stock_item", sa.String(length=255), nullable=True),
        sa.Column("brand", sa.String(length=128), nullable=True),
        sa.Column("qty", sa.Float(), nullable=True),
        sa.Column("delivery_location", sa.String(length=128), nullable=False),
        sa.Column("line_no", sa.Integer(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["challan_id"],
            ["yoradm_delivery_challan.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_yoradm_delivery_challan_detail_challan_id"),
        "yoradm_delivery_challan_detail",
        ["challan_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_yoradm_delivery_challan_detail_voucher_no"),
        "yoradm_delivery_challan_detail",
        ["voucher_no"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_yoradm_delivery_challan_detail_voucher_no"),
        table_name="yoradm_delivery_challan_detail",
    )
    op.drop_index(
        op.f("ix_yoradm_delivery_challan_detail_challan_id"),
        table_name="yoradm_delivery_challan_detail",
    )
    op.drop_table("yoradm_delivery_challan_detail")
    op.drop_index(
        op.f("ix_yoradm_delivery_challan_created_by"),
        table_name="yoradm_delivery_challan",
    )
    op.drop_index(
        op.f("ix_yoradm_delivery_challan_challan_no"),
        table_name="yoradm_delivery_challan",
    )
    op.drop_table("yoradm_delivery_challan")
