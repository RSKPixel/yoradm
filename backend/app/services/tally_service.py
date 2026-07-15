from collections import defaultdict
from datetime import date, datetime
from math import ceil
from typing import Any, Dict, List, Optional, Sequence, Tuple, Type

from sqlalchemy import func, or_
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
from app.schemas.tally import (
    ReceivableAgeingBuckets,
    ReceivableAnalysisOut,
    ReceivableInvoiceAgeingOut,
    ReceivablePartyAgeingOut,
    ReceivableRepresentativeOut,
    SaleInvoiceOptionOut,
)

# Sentinel query value for invoices with blank / null representative.
RECEIVABLE_REP_BLANK = "__blank__"

AGE_BUCKET_0_30 = "0-30"
AGE_BUCKET_31_60 = "31-60"
AGE_BUCKET_61_90 = "61-90"
AGE_BUCKET_91_120 = "91-120"
AGE_BUCKET_ABOVE_120 = "Above 120"
AGE_BUCKET_UNDATED = "Undated"


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


def list_receivable_representatives(db: Session) -> List[ReceivableRepresentativeOut]:
    rows = (
        db.query(
            TallyReceivable.representative,
            func.count(TallyReceivable.id).label("invoice_count"),
            func.coalesce(func.sum(TallyReceivable.amount), 0.0).label("total_amount"),
        )
        .group_by(TallyReceivable.representative)
        .order_by(func.coalesce(func.sum(TallyReceivable.amount), 0.0).desc())
        .all()
    )
    items: List[ReceivableRepresentativeOut] = []
    for row in rows:
        raw = (row.representative or "").strip()
        items.append(
            ReceivableRepresentativeOut(
                name=raw if raw else RECEIVABLE_REP_BLANK,
                invoice_count=int(row.invoice_count or 0),
                total_amount=float(row.total_amount or 0.0),
            )
        )
    return items


def _age_bucket(days: Optional[int]) -> str:
    if days is None:
        return AGE_BUCKET_UNDATED
    if days <= 30:
        return AGE_BUCKET_0_30
    if days <= 60:
        return AGE_BUCKET_31_60
    if days <= 90:
        return AGE_BUCKET_61_90
    if days <= 120:
        return AGE_BUCKET_91_120
    return AGE_BUCKET_ABOVE_120


def _empty_buckets() -> Dict[str, float]:
    return {
        "bucket_0_30": 0.0,
        "bucket_31_60": 0.0,
        "bucket_61_90": 0.0,
        "bucket_91_120": 0.0,
        "bucket_above_120": 0.0,
        "bucket_undated": 0.0,
        "total": 0.0,
        "invoice_count": 0,
    }


def _add_amount(buckets: Dict[str, Any], bucket: str, amount: float) -> None:
    field = {
        AGE_BUCKET_0_30: "bucket_0_30",
        AGE_BUCKET_31_60: "bucket_31_60",
        AGE_BUCKET_61_90: "bucket_61_90",
        AGE_BUCKET_91_120: "bucket_91_120",
        AGE_BUCKET_ABOVE_120: "bucket_above_120",
        AGE_BUCKET_UNDATED: "bucket_undated",
    }[bucket]
    buckets[field] = float(buckets[field]) + amount
    buckets["total"] = float(buckets["total"]) + amount
    buckets["invoice_count"] = int(buckets["invoice_count"]) + 1


def _receivable_query(db: Session, representative: Optional[str] = None):
    query = db.query(TallyReceivable)
    if representative is None:
        return query
    if representative == RECEIVABLE_REP_BLANK:
        return query.filter(
            or_(
                TallyReceivable.representative.is_(None),
                TallyReceivable.representative == "",
            )
        )
    return query.filter(TallyReceivable.representative == representative)


def receivables_analysis(
    db: Session,
    *,
    as_of: Optional[date] = None,
    representative: Optional[str] = None,
) -> ReceivableAnalysisOut:
    as_of_date = as_of or date.today()
    rows = (
        _receivable_query(db, representative)
        .order_by(
            TallyReceivable.ledger_name.asc(),
            TallyReceivable.invoice_date.asc(),
            TallyReceivable.id.asc(),
        )
        .all()
    )

    totals = _empty_buckets()
    party_map: Dict[Tuple[str, Optional[str]], Dict[str, Any]] = defaultdict(_empty_buckets)
    invoices: List[ReceivableInvoiceAgeingOut] = []

    for row in rows:
        amount = float(row.amount or 0.0)
        inv_date: Optional[date] = None
        if isinstance(row.invoice_date, datetime):
            inv_date = row.invoice_date.date()
        elif isinstance(row.invoice_date, date):
            inv_date = row.invoice_date

        days: Optional[int] = None
        if inv_date is not None:
            days = max((as_of_date - inv_date).days, 0)
        bucket = _age_bucket(days)
        _add_amount(totals, bucket, amount)

        ledger = (row.ledger_name or "").strip() or "(No party)"
        rep_raw = (row.representative or "").strip() or None
        party_key = (ledger, rep_raw)
        party_buckets = party_map[party_key]
        if "ledger_name" not in party_buckets:
            party_buckets["ledger_name"] = ledger
            party_buckets["representative"] = rep_raw
        _add_amount(party_buckets, bucket, amount)

        invoices.append(
            ReceivableInvoiceAgeingOut(
                id=row.id,
                invoice_no=row.invoice_no,
                invoice_date=row.invoice_date,
                ledger_name=row.ledger_name,
                representative=row.representative,
                amount=amount,
                days=days,
                age_bucket=bucket,
            )
        )

    parties = [
        ReceivablePartyAgeingOut(
            ledger_name=str(data["ledger_name"]),
            representative=data.get("representative"),
            bucket_0_30=float(data["bucket_0_30"]),
            bucket_31_60=float(data["bucket_31_60"]),
            bucket_61_90=float(data["bucket_61_90"]),
            bucket_91_120=float(data["bucket_91_120"]),
            bucket_above_120=float(data["bucket_above_120"]),
            bucket_undated=float(data["bucket_undated"]),
            total=float(data["total"]),
            invoice_count=int(data["invoice_count"]),
        )
        for data in party_map.values()
    ]
    parties.sort(key=lambda p: (-p.total, p.ledger_name.lower()))

    return ReceivableAnalysisOut(
        as_of=as_of_date.isoformat(),
        representative=representative,
        totals=ReceivableAgeingBuckets(
            bucket_0_30=float(totals["bucket_0_30"]),
            bucket_31_60=float(totals["bucket_31_60"]),
            bucket_61_90=float(totals["bucket_61_90"]),
            bucket_91_120=float(totals["bucket_91_120"]),
            bucket_above_120=float(totals["bucket_above_120"]),
            bucket_undated=float(totals["bucket_undated"]),
            total=float(totals["total"]),
            invoice_count=int(totals["invoice_count"]),
        ),
        parties=parties,
        invoices=invoices,
    )
