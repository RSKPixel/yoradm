"""Add profile_pic to yoradm_users

Revision ID: 0003_add_profile_pic
Revises: 0002_add_username
Create Date: 2026-07-11
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.mysql import MEDIUMTEXT

revision: str = "0003_add_profile_pic"
down_revision: Union[str, None] = "0002_add_username"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("yoradm_users", sa.Column("profile_pic", MEDIUMTEXT(), nullable=True))


def downgrade() -> None:
    op.drop_column("yoradm_users", "profile_pic")
