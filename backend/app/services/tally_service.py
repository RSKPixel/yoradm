from math import ceil
from typing import Any, List, Optional, Sequence, Tuple, Type

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.tally import (
    TallyAccountMaster,
    TallyCostCentre,
    TallyInventoryMaster,
    TallyPurchase,
    TallyReceivable,
    TallySale,
    TallyStockSummary,
)
from app.schemas import DashboardStats
from app.schemas.tally import SaleInvoiceOptionOut


def paginate(db: Session, model: Type[Any], page: int, page_size: int) -> Tuple[Sequence[Any], int]:
    query = db.query(model).order_by(model.id.desc())
    total = query.count()
    items = query.offset((page - 1) * page_size).limit(page_size).all()
    return items, total


def page_meta(total: int, page: int, page_size: int) -> dict:
    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": ceil(total / page_size) if page_size else 0,
    }


def dashboard_stats(db: Session) -> DashboardStats:
    return DashboardStats(
        accounts=db.query(TallyAccountMaster).count(),
        inventory_items=db.query(TallyInventoryMaster).count(),
        sales_rows=db.query(TallySale).count(),
        purchase_rows=db.query(TallyPurchase).count(),
        receivables=db.query(TallyReceivable).count(),
        stock_movements=db.query(TallyStockSummary).count(),
    )


def list_sale_invoices(db: Session) -> List[SaleInvoiceOptionOut]:
    rows = (
        db.query(
            TallySale.voucher_no,
            func.min(TallySale.voucher_date).label("voucher_date"),
            func.min(TallySale.ledger_name).label("ledger_name"),
        )
        .filter(TallySale.voucher_no.isnot(None), TallySale.voucher_no != "")
        .group_by(TallySale.voucher_no)
        .order_by(func.min(TallySale.voucher_date).desc(), TallySale.voucher_no.desc())
        .all()
    )
    return [
        SaleInvoiceOptionOut(
            voucher_no=row.voucher_no,
            voucher_date=row.voucher_date,
            ledger_name=row.ledger_name,
        )
        for row in rows
        if row.voucher_no
    ]


def list_sale_invoice_lines(db: Session, voucher_no: str) -> Sequence[TallySale]:
    return (
        db.query(TallySale)
        .filter(TallySale.voucher_no == voucher_no)
        .order_by(TallySale.item_no.asc(), TallySale.id.asc())
        .all()
    )


def list_locations(db: Session, parent: str = "Locations") -> Sequence[TallyCostCentre]:
    return (
        db.query(TallyCostCentre)
        .filter(
            TallyCostCentre.parent == parent,
            TallyCostCentre.name.isnot(None),
            TallyCostCentre.name != "",
        )
        .order_by(TallyCostCentre.name.asc())
        .all()
    )


def list_purchase_lines(
    db: Session,
    *,
    stock_item: Optional[str] = None,
    stock_group: Optional[str] = None,
) -> Sequence[TallyPurchase]:
    """Purchase lines by stock_item name, or by inventorymaster stock_group."""
    item = (stock_item or "").strip()
    group = (stock_group or "").strip()
    if not item and not group:
        return []

    if group:
        stock_items = [
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
        if not stock_items:
            return []
        return (
            db.query(TallyPurchase)
            .filter(TallyPurchase.stock_item.in_(stock_items))
            .order_by(TallyPurchase.voucher_date.desc(), TallyPurchase.id.desc())
            .all()
        )

    return (
        db.query(TallyPurchase)
        .filter(
            TallyPurchase.stock_item.isnot(None),
            func.lower(TallyPurchase.stock_item) == item.lower(),
        )
        .order_by(TallyPurchase.voucher_date.desc(), TallyPurchase.id.desc())
        .all()
    )
