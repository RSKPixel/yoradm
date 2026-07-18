"""Create goods receipt table

Revision ID: 0026_goods_receipt
Revises: 0025_packing_purchase
Create Date: 2026-07-18
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0026_goods_receipt"
down_revision: Union[str, None] = "0025_packing_purchase"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "yoradm_goods_receipt",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("receipt_date", sa.Date(), nullable=False),
        sa.Column("vendor", sa.String(length=255), nullable=False),
        sa.Column("stock_item", sa.String(length=255), nullable=False),
        sa.Column("qty", sa.Float(), nullable=False),
        sa.Column("weight", sa.Float(), nullable=False),
        sa.Column("invoice_no", sa.String(length=64), nullable=False),
        sa.Column("invoice_date", sa.Date(), nullable=True),
        sa.Column("invoice_value", sa.Float(), nullable=True),
        sa.Column("invoiced_weight", sa.Float(), nullable=True),
        sa.Column("tds_applicable", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("tds_value", sa.Float(), nullable=True),
        sa.Column("unloaded_at", sa.String(length=128), nullable=False),
        sa.Column("broker", sa.String(length=128), nullable=True),
        sa.Column("received_by", sa.String(length=128), nullable=True),
        sa.Column("vehicle_no", sa.String(length=64), nullable=True),
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
    )
    op.create_index(
        op.f("ix_yoradm_goods_receipt_receipt_date"),
        "yoradm_goods_receipt",
        ["receipt_date"],
        unique=False,
    )
    op.create_index(
        op.f("ix_yoradm_goods_receipt_invoice_no"),
        "yoradm_goods_receipt",
        ["invoice_no"],
        unique=False,
    )
    op.create_index(
        op.f("ix_yoradm_goods_receipt_created_by"),
        "yoradm_goods_receipt",
        ["created_by"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_yoradm_goods_receipt_created_by"), table_name="yoradm_goods_receipt")
    op.drop_index(op.f("ix_yoradm_goods_receipt_invoice_no"), table_name="yoradm_goods_receipt")
    op.drop_index(op.f("ix_yoradm_goods_receipt_receipt_date"), table_name="yoradm_goods_receipt")
    op.drop_table("yoradm_goods_receipt")
