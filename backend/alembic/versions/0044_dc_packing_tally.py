"""Re-resolve delivery challan packing from Tally (sale before inventory).

Revision ID: 0044_dc_packing_tally
Revises: 0030_dc_detail_packing
Create Date: 2026-08-07
"""

from typing import Sequence, Union

revision: str = "0044_dc_packing_tally"
down_revision: Union[str, None] = "0030_dc_detail_packing"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    from app.db.session import SessionLocal
    from app.services.delivery_challan_service import backfill_delivery_detail_packing

    db = SessionLocal()
    try:
        backfill_delivery_detail_packing(db, reresolve_all=True)
    finally:
        db.close()


def downgrade() -> None:
    pass
