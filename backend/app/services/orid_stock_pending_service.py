from __future__ import annotations

from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.orid_stock_pending import OridStockPending
from app.schemas.orid_stock_pending import (
    OridStockPendingCreate,
    OridStockPendingListOut,
    OridStockPendingOut,
    OridStockPendingUpdate,
)

VALID_STOCK_GROUPS = frozenset({"Orid Raw", "Orid Dhall"})
VALID_STATUSES = frozenset({"pending_purchase", "pending_arrival"})


def _to_out(row: OridStockPending) -> OridStockPendingOut:
    return OridStockPendingOut.model_validate(row)


def list_pendings(
    db: Session,
    *,
    stock_group: Optional[str] = None,
) -> OridStockPendingListOut:
    query = db.query(OridStockPending)
    if stock_group:
        group = stock_group.strip()
        if group not in VALID_STOCK_GROUPS:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Invalid stock group",
            )
        query = query.filter(OridStockPending.stock_group == group)
    rows = query.order_by(OridStockPending.id.asc()).all()
    return OridStockPendingListOut(rows=[_to_out(row) for row in rows])


def create_pending(
    db: Session,
    payload: OridStockPendingCreate,
    *,
    created_by: Optional[int] = None,
) -> OridStockPendingOut:
    row = OridStockPending(
        stock_group=payload.stock_group,
        broker=payload.broker,
        po_date=payload.po_date,
        delivery_date=payload.delivery_date,
        qty=payload.qty,
        rate=payload.rate,
        status=payload.status,
        created_by=created_by,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _to_out(row)


def update_pending(
    db: Session,
    pending_id: int,
    payload: OridStockPendingUpdate,
) -> OridStockPendingOut:
    row = db.get(OridStockPending, pending_id)
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pending line not found",
        )

    data = payload.model_dump(exclude_unset=True)
    if "status" in data and data["status"] not in VALID_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Invalid status",
        )
    for key, value in data.items():
        setattr(row, key, value)

    db.commit()
    db.refresh(row)
    return _to_out(row)


def delete_pending(db: Session, pending_id: int) -> None:
    row = db.get(OridStockPending, pending_id)
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pending line not found",
        )
    db.delete(row)
    db.commit()
