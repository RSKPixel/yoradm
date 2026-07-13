from __future__ import annotations

from datetime import date
from math import ceil
from typing import Optional, Tuple

from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.models.delivery_challan import DeliveryChallan, DeliveryChallanDetail
from app.models.tally import TallyInventoryMaster, TallySale
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
        .order_by(DeliveryChallan.challan_date.desc(), DeliveryChallan.id.desc())
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


def _stock_items_for_group(db: Session, stock_group: str) -> list:
    group = (stock_group or "").strip()
    if not group:
        return []
    return [
        row[0]
        for row in (
            db.query(TallyInventoryMaster.stock_item)
            .filter(
                func.lower(TallyInventoryMaster.stock_group) == group.lower(),
                TallyInventoryMaster.stock_item.isnot(None),
                TallyInventoryMaster.stock_item != "",
            )
            .distinct()
            .all()
        )
    ]


def sum_qty_by_batch(
    db: Session,
    *,
    batch_no: str,
    stock_group: str = "Orid Dhall",
) -> Tuple[float, float]:
    """Sum 50kg-bag qty and net line value for DC lines on batch + stock_group.

    Bags per line: (qty × packing) / 50. Missing packing is treated as 50.
    Value: sum(amount) + sum(discount). Discount is stored negative from sales.
    Returns (total_qty_50kg_bags, total_amount).
    """
    batch = (batch_no or "").strip()
    group = (stock_group or "").strip()
    if not batch or not group:
        return 0.0, 0.0

    stock_items = _stock_items_for_group(db, group)
    if not stock_items:
        return 0.0, 0.0

    detail_filter = (
        func.trim(DeliveryChallan.batch_no) == batch,
        DeliveryChallanDetail.stock_item.in_(stock_items),
    )

    packing_kg = func.coalesce(DeliveryChallanDetail.packing, 50.0)
    bag_expr = (
        func.coalesce(DeliveryChallanDetail.qty, 0.0) * packing_kg
    ) / 50.0
    net_amount_expr = func.coalesce(DeliveryChallanDetail.amount, 0.0) + func.coalesce(
        DeliveryChallanDetail.discount, 0.0
    )

    row = (
        db.query(
            func.coalesce(func.sum(bag_expr), 0.0),
            func.coalesce(func.sum(net_amount_expr), 0.0),
        )
        .join(DeliveryChallan, DeliveryChallanDetail.challan_id == DeliveryChallan.id)
        .filter(*detail_filter)
        .one()
    )

    return float(row[0] or 0.0), float(row[1] or 0.0)


def list_qty_by_batch_date(
    db: Session,
    *,
    batch_no: str,
    stock_group: str = "Orid Dhall",
) -> list:
    """Per challan_date: sum of 50kg-bag qty for batch + stock_group."""
    batch = (batch_no or "").strip()
    group = (stock_group or "").strip()
    if not batch or not group:
        return []

    stock_items = _stock_items_for_group(db, group)
    if not stock_items:
        return []

    packing_kg = func.coalesce(DeliveryChallanDetail.packing, 50.0)
    bag_expr = (
        func.coalesce(DeliveryChallanDetail.qty, 0.0) * packing_kg
    ) / 50.0

    rows = (
        db.query(
            DeliveryChallan.challan_date,
            func.coalesce(func.sum(bag_expr), 0.0),
        )
        .join(DeliveryChallanDetail, DeliveryChallanDetail.challan_id == DeliveryChallan.id)
        .filter(
            func.trim(DeliveryChallan.batch_no) == batch,
            DeliveryChallanDetail.stock_item.in_(stock_items),
        )
        .group_by(DeliveryChallan.challan_date)
        .order_by(DeliveryChallan.challan_date.asc())
        .all()
    )
    return [
        {"challan_date": row[0], "total_qty": float(row[1] or 0.0)}
        for row in rows
    ]


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


def _sale_money_for_line(db: Session, line) -> Tuple[Optional[float], Optional[float]]:
    """Resolve (amount, discount) from payload or matching tally sale row."""
    amount = float(line.amount) if line.amount is not None else None
    discount = float(line.discount) if getattr(line, "discount", None) is not None else None
    if amount is not None and discount is not None:
        return amount, discount
    if not line.voucher_no or not line.stock_item:
        return amount, discount

    query = db.query(TallySale.amount, TallySale.discount).filter(
        TallySale.voucher_no == line.voucher_no,
        TallySale.stock_item == line.stock_item,
    )
    if line.packing is not None:
        query = query.filter(TallySale.packing == line.packing)
    if line.qty is not None:
        query = query.filter(TallySale.qty == line.qty)
    row = query.order_by(TallySale.id.desc()).first()
    if row is None:
        return amount, discount
    if amount is None and row[0] is not None:
        amount = float(row[0])
    if discount is None and row[1] is not None:
        discount = float(row[1])
    return amount, discount


def _replace_details(db: Session, challan: DeliveryChallan, payload: DeliveryChallanCreate) -> None:
    challan.details.clear()
    db.flush()
    for index, line in enumerate(payload.lines, start=1):
        amount, discount = _sale_money_for_line(db, line)
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
                amount=amount,
                discount=discount,
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
