from __future__ import annotations

from datetime import date
from math import ceil
from typing import Optional, Tuple

from fastapi import HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.models.delivery_challan import DeliveryChallan, DeliveryChallanDetail
from app.schemas.delivery_challan import DeliveryChallanCreate, DeliveryChallanListItem


def get_by_id(db: Session, challan_id: int) -> Optional[DeliveryChallan]:
    return (
        db.query(DeliveryChallan)
        .options(joinedload(DeliveryChallan.details))
        .filter(DeliveryChallan.id == challan_id)
        .first()
    )


def list_delivery_challans(
    db: Session,
    *,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    page: int = 1,
    page_size: int = 50,
) -> Tuple[list[DeliveryChallanListItem], int]:
    query = db.query(DeliveryChallan)
    if date_from is not None:
        query = query.filter(DeliveryChallan.challan_date >= date_from)
    if date_to is not None:
        query = query.filter(DeliveryChallan.challan_date <= date_to)

    total = query.count()
    rows = (
        query.options(joinedload(DeliveryChallan.details))
        .order_by(DeliveryChallan.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    items: list[DeliveryChallanListItem] = []
    for row in rows:
        invoice_nos: set[str] = set()
        total_qty = 0.0
        for detail in row.details:
            if detail.voucher_no:
                invoice_nos.add(detail.voucher_no)
            if detail.qty is not None:
                total_qty += float(detail.qty)
        items.append(
            DeliveryChallanListItem(
                id=row.id,
                challan_date=row.challan_date,
                vehicle_no=row.vehicle_no,
                driver_name=row.driver_name,
                batch_no=row.batch_no,
                invoice_count=len(invoice_nos),
                total_qty=total_qty,
                created_at=row.created_at,
            )
        )
    return items, total


def list_page_meta(total: int, page: int, page_size: int) -> dict:
    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": ceil(total / page_size) if page_size else 0,
    }


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
                packing=line.packing,
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
