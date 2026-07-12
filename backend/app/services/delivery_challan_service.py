from __future__ import annotations

from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.models.delivery_challan import DeliveryChallan, DeliveryChallanDetail
from app.schemas.delivery_challan import DeliveryChallanCreate


def get_by_id(db: Session, challan_id: int) -> Optional[DeliveryChallan]:
    return (
        db.query(DeliveryChallan)
        .options(joinedload(DeliveryChallan.details))
        .filter(DeliveryChallan.id == challan_id)
        .first()
    )


def list_used_voucher_nos(
    db: Session,
    *,
    exclude_challan_id: Optional[int] = None,
) -> list[str]:
    query = db.query(DeliveryChallanDetail.voucher_no).distinct()
    if exclude_challan_id is not None:
        query = query.filter(DeliveryChallanDetail.challan_id != exclude_challan_id)
    return [row[0] for row in query.all() if row[0]]


def _assert_vouchers_available(
    db: Session,
    voucher_nos: list[str],
    *,
    exclude_challan_id: Optional[int] = None,
) -> None:
    unique_nos = sorted({no.strip() for no in voucher_nos if no and no.strip()})
    if not unique_nos:
        return
    query = db.query(DeliveryChallanDetail.voucher_no).filter(
        DeliveryChallanDetail.voucher_no.in_(unique_nos)
    )
    if exclude_challan_id is not None:
        query = query.filter(DeliveryChallanDetail.challan_id != exclude_challan_id)
    used = sorted({row[0] for row in query.distinct().all() if row[0]})
    if used:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Invoice(s) already on a delivery challan: {', '.join(used)}",
        )


def _replace_details(db: Session, challan: DeliveryChallan, payload: DeliveryChallanCreate) -> None:
    challan.details.clear()
    db.flush()
    for index, line in enumerate(payload.lines, start=1):
        db.add(
            DeliveryChallanDetail(
                challan_id=challan.id,
                voucher_no=line.voucher_no,
                voucher_date=line.voucher_date,
                ledger_name=line.ledger_name,
                stock_item=line.stock_item,
                brand=line.brand,
                qty=line.qty,
                delivery_location=line.delivery_location,
                line_no=index,
            )
        )


def create_delivery_challan(
    db: Session,
    payload: DeliveryChallanCreate,
    *,
    created_by: Optional[int] = None,
) -> DeliveryChallan:
    _assert_vouchers_available(db, [line.voucher_no for line in payload.lines])

    challan = DeliveryChallan(
        challan_date=payload.challan_date,
        vehicle_no=payload.vehicle_no,
        driver_name=payload.driver_name,
        batch_no=payload.batch_no,
        created_by=created_by,
    )
    db.add(challan)
    db.flush()
    _replace_details(db, challan, payload)
    db.commit()
    return get_by_id(db, challan.id)


def update_delivery_challan(
    db: Session,
    challan_id: int,
    payload: DeliveryChallanCreate,
) -> DeliveryChallan:
    challan = get_by_id(db, challan_id)
    if not challan:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Delivery challan not found")

    _assert_vouchers_available(
        db,
        [line.voucher_no for line in payload.lines],
        exclude_challan_id=challan_id,
    )

    challan.challan_date = payload.challan_date
    challan.vehicle_no = payload.vehicle_no
    challan.driver_name = payload.driver_name
    challan.batch_no = payload.batch_no
    _replace_details(db, challan, payload)
    db.commit()
    return get_by_id(db, challan.id)


def delete_delivery_challan(db: Session, challan_id: int) -> None:
    challan = get_by_id(db, challan_id)
    if not challan:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Delivery challan not found")
    db.delete(challan)
    db.commit()
