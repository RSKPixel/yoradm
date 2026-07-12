"""Add username to yoradm_users

Revision ID: 0002_add_username
Revises: 0001_yoradm_auth
Create Date: 2026-07-11
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0002_add_username"
down_revision: Union[str, None] = "0001_yoradm_auth"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("yoradm_users", sa.Column("username", sa.String(length=64), nullable=True))
    op.execute(
        """
        UPDATE yoradm_users
        SET username = CONCAT('user', id)
        WHERE username IS NULL OR username = ''
        """
    )
    op.execute(
        """
        UPDATE yoradm_users
        SET username = 'admin'
        WHERE email = 'admin@yoradm.com'
        """
    )
    op.alter_column("yoradm_users", "username", existing_type=sa.String(length=64), nullable=False)
    op.create_index("ix_yoradm_users_username", "yoradm_users", ["username"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_yoradm_users_username", table_name="yoradm_users")
    op.drop_column("yoradm_users", "username")
