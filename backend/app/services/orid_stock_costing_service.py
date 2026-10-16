from __future__ import annotations

from typing import Optional

from sqlalchemy.orm import Session

from app.models.orid_stock_costing import OridStockCosting
from app.schemas.orid_stock_costing import OridStockCostingOut, OridStockCostingSaveIn

_COSTING_FIELDS = (
    "raw_qty_source",
    "orid_dhall_pct",
    "orid_dhall_split_pct",
    "orid_rejection_pct",
    "orid_husk_pct",
    "expenses_pct",
    "split_rate",
    "rejection_rate",
    "husk_rate",
)


def _to_out(row: OridStockCosting) -> OridStockCostingOut:
    return OridStockCostingOut.model_validate(row)


def get_costing(db: Session) -> Optional[OridStockCostingOut]:
    row = db.query(OridStockCosting).order_by(OridStockCosting.id.asc()).first()
    return _to_out(row) if row else None


def save_costing(
    db: Session,
    payload: OridStockCostingSaveIn,
    *,
    created_by: Optional[int] = None,
) -> OridStockCostingOut:
    row = db.query(OridStockCosting).order_by(OridStockCosting.id.asc()).first()
    data = payload.model_dump()
    if row is None:
        row = OridStockCosting(created_by=created_by, **data)
        db.add(row)
    else:
        for key in _COSTING_FIELDS:
            setattr(row, key, data.get(key))
    db.commit()
    db.refresh(row)
    return _to_out(row)
