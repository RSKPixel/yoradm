from collections import defaultdict
from datetime import date, datetime
from math import ceil
from typing import Any, Dict, List, Optional, Sequence, Tuple, Type

from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.models.tally import (
    TallyAccountMaster,
    TallyCostCentre,
    TallyDaybook2,
    TallyInventoryMaster,
    TallyPurchase,
    TallyReceivable,
    TallySale,
    TallyStockSummary,
)
from app.schemas import DashboardStats
from app.schemas.tally import (
    CollectionAgeBucketOut,
    CollectionPerformanceOut,
    DaybookTradeOut,
    DaybookTradePointOut,
    ReceivableAgeingBuckets,
    ReceivableAnalysisOut,
    ReceivableInvoiceAgeingOut,
    ReceivablePartyAgeingOut,
    ReceivableRepresentativeOut,
    SaleInvoiceOptionOut,
)

SALES_VTYPE = "SIVENDHI BILLING"
PURCHASE_VTYPE = "Purchase"
RECEIPT_VTYPE = "Receipt"
PAYMENT_VTYPE = "Payment"
PARTY_BILL_TYPE_NEW = "New Ref"
PARTY_BILL_TYPE_AGST = "Agst Ref"

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


def list_sale_representatives(db: Session) -> List[ReceivableRepresentativeOut]:
    """Distinct sales brokers (used as representatives for collections)."""
    rows = (
        db.query(
            TallySale.broker,
            func.count(func.distinct(TallySale.voucher_no)).label("invoice_count"),
            func.coalesce(func.sum(TallySale.amount), 0.0).label("total_amount"),
        )
        .group_by(TallySale.broker)
        .order_by(func.count(func.distinct(TallySale.voucher_no)).desc())
        .all()
    )
    items: List[ReceivableRepresentativeOut] = []
    for row in rows:
        raw = (row.broker or "").strip()
        if raw.lower() == "no representative":
            raw = ""
        items.append(
            ReceivableRepresentativeOut(
                name=raw if raw else RECEIVABLE_REP_BLANK,
                invoice_count=int(row.invoice_count or 0),
                total_amount=float(row.total_amount or 0.0),
            )
        )
    return items


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


def _month_start(value: date) -> date:
    return date(value.year, value.month, 1)


def _add_months(value: date, months: int) -> date:
    year = value.year + (value.month - 1 + months) // 12
    month = (value.month - 1 + months) % 12 + 1
    return date(year, month, 1)


def _daybook_series_by_month(
    db: Session,
    *,
    vtype: str,
    bill_type: str,
    date_from: date,
    date_to: date,
) -> Dict[date, Tuple[float, int]]:
    """Party bill-line totals by calendar month for a voucher type."""
    month_col = func.date_format(TallyDaybook2.vdt, "%Y-%m-01")
    start = datetime.combine(date_from, datetime.min.time())
    end = datetime.combine(date_to, datetime.max.time())
    rows = (
        db.query(
            month_col.label("month_start"),
            func.coalesce(func.sum(TallyDaybook2.ledger_amount), 0.0),
            func.count(func.distinct(TallyDaybook2.vno)),
        )
        .filter(
            TallyDaybook2.vtype == vtype,
            TallyDaybook2.bill_type == bill_type,
            TallyDaybook2.vdt.isnot(None),
            TallyDaybook2.vdt >= start,
            TallyDaybook2.vdt <= end,
        )
        .group_by(month_col)
        .all()
    )
    out: Dict[date, Tuple[float, int]] = {}
    for month_value, amount, voucher_count in rows:
        if month_value is None:
            continue
        if isinstance(month_value, datetime):
            month_key = month_value.date()
        elif isinstance(month_value, date):
            month_key = month_value
        else:
            text = str(month_value)[:10]
            try:
                month_key = datetime.strptime(text, "%Y-%m-%d").date()
            except ValueError:
                continue
        out[_month_start(month_key)] = (float(amount or 0.0), int(voucher_count or 0))
    return out


