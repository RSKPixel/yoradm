from __future__ import annotations

from typing import Optional

from sqlalchemy.orm import Session

from app.models.orid_stock_workings import OridStockWorkings
from app.schemas.orid_stock_workings import OridStockWorkingsOut, OridStockWorkingsSaveIn


def _to_out(row: OridStockWorkings) -> OridStockWorkingsOut:
    return OridStockWorkingsOut.model_validate(row)


def get_workings(db: Session) -> Optional[OridStockWorkingsOut]:
    row = db.query(OridStockWorkings).order_by(OridStockWorkings.id.asc()).first()
    return _to_out(row) if row else None


def save_workings(
    db: Session,
    payload: OridStockWorkingsSaveIn,
    *,
    created_by: Optional[int] = None,
) -> OridStockWorkingsOut:
    rows_json = [item.model_dump() for item in payload.rows]
    row = db.query(OridStockWorkings).order_by(OridStockWorkings.id.asc()).first()
    if row is None:
        row = OridStockWorkings(
            as_of=payload.as_of,
            estimated_sales_mode=payload.estimated_sales_mode,
            estimated_sales_50kg=payload.estimated_sales_50kg,
            qty_in_50kg=payload.qty_in_50kg,
            estimated_days=payload.estimated_days,
            rows_json=rows_json,
            created_by=created_by,
        )
        db.add(row)
    else:
        row.as_of = payload.as_of
        row.estimated_sales_mode = payload.estimated_sales_mode
        row.estimated_sales_50kg = payload.estimated_sales_50kg
        row.qty_in_50kg = payload.qty_in_50kg
        row.estimated_days = payload.estimated_days
        row.rows_json = rows_json
    db.commit()
    db.refresh(row)
    return _to_out(row)
