"""Store packing FY as yyyy-yyyy (e.g. 2026-2027)

Revision ID: 0021_packing_fy_label
Revises: 0020_packing_fy_code
Create Date: 2026-07-16
"""

from typing import Sequence, Union

from alembic import op

revision: str = "0021_packing_fy_label"
down_revision: Union[str, None] = "0020_packing_fy_code"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TABLE yoradm_packing_stock_fy DROP INDEX uq_yoradm_packing_stock_fy_sku_fy")
    op.execute("ALTER TABLE yoradm_packing_stock_fy DROP INDEX ix_yoradm_packing_stock_fy_fy")
    op.execute(
        "ALTER TABLE yoradm_packing_stock_fy CHANGE fy fy VARCHAR(9) NOT NULL"
    )
    # Convert compact 2627 → 2026-2027
    op.execute(
        """
        UPDATE yoradm_packing_stock_fy
        SET fy = CONCAT(
            2000 + FLOOR(CAST(fy AS UNSIGNED) / 100),
            '-',
            2000 + (CAST(fy AS UNSIGNED) % 100)
        )
        WHERE fy NOT LIKE '%-%'
        """
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
    # Convert 2026-2027 → 2627 before changing type
    op.execute(
        """
        UPDATE yoradm_packing_stock_fy
        SET fy = CONCAT(
            CAST(SUBSTRING_INDEX(fy, '-', 1) AS UNSIGNED) % 100,
            LPAD(CAST(SUBSTRING_INDEX(fy, '-', -1) AS UNSIGNED) % 100, 2, '0')
        )
        WHERE fy LIKE '%-%'
        """
    )
    op.execute(
        "ALTER TABLE yoradm_packing_stock_fy CHANGE fy fy INTEGER NOT NULL"
    )
    op.execute("CREATE INDEX ix_yoradm_packing_stock_fy_fy ON yoradm_packing_stock_fy (fy)")
    op.execute(
        """
        ALTER TABLE yoradm_packing_stock_fy
        ADD CONSTRAINT uq_yoradm_packing_stock_fy_sku_fy UNIQUE (sku_id, fy)
        """
    )
