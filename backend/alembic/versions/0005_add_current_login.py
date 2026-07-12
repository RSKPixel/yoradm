"""Add current_login_at for previous-login display

Revision ID: 0005_add_current_login
Revises: 0004_add_last_login
Create Date: 2026-07-12
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0005_add_current_login"
down_revision: Union[str, None] = "0004_add_last_login"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "yoradm_users",
        sa.Column("current_login_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("yoradm_users", "current_login_at")
