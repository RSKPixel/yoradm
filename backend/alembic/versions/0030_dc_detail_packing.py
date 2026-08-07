"""Backfill null packing on delivery challan detail lines.

Revision ID: 0030_dc_detail_packing
Revises: 0043_yoradm_brokerage
Create Date: 2026-08-07
"""

from typing import Sequence, Union

revision: str = "0030_dc_detail_packing"
down_revision: Union[str, None] = "0043_yoradm_brokerage"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    from app.db.session import SessionLocal
    from app.services.delivery_challan_service import backfill_delivery_detail_packing

    db = SessionLocal()
    try:
        backfill_delivery_detail_packing(db)
    finally:
        db.close()


def downgrade() -> None:
    pass
