"""Add last_login_at to yoradm_users

Revision ID: 0004_add_last_login
Revises: 0003_add_profile_pic
Create Date: 2026-07-12
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0004_add_last_login"
down_revision: Union[str, None] = "0003_add_profile_pic"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "yoradm_users",
        sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("yoradm_users", "last_login_at")
