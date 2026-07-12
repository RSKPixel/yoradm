"""empty message

Revision ID: 0001_yoradm_auth
Revises:
Create Date: 2026-07-11
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0001_yoradm_auth"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "yoradm_users",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("hashed_password", sa.String(length=255), nullable=False),
        sa.Column("full_name", sa.String(length=255), nullable=False),
        sa.Column(
            "role",
            sa.Enum("Admin", "User", name="yoradm_user_role"),
            nullable=False,
        ),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("1")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email"),
    )
    op.create_index("ix_yoradm_users_email", "yoradm_users", ["email"], unique=True)

    op.create_table(
        "yoradm_refresh_tokens",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("jti", sa.String(length=64), nullable=False),
        sa.Column("token_hash", sa.String(length=255), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["yoradm_users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("jti"),
    )
    op.create_index("ix_yoradm_refresh_tokens_user_id", "yoradm_refresh_tokens", ["user_id"])
    op.create_index("ix_yoradm_refresh_tokens_jti", "yoradm_refresh_tokens", ["jti"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_yoradm_refresh_tokens_jti", table_name="yoradm_refresh_tokens")
    op.drop_index("ix_yoradm_refresh_tokens_user_id", table_name="yoradm_refresh_tokens")
    op.drop_table("yoradm_refresh_tokens")
    op.drop_index("ix_yoradm_users_email", table_name="yoradm_users")
    op.drop_table("yoradm_users")
    sa.Enum(name="yoradm_user_role").drop(op.get_bind(), checkfirst=True)
