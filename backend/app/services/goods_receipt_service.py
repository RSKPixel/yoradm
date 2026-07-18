from __future__ import annotations

from datetime import date
from math import ceil
from typing import Optional, Tuple

from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.goods_receipt import GoodsReceipt
from app.schemas.goods_receipt import GoodsReceiptCreate, GoodsReceiptListItem


def get_by_id(db: Session, receipt_id: int) -> Optional[GoodsReceipt]:
    return db.query(GoodsReceipt).filter(GoodsReceipt.id == receipt_id).first()


def list_goods_receipts(
    db: Session,
    *,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    vendor: Optional[str] = None,
    invoice_no: Optional[str] = None,
    page: int = 1,
    page_size: int = 50,
) -> Tuple[list[GoodsReceiptListItem], int]:
    query = db.query(GoodsReceipt)
    if date_from is not None:
        query = query.filter(GoodsReceipt.receipt_date >= date_from)
    if date_to is not None:
        query = query.filter(GoodsReceipt.receipt_date <= date_to)
    vendor_q = (vendor or "").strip()
    if vendor_q:
        query = query.filter(func.lower(GoodsReceipt.vendor).like(f"%{vendor_q.lower()}%"))
    invoice_q = (invoice_no or "").strip()
    if invoice_q:
        query = query.filter(func.lower(GoodsReceipt.invoice_no).like(f"%{invoice_q.lower()}%"))

    total = query.count()
    rows = (
        query.order_by(GoodsReceipt.receipt_date.desc(), GoodsReceipt.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    items = [
        GoodsReceiptListItem(
            id=row.id,
            receipt_date=row.receipt_date,
            vendor=row.vendor,
            stock_item=row.stock_item,
            qty=row.qty,
            weight=row.weight,
            invoice_no=row.invoice_no,
            invoice_date=row.invoice_date,
            unloaded_at=row.unloaded_at,
            vehicle_no=row.vehicle_no,
            created_at=row.created_at,
        )
        for row in rows
    ]
    return items, total


def list_page_meta(total: int, page: int, page_size: int) -> dict:
    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": ceil(total / page_size) if page_size else 0,
    }


def list_received_by(db: Session) -> list[str]:
    rows = (
        db.query(GoodsReceipt.received_by)
        .filter(
            GoodsReceipt.received_by.isnot(None),
            GoodsReceipt.received_by != "",
        )
        .distinct()
        .order_by(GoodsReceipt.received_by.asc())
        .all()
    )
    return [row[0].strip() for row in rows if row[0] and row[0].strip()]


def create_goods_receipt(
    db: Session,
    payload: GoodsReceiptCreate,
    *,
    created_by: Optional[int] = None,
) -> GoodsReceipt:
    receipt = GoodsReceipt(
        receipt_date=payload.receipt_date,
        vendor=payload.vendor,
        stock_item=payload.stock_item,
        qty=payload.qty,
        weight=payload.weight,
        invoice_no=payload.invoice_no,
        invoice_date=payload.invoice_date,
        invoice_value=payload.invoice_value,
        invoiced_weight=payload.invoiced_weight,
        tds_applicable=payload.tds_applicable,
        tds_value=payload.tds_value,
        unloaded_at=payload.unloaded_at,
        broker=payload.broker,
        received_by=payload.received_by,
        vehicle_no=payload.vehicle_no,
        place=payload.place,
        remarks=payload.remarks,
        created_by=created_by,
    )
    db.add(receipt)
    db.commit()
    db.refresh(receipt)
    return receipt


def update_goods_receipt(
    db: Session,
    receipt_id: int,
    payload: GoodsReceiptCreate,
) -> GoodsReceipt:
    receipt = get_by_id(db, receipt_id)
    if not receipt:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Goods receipt not found")

    receipt.receipt_date = payload.receipt_date
    receipt.vendor = payload.vendor
    receipt.stock_item = payload.stock_item
    receipt.qty = payload.qty
    receipt.weight = payload.weight
    receipt.invoice_no = payload.invoice_no
    receipt.invoice_date = payload.invoice_date
    receipt.invoice_value = payload.invoice_value
    receipt.invoiced_weight = payload.invoiced_weight
    receipt.tds_applicable = payload.tds_applicable
    receipt.tds_value = payload.tds_value
    receipt.unloaded_at = payload.unloaded_at
    receipt.broker = payload.broker
    receipt.received_by = payload.received_by
    receipt.vehicle_no = payload.vehicle_no
    receipt.place = payload.place
    receipt.remarks = payload.remarks
    db.commit()
    db.refresh(receipt)
    return receipt


def delete_goods_receipt(db: Session, receipt_id: int) -> None:
    receipt = get_by_id(db, receipt_id)
    if not receipt:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Goods receipt not found")
    db.delete(receipt)
    db.commit()
