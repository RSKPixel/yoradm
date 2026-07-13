"""Create orid dhall production header and purchase line tables

Revision ID: 0010_orid_dhall_production
Revises: 0009_yoradm_company
Create Date: 2026-07-12
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0010_orid_dhall_production"
down_revision: Union[str, None] = "0009_yoradm_company"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "yoradm_orid_dhall_production",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("production_date", sa.Date(), nullable=False),
        sa.Column("lot_no", sa.String(length=64), nullable=True),
        sa.Column("opening_bags", sa.String(length=64), nullable=True),
        sa.Column("opening_rate", sa.String(length=64), nullable=True),
        sa.Column("previous_batch_bags", sa.String(length=64), nullable=True),
        sa.Column("previous_batch_rate", sa.String(length=64), nullable=True),
        sa.Column("delivery_bags", sa.String(length=64), nullable=True),
        sa.Column("delivery_rate", sa.String(length=64), nullable=True),
        sa.Column("closing_bags", sa.String(length=64), nullable=True),
        sa.Column("closing_rate", sa.String(length=64), nullable=True),
        sa.Column("split_bags", sa.String(length=64), nullable=True),
        sa.Column("split_rate", sa.String(length=64), nullable=True),
        sa.Column("sortex_bags", sa.String(length=64), nullable=True),
        sa.Column("sortex_rate", sa.String(length=64), nullable=True),
        sa.Column("husk_bags", sa.String(length=64), nullable=True),
        sa.Column("husk_rate", sa.String(length=64), nullable=True),
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
        op.f("ix_yoradm_orid_dhall_production_production_date"),
        "yoradm_orid_dhall_production",
        ["production_date"],
        unique=False,
    )
    op.create_index(
        op.f("ix_yoradm_orid_dhall_production_created_by"),
        "yoradm_orid_dhall_production",
        ["created_by"],
        unique=False,
    )

    op.create_table(
        "yoradm_orid_dhall_production_line",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("production_id", sa.Integer(), nullable=False),
        sa.Column("line_kind", sa.String(length=16), nullable=False),
        sa.Column("purchase_id", sa.Integer(), nullable=True),
        sa.Column("voucher_no", sa.String(length=64), nullable=True),
        sa.Column("voucher_date", sa.String(length=32), nullable=True),
        sa.Column("ledger_name", sa.String(length=255), nullable=True),
        sa.Column("broker", sa.String(length=255), nullable=True),
        sa.Column("stock_item", sa.String(length=255), nullable=True),
        sa.Column("brand", sa.String(length=128), nullable=True),
        sa.Column("packing", sa.Float(), nullable=True),
        sa.Column("qty", sa.Float(), nullable=True),
        sa.Column("weight", sa.Float(), nullable=True),
        sa.Column("rate", sa.Float(), nullable=True),
        sa.Column("amount", sa.Float(), nullable=True),
        sa.Column("line_no", sa.Integer(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["production_id"],
            ["yoradm_orid_dhall_production.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_yoradm_orid_dhall_production_line_production_id"),
        "yoradm_orid_dhall_production_line",
        ["production_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_yoradm_orid_dhall_production_line_line_kind"),
        "yoradm_orid_dhall_production_line",
        ["line_kind"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_yoradm_orid_dhall_production_line_line_kind"),
        table_name="yoradm_orid_dhall_production_line",
    )
    op.drop_index(
        op.f("ix_yoradm_orid_dhall_production_line_production_id"),
        table_name="yoradm_orid_dhall_production_line",
    )
    op.drop_table("yoradm_orid_dhall_production_line")
    op.drop_index(
        op.f("ix_yoradm_orid_dhall_production_created_by"),
        table_name="yoradm_orid_dhall_production",
    )
    op.drop_index(
        op.f("ix_yoradm_orid_dhall_production_production_date"),
        table_name="yoradm_orid_dhall_production",
    )
    op.drop_table("yoradm_orid_dhall_production")
