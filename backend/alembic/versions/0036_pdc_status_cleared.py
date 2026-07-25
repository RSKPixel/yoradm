"""Rename PDC status Passed to Cleared

Revision ID: 0036_pdc_status_cleared
Revises: 0035_pdc_status
Create Date: 2026-07-22
"""

from typing import Sequence, Union

from alembic import op

revision: str = "0036_pdc_status_cleared"
down_revision: Union[str, None] = "0035_pdc_status"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        "UPDATE yoradm_post_dated_cheque SET status = 'Cleared' WHERE status = 'Passed'"
    )


def downgrade() -> None:
    op.execute(
        "UPDATE yoradm_post_dated_cheque SET status = 'Passed' WHERE status = 'Cleared'"
    )
