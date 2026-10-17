"""Drop unused yoradm_sales, yoradm_purchase, yoradm_daybook2 (Tally sync module removed).

Revision ID: 0051_drop_yoradm_tally_import
Revises: 0050_orid_costing_raw_source
Create Date: 2026-10-17
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0051_drop_yoradm_tally_import"
down_revision: Union[str, None] = "0050_orid_costing_raw_source"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Idempotent: local/dev may have already dropped these before deploy.
    # Avoid SHOW TABLES LIKE '...%' — pymysql treats % as a format char.
    inspector = sa.inspect(op.get_bind())
    existing = set(inspector.get_table_names())
    if "yoradm_daybook2" in existing:
        op.drop_index("ix_yoradm_daybook2_vdt", table_name="yoradm_daybook2")
        op.drop_index("ix_yoradm_daybook2_vno", table_name="yoradm_daybook2")
        op.drop_index("ix_yoradm_daybook2_sync_key", table_name="yoradm_daybook2")
        op.drop_table("yoradm_daybook2")
    if "yoradm_purchase" in existing:
        op.drop_index("ix_yoradm_purchase_sync_key", table_name="yoradm_purchase")
        op.drop_table("yoradm_purchase")
    if "yoradm_sales" in existing:
        op.drop_index("ix_yoradm_sales_sync_key", table_name="yoradm_sales")
        op.drop_table("yoradm_sales")


def downgrade() -> None:
    op.create_table(
        "yoradm_sales",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("sync_key", sa.String(length=64), nullable=False),
        sa.Column("voucher_no", sa.String(length=64), nullable=True),
        sa.Column("voucher_date", sa.DateTime(), nullable=True),
        sa.Column("ledger_name", sa.String(length=255), nullable=True),
        sa.Column("broker", sa.String(length=255), nullable=True),
        sa.Column("item_count", sa.Float(), nullable=True),
        sa.Column("item_no", sa.Float(), nullable=True),
        sa.Column("stock_item", sa.String(length=255), nullable=True),
        sa.Column("brand", sa.Text(), nullable=True),
        sa.Column("packing", sa.Float(), nullable=True),
        sa.Column("qty", sa.Float(), nullable=True),
        sa.Column("rate", sa.Float(), nullable=True),
        sa.Column("amount", sa.Float(), nullable=True),
        sa.Column("discount", sa.Float(), nullable=True),
        sa.Column("cartage", sa.Float(), nullable=True),
        sa.Column(
            "synced_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("sync_key"),
    )
    op.create_index("ix_yoradm_sales_sync_key", "yoradm_sales", ["sync_key"])

    op.create_table(
        "yoradm_purchase",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("sync_key", sa.String(length=64), nullable=False),
        sa.Column("voucher_no", sa.String(length=64), nullable=True),
        sa.Column("voucher_date", sa.DateTime(), nullable=True),
        sa.Column("ledger_name", sa.String(length=255), nullable=True),
        sa.Column("broker", sa.String(length=255), nullable=True),
        sa.Column("item_count", sa.Float(), nullable=True),
        sa.Column("itemno", sa.Float(), nullable=True),
        sa.Column("stock_item", sa.String(length=255), nullable=True),
        sa.Column("brand", sa.Text(), nullable=True),
        sa.Column("packing", sa.Float(), nullable=True),
        sa.Column("qty", sa.Float(), nullable=True),
        sa.Column("weight", sa.Float(), nullable=True),
        sa.Column("rate", sa.Float(), nullable=True),
        sa.Column("amount", sa.Float(), nullable=True),
        sa.Column(
            "synced_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("sync_key"),
    )
    op.create_index("ix_yoradm_purchase_sync_key", "yoradm_purchase", ["sync_key"])

    op.create_table(
        "yoradm_daybook2",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("sync_key", sa.String(length=64), nullable=False),
        sa.Column("vtype", sa.String(length=64), nullable=True),
        sa.Column("vno", sa.String(length=64), nullable=True),
        sa.Column("vdt", sa.DateTime(), nullable=True),
        sa.Column("narration", sa.Text(), nullable=True),
        sa.Column("debit_credit", sa.String(length=32), nullable=True),
        sa.Column("ledger_name", sa.String(length=255), nullable=True),
        sa.Column("costcentre_name", sa.String(length=255), nullable=True),
        sa.Column("costcentre_amt", sa.Float(), nullable=True),
        sa.Column("ledger_amount", sa.Float(), nullable=True),
        sa.Column("bill_no", sa.String(length=128), nullable=True),
        sa.Column("bill_type", sa.String(length=64), nullable=True),
        sa.Column(
            "synced_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("sync_key"),
    )
    op.create_index("ix_yoradm_daybook2_sync_key", "yoradm_daybook2", ["sync_key"])
    op.create_index("ix_yoradm_daybook2_vno", "yoradm_daybook2", ["vno"])
    op.create_index("ix_yoradm_daybook2_vdt", "yoradm_daybook2", ["vdt"])