def sales_purchase_trend(
    db: Session,
    *,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
) -> DaybookTradeOut:
    """Monthly trade + cash from daybook2.

    Sales/Purchase = New Ref on SIVENDHI BILLING / Purchase.
    Receipt/Payment = Agst Ref on Receipt / Payment.
    """
    end = date_to or date.today()
    start = date_from or _month_start(_add_months(end, -5))
    if start > end:
        start, end = end, start

    sales_by_month = _daybook_series_by_month(
        db,
        vtype=SALES_VTYPE,
        bill_type=PARTY_BILL_TYPE_NEW,
        date_from=start,
        date_to=end,
    )
    purchase_by_month = _daybook_series_by_month(
        db,
        vtype=PURCHASE_VTYPE,
        bill_type=PARTY_BILL_TYPE_NEW,
        date_from=start,
        date_to=end,
    )
    receipt_by_month = _daybook_series_by_month(
        db,
        vtype=RECEIPT_VTYPE,
        bill_type=PARTY_BILL_TYPE_AGST,
        date_from=start,
        date_to=end,
    )
    payment_by_month = _daybook_series_by_month(
        db,
        vtype=PAYMENT_VTYPE,
        bill_type=PARTY_BILL_TYPE_AGST,
        date_from=start,
        date_to=end,
    )

    points: List[DaybookTradePointOut] = []
    sales_total = 0.0
    purchase_total = 0.0
    receipt_total = 0.0
    payment_total = 0.0
    sales_vouchers = 0
    purchase_vouchers = 0
    receipt_vouchers = 0
    payment_vouchers = 0

    cursor = _month_start(start)
    last_month = _month_start(end)
    while cursor <= last_month:
        s_amt, s_cnt = sales_by_month.get(cursor, (0.0, 0))
        p_amt, p_cnt = purchase_by_month.get(cursor, (0.0, 0))
        r_amt, r_cnt = receipt_by_month.get(cursor, (0.0, 0))
        pay_amt, pay_cnt = payment_by_month.get(cursor, (0.0, 0))
        sales_total += s_amt
        purchase_total += p_amt
        receipt_total += r_amt
        payment_total += pay_amt
        sales_vouchers += s_cnt
        purchase_vouchers += p_cnt
        receipt_vouchers += r_cnt
        payment_vouchers += pay_cnt
        points.append(
            DaybookTradePointOut(
                date=cursor.isoformat(),
                label=cursor.strftime("%b %y"),
                sales=s_amt,
                purchase=p_amt,
                receipt=r_amt,
                payment=pay_amt,
                sales_vouchers=s_cnt,
                purchase_vouchers=p_cnt,
                receipt_vouchers=r_cnt,
                payment_vouchers=pay_cnt,
            )
        )
        cursor = _add_months(cursor, 1)

    coverage = (sales_total / purchase_total * 100.0) if purchase_total else None
    collection = (receipt_total / sales_total * 100.0) if sales_total else None

    return DaybookTradeOut(
        date_from=start.isoformat(),
        date_to=end.isoformat(),
        sales_total=sales_total,
        purchase_total=purchase_total,
        receipt_total=receipt_total,
        payment_total=payment_total,
        net_trade=sales_total - purchase_total,
        net_cash=receipt_total - payment_total,
        coverage_pct=coverage,
        collection_pct=collection,
        sales_vouchers=sales_vouchers,
        purchase_vouchers=purchase_vouchers,
        receipt_vouchers=receipt_vouchers,
        payment_vouchers=payment_vouchers,
        points=points,
    )


COLLECTION_BUCKETS = (
    ("0-30", "0-30", 0, 30),
    ("31-60", "31-60", 31, 60),
    ("61-90", "61-90", 61, 90),
    ("gt-90", ">90", 91, None),
)


def _collection_bucket_key(days: int) -> str:
    if days <= 30:
        return "0-30"
    if days <= 60:
        return "31-60"
    if days <= 90:
        return "61-90"
    return "gt-90"


