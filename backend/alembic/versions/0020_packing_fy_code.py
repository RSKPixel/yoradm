"""Store packing FY as compact code (e.g. 2627)

Revision ID: 0020_packing_fy_code
Revises: 0019_packing_stock_fy
Create Date: 2026-07-16
"""

from typing import Sequence, Union

from alembic import op

revision: str = "0020_packing_fy_code"
down_revision: Union[str, None] = "0019_packing_stock_fy"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Convert 2026 → 2627 before rename.
    op.execute(
        """
        UPDATE yoradm_packing_stock_fy
        SET fy_start = (fy_start % 100) * 100 + ((fy_start + 1) % 100)
        """
    )
    op.execute("ALTER TABLE yoradm_packing_stock_fy DROP INDEX uq_yoradm_packing_stock_fy_sku_fy")
    op.execute("ALTER TABLE yoradm_packing_stock_fy DROP INDEX ix_yoradm_packing_stock_fy_fy_start")
    op.execute(
        "ALTER TABLE yoradm_packing_stock_fy CHANGE fy_start fy INTEGER NOT NULL"
    )
    op.execute("CREATE INDEX ix_yoradm_packing_stock_fy_fy ON yoradm_packing_stock_fy (fy)")
    op.execute(
        """
        ALTER TABLE yoradm_packing_stock_fy
        ADD CONSTRAINT uq_yoradm_packing_stock_fy_sku_fy UNIQUE (sku_id, fy)
        """
    )


def downgrade() -> None:
    op.execute("ALTER TABLE yoradm_packing_stock_fy DROP INDEX uq_yoradm_packing_stock_fy_sku_fy")
    op.execute("ALTER TABLE yoradm_packing_stock_fy DROP INDEX ix_yoradm_packing_stock_fy_fy")
    op.execute(
        "ALTER TABLE yoradm_packing_stock_fy CHANGE fy fy_start INTEGER NOT NULL"
    )
    # Convert 2627 → 2026 (assumes 20xx).
    op.execute(
        """
        UPDATE yoradm_packing_stock_fy
        SET fy_start = 2000 + (fy_start DIV 100)
        """
    )
    op.execute(
        "CREATE INDEX ix_yoradm_packing_stock_fy_fy_start ON yoradm_packing_stock_fy (fy_start)"
    )
    op.execute(
        """
        ALTER TABLE yoradm_packing_stock_fy
        ADD CONSTRAINT uq_yoradm_packing_stock_fy_sku_fy UNIQUE (sku_id, fy_start)
        """
    )
