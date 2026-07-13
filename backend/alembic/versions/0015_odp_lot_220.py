"""Renumber orid dhall lot 1 to 220

Revision ID: 0015_odp_lot_220
Revises: 0014_dc_discount
Create Date: 2026-07-13
"""

from typing import Sequence, Union

from alembic import op

revision: str = "0015_odp_lot_220"
down_revision: Union[str, None] = "0014_dc_discount"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Lot / batch no. follows production id. Move existing lot 1 → 220 and
    # continue new lots from 221.
    op.execute("SET FOREIGN_KEY_CHECKS=0")
    op.execute(
        """
        UPDATE yoradm_orid_dhall_production_line
        SET production_id = 220
        WHERE production_id = 1
        """
    )
    op.execute(
        """
        UPDATE yoradm_orid_dhall_production
        SET id = 220, lot_no = '220'
        WHERE id = 1
        """
    )
    op.execute(
        """
        UPDATE yoradm_delivery_challan
        SET batch_no = '220'
        WHERE TRIM(batch_no) = '1'
        """
    )
    op.execute("ALTER TABLE yoradm_orid_dhall_production AUTO_INCREMENT = 221")
    op.execute("SET FOREIGN_KEY_CHECKS=1")


def downgrade() -> None:
    op.execute("SET FOREIGN_KEY_CHECKS=0")
    op.execute(
        """
        UPDATE yoradm_orid_dhall_production_line
        SET production_id = 1
        WHERE production_id = 220
        """
    )
    op.execute(
        """
        UPDATE yoradm_orid_dhall_production
        SET id = 1, lot_no = '1'
        WHERE id = 220
        """
    )
    op.execute(
        """
        UPDATE yoradm_delivery_challan
        SET batch_no = '1'
        WHERE TRIM(batch_no) = '220'
        """
    )
    op.execute("ALTER TABLE yoradm_orid_dhall_production AUTO_INCREMENT = 2")
    op.execute("SET FOREIGN_KEY_CHECKS=1")
