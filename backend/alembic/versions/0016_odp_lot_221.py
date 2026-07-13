"""Renumber orid dhall lot 2 to 221

Revision ID: 0016_odp_lot_221
Revises: 0015_odp_lot_220
Create Date: 2026-07-13
"""

from typing import Sequence, Union

from alembic import op

revision: str = "0016_odp_lot_221"
down_revision: Union[str, None] = "0015_odp_lot_220"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("SET FOREIGN_KEY_CHECKS=0")
    op.execute(
        """
        UPDATE yoradm_orid_dhall_production_line
        SET production_id = 221
        WHERE production_id = 2
        """
    )
    op.execute(
        """
        UPDATE yoradm_orid_dhall_production
        SET id = 221, lot_no = '221'
        WHERE id = 2
        """
    )
    op.execute(
        """
        UPDATE yoradm_delivery_challan
        SET batch_no = '221'
        WHERE TRIM(batch_no) = '2'
        """
    )
    op.execute("ALTER TABLE yoradm_orid_dhall_production AUTO_INCREMENT = 222")
    op.execute("SET FOREIGN_KEY_CHECKS=1")


def downgrade() -> None:
    op.execute("SET FOREIGN_KEY_CHECKS=0")
    op.execute(
        """
        UPDATE yoradm_orid_dhall_production_line
        SET production_id = 2
        WHERE production_id = 221
        """
    )
    op.execute(
        """
        UPDATE yoradm_orid_dhall_production
        SET id = 2, lot_no = '2'
        WHERE id = 221
        """
    )
    op.execute(
        """
        UPDATE yoradm_delivery_challan
        SET batch_no = '2'
        WHERE TRIM(batch_no) = '221'
        """
    )
    op.execute("ALTER TABLE yoradm_orid_dhall_production AUTO_INCREMENT = 222")
    op.execute("SET FOREIGN_KEY_CHECKS=1")