def collection_performance(
    db: Session,
    *,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    representative: Optional[str] = None,
) -> CollectionPerformanceOut:
    """Age Receipt Agst Ref collections by linked sales invoice date.

    Days = receipt date − invoice date (from tallydata_sales via BILL_NO).
    Representative filter uses sales.broker on the linked invoice.
    """
    end = date_to or date.today()
    start = date_from or _month_start(_add_months(end, -5))
    if start > end:
        start, end = end, start

    start_dt = datetime.combine(start, datetime.min.time())
    end_dt = datetime.combine(end, datetime.max.time())

    invoice_meta = (
        db.query(
            TallySale.voucher_no.label("voucher_no"),
            func.min(TallySale.voucher_date).label("invoice_date"),
            func.min(TallySale.broker).label("broker"),
        )
        .filter(
            TallySale.voucher_no.isnot(None),
            TallySale.voucher_no != "",
            TallySale.voucher_date.isnot(None),
        )
        .group_by(TallySale.voucher_no)
        .subquery()
    )

    query = (
        db.query(
            TallyDaybook2.ledger_amount,
            TallyDaybook2.vdt,
            invoice_meta.c.invoice_date,
            invoice_meta.c.broker,
        )
        .outerjoin(
            invoice_meta,
            invoice_meta.c.voucher_no == TallyDaybook2.bill_no,
        )
        .filter(
            TallyDaybook2.vtype == RECEIPT_VTYPE,
            TallyDaybook2.bill_type == PARTY_BILL_TYPE_AGST,
            TallyDaybook2.vdt.isnot(None),
            TallyDaybook2.vdt >= start_dt,
            TallyDaybook2.vdt <= end_dt,
        )
    )

    if representative == RECEIVABLE_REP_BLANK:
        query = query.filter(
            or_(
                invoice_meta.c.broker.is_(None),
                invoice_meta.c.broker == "",
                func.lower(invoice_meta.c.broker) == "no representative",
            )
        )
    elif representative:
        query = query.filter(invoice_meta.c.broker == representative)

    rows = query.all()

    bucket_amounts = {key: 0.0 for key, _, _, _ in COLLECTION_BUCKETS}
    bucket_counts = {key: 0 for key, _, _, _ in COLLECTION_BUCKETS}
    matched_amount = 0.0
    unmatched_amount = 0.0
    matched_count = 0
    unmatched_count = 0
    weighted_days = 0.0

    for amount_raw, receipt_dt, invoice_dt, _broker in rows:
        amount = float(amount_raw or 0.0)
        if receipt_dt is None or invoice_dt is None:
            unmatched_amount += amount
            unmatched_count += 1
            continue

        receipt_day = receipt_dt.date() if isinstance(receipt_dt, datetime) else receipt_dt
        invoice_day = invoice_dt.date() if isinstance(invoice_dt, datetime) else invoice_dt
        days = (receipt_day - invoice_day).days
        if days < 0:
            days = 0

        key = _collection_bucket_key(days)
        bucket_amounts[key] += amount
        bucket_counts[key] += 1
        matched_amount += amount
        matched_count += 1
        weighted_days += days * amount

    total_amount = matched_amount + unmatched_amount
    denom = matched_amount if matched_amount else 0.0
    buckets = [
        CollectionAgeBucketOut(
            key=key,
            label=label,
            amount=bucket_amounts[key],
            count=bucket_counts[key],
            pct=(bucket_amounts[key] / denom * 100.0) if denom else 0.0,
        )
        for key, label, _, _ in COLLECTION_BUCKETS
    ]
    avg_days = (weighted_days / matched_amount) if matched_amount else None

    return CollectionPerformanceOut(
        date_from=start.isoformat(),
        date_to=end.isoformat(),
        total_amount=total_amount,
        matched_amount=matched_amount,
        unmatched_amount=unmatched_amount,
        matched_count=matched_count,
        unmatched_count=unmatched_count,
        avg_days=avg_days,
        buckets=buckets,
    )
