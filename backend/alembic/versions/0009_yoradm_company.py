"""Create yoradm_company table

Revision ID: 0009_yoradm_company
Revises: 0008_dc_detail_packing
Create Date: 2026-07-12
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0009_yoradm_company"
down_revision: Union[str, None] = "0008_dc_detail_packing"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "yoradm_company",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("company_name", sa.String(length=255), nullable=False),
        sa.Column("legal_name", sa.String(length=255), nullable=True),
        sa.Column("address", sa.String(length=512), nullable=False),
        sa.Column("area", sa.String(length=128), nullable=True),
        sa.Column("city", sa.String(length=128), nullable=False),
        sa.Column("state", sa.String(length=128), nullable=False),
        sa.Column("pincode", sa.String(length=16), nullable=True),
        sa.Column("country", sa.String(length=64), nullable=False, server_default="India"),
        sa.Column("email", sa.String(length=255), nullable=True),
        sa.Column("phone", sa.String(length=32), nullable=True),
        sa.Column("mobile", sa.String(length=32), nullable=True),
        sa.Column("website", sa.String(length=255), nullable=True),
        sa.Column("gstin", sa.String(length=20), nullable=True),
        sa.Column("pan", sa.String(length=20), nullable=True),
        sa.Column("cin", sa.String(length=32), nullable=True),
        sa.Column("contact_person", sa.String(length=128), nullable=True),
        sa.Column("logo_url", sa.String(length=512), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("1")),
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
        sa.UniqueConstraint("gstin"),
    )
    op.create_index(
        op.f("ix_yoradm_company_company_name"),
        "yoradm_company",
        ["company_name"],
        unique=False,
    )
    op.create_index(
        op.f("ix_yoradm_company_city"),
        "yoradm_company",
        ["city"],
        unique=False,
    )
    op.create_index(
        op.f("ix_yoradm_company_state"),
        "yoradm_company",
        ["state"],
        unique=False,
    )
    op.create_index(
        op.f("ix_yoradm_company_email"),
        "yoradm_company",
        ["email"],
        unique=False,
    )
    op.create_index(
        op.f("ix_yoradm_company_gstin"),
        "yoradm_company",
        ["gstin"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_yoradm_company_gstin"), table_name="yoradm_company")
    op.drop_index(op.f("ix_yoradm_company_email"), table_name="yoradm_company")
    op.drop_index(op.f("ix_yoradm_company_state"), table_name="yoradm_company")
    op.drop_index(op.f("ix_yoradm_company_city"), table_name="yoradm_company")
    op.drop_index(op.f("ix_yoradm_company_company_name"), table_name="yoradm_company")
    op.drop_table("yoradm_company")
