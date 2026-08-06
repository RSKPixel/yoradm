from __future__ import annotations

from calendar import monthrange
from datetime import date, datetime
from typing import Dict, List, Optional, Sequence, Tuple, Type

from sqlalchemy import and_, func
from sqlalchemy.orm import Session

from app.models.brokerage import Brokerage
from app.models.brokerage_rate import BrokerageRate
from app.models.brokerage_setting import BrokerageSetting
from app.models.goods_receipt import GoodsReceipt
from app.models.tally import TallyPurchase, TallyReceivable, TallySale
from app.schemas.brokerage import (
    BrokerageBrokersOut,
    BrokerageBuyerRowOut,
    BrokerageBuyersOut,
    BrokerageLineSaveIn,
    BrokerageRatesSaveIn,
    BrokerageRowOut,
    BrokerageSaveIn,
    BrokerageSectionOut,
    BrokerageWorkingsOut,
)

DEFAULT_PACKING_KG = 50.0
SIDE_SALE = "sale"
SIDE_PURCHASE = "purchase"
BLANK_BROKER_LABELS = {"", "no representative"}


def _month_date_range(*, fy_start: int, month: int) -> Tuple[date, date]:
    fy = int(fy_start)
    month_num = int(month)
    if month_num < 1 or month_num > 12:
        raise ValueError("month must be 1–12")
    year = fy if month_num >= 4 else fy + 1
    last_day = monthrange(year, month_num)[1]
    return date(year, month_num, 1), date(year, month_num, last_day)


def _normalize_broker(value: Optional[str]) -> str:
    return (value or "").strip()


def _is_blank_broker(value: Optional[str]) -> bool:
    return _normalize_broker(value).casefold() in BLANK_BROKER_LABELS


def _broker_filter(column, broker: str):
    name = _normalize_broker(broker)
    return column == name


def _round_money(value: float) -> float:
    return round(float(value or 0.0), 4)


def _receivable_broker_subquery(db: Session, *, start_dt: datetime, end_dt: datetime):
    """Map sale invoice + party → representative when sales.broker is blank."""
    return (
        db.query(
            TallyReceivable.invoice_no.label("invoice_no"),
            TallyReceivable.ledger_name.label("ledger_name"),
            func.min(TallyReceivable.representative).label("representative"),
        )
        .filter(
            TallyReceivable.invoice_date.isnot(None),
            TallyReceivable.invoice_date >= start_dt,
            TallyReceivable.invoice_date <= end_dt,
            TallyReceivable.representative.isnot(None),
            TallyReceivable.representative != "",
        )
        .group_by(TallyReceivable.invoice_no, TallyReceivable.ledger_name)
        .subquery()
    )


def _goods_receipt_broker_subquery(
    db: Session, *, date_from: date, date_to: date
):
    """Map purchase vendor + stock item + date → goods-receipt broker."""
    return (
        db.query(
            GoodsReceipt.vendor.label("vendor"),
            GoodsReceipt.stock_item.label("stock_item"),
            GoodsReceipt.receipt_date.label("receipt_date"),
            func.min(GoodsReceipt.broker).label("broker"),
        )
        .filter(
            GoodsReceipt.receipt_date >= date_from,
            GoodsReceipt.receipt_date <= date_to,
            GoodsReceipt.broker.isnot(None),
            GoodsReceipt.broker != "",
        )
        .group_by(
            GoodsReceipt.vendor,
            GoodsReceipt.stock_item,
            GoodsReceipt.receipt_date,
        )
        .subquery()
    )


def _sale_broker_expr(recv_subq):
    return func.coalesce(TallySale.broker, recv_subq.c.representative)


def _purchase_broker_expr(gr_subq):
    return func.coalesce(TallyPurchase.broker, gr_subq.c.broker)


def _aggregate_sales_by_stock_item(
    db: Session,
    *,
    date_from: date,
    date_to: date,
    broker: str,
) -> List[Tuple[str, float, float]]:
    start_dt = datetime.combine(date_from, datetime.min.time())
    end_dt = datetime.combine(date_to, datetime.max.time())
    recv = _receivable_broker_subquery(db, start_dt=start_dt, end_dt=end_dt)
    effective_broker = _sale_broker_expr(recv)
    packing_kg = func.coalesce(TallySale.packing, DEFAULT_PACKING_KG)
    qty = func.coalesce(TallySale.qty, 0.0)
    quintals = qty * packing_kg / 100.0

    rows = (
        db.query(
            TallySale.stock_item,
            func.coalesce(func.sum(qty), 0.0).label("qty"),
            func.coalesce(func.sum(quintals), 0.0).label("quintals"),
        )
        .outerjoin(
            recv,
            and_(
                recv.c.invoice_no == TallySale.voucher_no,
                recv.c.ledger_name == TallySale.ledger_name,
            ),
        )
        .filter(
            TallySale.voucher_date.isnot(None),
            TallySale.voucher_date >= start_dt,
            TallySale.voucher_date <= end_dt,
            _broker_filter(effective_broker, broker),
            TallySale.stock_item.isnot(None),
            TallySale.stock_item != "",
        )
        .group_by(TallySale.stock_item)
        .order_by(TallySale.stock_item.asc())
        .all()
    )
    return [
        (
            (stock_item or "").strip(),
            float(qty_sum or 0.0),
            float(quintal_sum or 0.0),
        )
        for stock_item, qty_sum, quintal_sum in rows
        if (stock_item or "").strip()
    ]


def _aggregate_purchases_by_stock_item(
    db: Session,
    *,
    date_from: date,
    date_to: date,
    broker: str,
) -> List[Tuple[str, float, float]]:
    start_dt = datetime.combine(date_from, datetime.min.time())
    end_dt = datetime.combine(date_to, datetime.max.time())
    gr = _goods_receipt_broker_subquery(db, date_from=date_from, date_to=date_to)
    effective_broker = _purchase_broker_expr(gr)
    packing_kg = func.coalesce(TallyPurchase.packing, DEFAULT_PACKING_KG)
    qty = func.coalesce(TallyPurchase.qty, 0.0)
    quintals = qty * packing_kg / 100.0

    rows = (
        db.query(
            TallyPurchase.stock_item,
            func.coalesce(func.sum(qty), 0.0).label("qty"),
            func.coalesce(func.sum(quintals), 0.0).label("quintals"),
        )
        .outerjoin(
            gr,
            and_(
                gr.c.vendor == TallyPurchase.ledger_name,
                gr.c.stock_item == TallyPurchase.stock_item,
                gr.c.receipt_date == func.date(TallyPurchase.voucher_date),
            ),
        )
        .filter(
            TallyPurchase.voucher_date.isnot(None),
            TallyPurchase.voucher_date >= start_dt,
            TallyPurchase.voucher_date <= end_dt,
            _broker_filter(effective_broker, broker),
            TallyPurchase.stock_item.isnot(None),
            TallyPurchase.stock_item != "",
        )
        .group_by(TallyPurchase.stock_item)
        .order_by(TallyPurchase.stock_item.asc())
        .all()
    )
    return [
        (
            (stock_item or "").strip(),
            float(qty_sum or 0.0),
            float(quintal_sum or 0.0),
        )
        for stock_item, qty_sum, quintal_sum in rows
        if (stock_item or "").strip()
    ]


def _aggregate_by_stock_item(
    db: Session,
    *,
    model: Type[TallySale] | Type[TallyPurchase],
    date_from: date,
    date_to: date,
    broker: str,
) -> List[Tuple[str, float, float]]:
    if model is TallySale:
        return _aggregate_sales_by_stock_item(
            db, date_from=date_from, date_to=date_to, broker=broker
        )
    return _aggregate_purchases_by_stock_item(
        db, date_from=date_from, date_to=date_to, broker=broker
    )


def _aggregate_sales_by_buyer(
    db: Session,
    *,
    date_from: date,
    date_to: date,
    broker: str,
) -> List[Tuple[str, float, float]]:
    start_dt = datetime.combine(date_from, datetime.min.time())
    end_dt = datetime.combine(date_to, datetime.max.time())
    recv = _receivable_broker_subquery(db, start_dt=start_dt, end_dt=end_dt)
    effective_broker = _sale_broker_expr(recv)
    packing_kg = func.coalesce(TallySale.packing, DEFAULT_PACKING_KG)
    qty = func.coalesce(TallySale.qty, 0.0)
    quintals = qty * packing_kg / 100.0

    rows = (
        db.query(
            TallySale.ledger_name,
            func.coalesce(func.sum(qty), 0.0).label("qty"),
            func.coalesce(func.sum(quintals), 0.0).label("quintals"),
        )
        .outerjoin(
            recv,
            and_(
                recv.c.invoice_no == TallySale.voucher_no,
                recv.c.ledger_name == TallySale.ledger_name,
            ),
        )
        .filter(
            TallySale.voucher_date.isnot(None),
            TallySale.voucher_date >= start_dt,
            TallySale.voucher_date <= end_dt,
            _broker_filter(effective_broker, broker),
            TallySale.ledger_name.isnot(None),
            TallySale.ledger_name != "",
        )
        .group_by(TallySale.ledger_name)
        .all()
    )
    return [
        (
            (buyer or "").strip(),
            float(qty_sum or 0.0),
            float(quintal_sum or 0.0),
        )
        for buyer, qty_sum, quintal_sum in rows
        if (buyer or "").strip()
    ]


def _aggregate_purchases_by_buyer(
    db: Session,
    *,
    date_from: date,
    date_to: date,
    broker: str,
) -> List[Tuple[str, float, float]]:
    start_dt = datetime.combine(date_from, datetime.min.time())
    end_dt = datetime.combine(date_to, datetime.max.time())
    gr = _goods_receipt_broker_subquery(db, date_from=date_from, date_to=date_to)
    effective_broker = _purchase_broker_expr(gr)
    packing_kg = func.coalesce(TallyPurchase.packing, DEFAULT_PACKING_KG)
    qty = func.coalesce(TallyPurchase.qty, 0.0)
    quintals = qty * packing_kg / 100.0

    rows = (
        db.query(
            TallyPurchase.ledger_name,
            func.coalesce(func.sum(qty), 0.0).label("qty"),
            func.coalesce(func.sum(quintals), 0.0).label("quintals"),
        )
        .outerjoin(
            gr,
            and_(
                gr.c.vendor == TallyPurchase.ledger_name,
                gr.c.stock_item == TallyPurchase.stock_item,
                gr.c.receipt_date == func.date(TallyPurchase.voucher_date),
            ),
        )
        .filter(
            TallyPurchase.voucher_date.isnot(None),
            TallyPurchase.voucher_date >= start_dt,
            TallyPurchase.voucher_date <= end_dt,
            _broker_filter(effective_broker, broker),
            TallyPurchase.ledger_name.isnot(None),
            TallyPurchase.ledger_name != "",
        )
        .group_by(TallyPurchase.ledger_name)
        .all()
    )
    return [
        (
            (buyer or "").strip(),
            float(qty_sum or 0.0),
            float(quintal_sum or 0.0),
        )
        for buyer, qty_sum, quintal_sum in rows
        if (buyer or "").strip()
    ]


def _aggregate_by_buyer(
    db: Session,
    *,
    model: Type[TallySale] | Type[TallyPurchase],
    date_from: date,
    date_to: date,
    broker: str,
) -> List[Tuple[str, float, float]]:
    if model is TallySale:
        return _aggregate_sales_by_buyer(
            db, date_from=date_from, date_to=date_to, broker=broker
        )
    return _aggregate_purchases_by_buyer(
        db, date_from=date_from, date_to=date_to, broker=broker
    )


def _effective_quintals(*, qty: float, base_quintals: float, qty_adjust: float) -> float:
    """Scale tally quintals by (qty - adjust) / qty when qty is non-zero."""
    q = float(qty or 0.0)
    base = float(base_quintals or 0.0)
    adj = abs(float(qty_adjust or 0.0))
    if q == 0.0:
        return 0.0
    return base * ((q - adj) / q)


def _period_sort_key(fy_start: int, month: int) -> int:
    """Order FY months Apr→Mar as a continuous sequence."""
    return int(fy_start) * 12 + ((int(month) - 4) % 12)


def _load_rates(
    db: Session,
    *,
    fy_start: int,
    month: int,
    broker: str,
) -> Dict[Tuple[str, str], Tuple[float, float]]:
    """Current-period rates/adjust from the saved brokerage snapshot only."""
    name = _normalize_broker(broker)
    rates: Dict[Tuple[str, str], Tuple[float, float]] = {}
    snapshot_rows = (
        db.query(Brokerage)
        .filter(
            Brokerage.fy_start == int(fy_start),
            Brokerage.month == int(month),
            Brokerage.broker == name,
        )
        .all()
    )
    for row in snapshot_rows:
        rates[(row.side, row.stock_item)] = (
            float(row.rate_per_quintal) if row.rate_per_quintal is not None else 0.0,
            abs(float(row.qty_adjust or 0.0)),
        )
    return rates


def _load_previous_rates(
    db: Session,
    *,
    fy_start: int,
    month: int,
    broker: str,
) -> Dict[Tuple[str, str], float]:
    """Latest Rate/Qtl from prior saved snapshots for broker + side + stock item.

    Prefers ``yoradm_brokerage``; falls back to legacy ``yoradm_brokerage_rate``
    only when no earlier snapshot rate exists for that key.
    """
    name = _normalize_broker(broker)
    current_key = _period_sort_key(fy_start, month)
    latest: Dict[Tuple[str, str], Tuple[int, float]] = {}

    for row in db.query(Brokerage).filter(Brokerage.broker == name).all():
        if row.rate_per_quintal is None:
            continue
        period_key = _period_sort_key(row.fy_start, row.month)
        if period_key >= current_key:
            continue
        key = (row.side, row.stock_item)
        prev = latest.get(key)
        if prev is None or period_key > prev[0]:
            latest[key] = (period_key, float(row.rate_per_quintal))

    for row in db.query(BrokerageRate).filter(BrokerageRate.broker == name).all():
        period_key = _period_sort_key(row.fy_start, row.month)
        if period_key >= current_key:
            continue
        key = (row.side, row.stock_item)
        prev = latest.get(key)
        if prev is None or period_key > prev[0]:
            latest[key] = (period_key, float(row.rate_per_quintal or 0.0))

    return {key: rate for key, (_period, rate) in latest.items()}


def _load_previous_tds_percent(
    db: Session,
    *,
    fy_start: int,
    month: int,
    broker: str,
) -> Optional[float]:
    """Most recent TDS % from an earlier saved snapshot for this broker."""
    name = _normalize_broker(broker)
    current_key = _period_sort_key(fy_start, month)
    best_period: Optional[int] = None
    best_tds: Optional[float] = None
    rows = (
        db.query(Brokerage.fy_start, Brokerage.month, Brokerage.tds_percent)
        .filter(
            Brokerage.broker == name,
            Brokerage.tds_percent.isnot(None),
        )
        .distinct()
        .all()
    )
    for fy, mo, tds in rows:
        if tds is None:
            continue
        period_key = _period_sort_key(fy, mo)
        if period_key >= current_key:
            continue
        if best_period is None or period_key > best_period:
            best_period = period_key
            best_tds = float(tds)
    return best_tds


def _load_tds_percent(
    db: Session,
    *,
    fy_start: int,
    month: int,
    broker: str,
) -> Optional[float]:
    name = _normalize_broker(broker)
    snap = (
        db.query(Brokerage.tds_percent)
        .filter(
            Brokerage.fy_start == int(fy_start),
            Brokerage.month == int(month),
            Brokerage.broker == name,
            Brokerage.tds_percent.isnot(None),
        )
        .first()
    )
    if snap is not None and snap[0] is not None:
        return float(snap[0])

    row = (
        db.query(BrokerageSetting)
        .filter(
            BrokerageSetting.fy_start == int(fy_start),
            BrokerageSetting.month == int(month),
            BrokerageSetting.broker == name,
        )
        .first()
    )
    if row is not None and row.tds_percent is not None:
        return float(row.tds_percent)

    return _load_previous_tds_percent(
        db, fy_start=fy_start, month=month, broker=name
    )


def _save_tds_percent(
    db: Session,
    *,
    fy_start: int,
    month: int,
    broker: str,
    tds_percent: Optional[float],
) -> None:
    row = (
        db.query(BrokerageSetting)
        .filter(
            BrokerageSetting.fy_start == int(fy_start),
            BrokerageSetting.month == int(month),
            BrokerageSetting.broker == broker,
        )
        .first()
    )
    if tds_percent is None:
        if row is not None:
            db.delete(row)
        return
    value = float(tds_percent)
    if not (value == value):  # NaN
        raise ValueError("Invalid TDS percent")
    if value < 0 or value > 100:
        raise ValueError("TDS percent must be between 0 and 100")
    if row is None:
        db.add(
            BrokerageSetting(
                fy_start=int(fy_start),
                month=int(month),
                broker=broker,
                tds_percent=value,
            )
        )
    else:
        row.tds_percent = value


def _section_from_rows(
    *,
    side: str,
    aggregates: Sequence[Tuple[str, float, float]],
    rates: Dict[Tuple[str, str], Tuple[float, float]],
    previous_rates: Optional[Dict[Tuple[str, str], float]] = None,
    tds_percent: Optional[float] = None,
) -> BrokerageSectionOut:
    prior = previous_rates or {}
    out_rows: List[BrokerageRowOut] = []
    total_qty = 0.0
    total_quintals = 0.0
    total_brokerage = 0.0
    for stock_item, qty, base_quintals in aggregates:
        saved = rates.get((side, stock_item))
        if saved is not None:
            rate = saved[0]
            qty_adjust = float(saved[1])
        else:
            rate = prior.get((side, stock_item))
            qty_adjust = 0.0
        adjusted = float(qty) - abs(qty_adjust)
        effective = _effective_quintals(
            qty=float(qty),
            base_quintals=float(base_quintals),
            qty_adjust=qty_adjust,
        )
        amount = float(effective) * float(rate) if rate is not None else 0.0
        tds_amount = (
            (amount * float(tds_percent)) / 100.0 if tds_percent is not None else 0.0
        )
        out_rows.append(
            BrokerageRowOut(
                side=side,  # type: ignore[arg-type]
                stock_item=stock_item,
                qty=float(qty),
                qty_adjust=qty_adjust,
                adjusted_qty=adjusted,
                # Frontend scales from this base using current adjust draft.
                quintals=float(base_quintals),
                rate_per_quintal=rate,
                brokerage_amount=amount,
                tds_amount=tds_amount,
                net_amount=amount - tds_amount,
            )
        )
        total_qty += adjusted
        total_quintals += float(effective)
        total_brokerage += amount
    return BrokerageSectionOut(
        side=side,  # type: ignore[arg-type]
        rows=out_rows,
        total_qty=total_qty,
        total_quintals=total_quintals,
        total_brokerage=total_brokerage,
    )


def _has_saved_snapshot(
    db: Session, *, fy_start: int, month: int, broker: str
) -> bool:
    return (
        db.query(Brokerage.id)
        .filter(
            Brokerage.fy_start == int(fy_start),
            Brokerage.month == int(month),
            Brokerage.broker == _normalize_broker(broker),
        )
        .first()
        is not None
    )


def _snapshot_fingerprint(rows: Sequence[BrokerageRowOut], tds_percent: Optional[float]) -> set:
    tds_key = None if tds_percent is None else _round_money(tds_percent)
    out = set()
    for row in rows:
        out.add(
            (
                row.side,
                row.stock_item,
                _round_money(row.qty),
                _round_money(row.qty_adjust),
                _round_money(row.adjusted_qty),
                _round_money(
                    _effective_quintals(
                        qty=row.qty,
                        base_quintals=row.quintals,
                        qty_adjust=row.qty_adjust,
                    )
                ),
                None
                if row.rate_per_quintal is None
                else _round_money(row.rate_per_quintal),
                _round_money(row.brokerage_amount),
                tds_key,
                _round_money(row.tds_amount),
                _round_money(row.net_amount),
            )
        )
    return out


def _load_saved_workings(
    db: Session,
    *,
    fy_start: int,
    month: int,
    broker: str,
) -> Optional[BrokerageWorkingsOut]:
    name = _normalize_broker(broker)
    rows = (
        db.query(Brokerage)
        .filter(
            Brokerage.fy_start == int(fy_start),
            Brokerage.month == int(month),
            Brokerage.broker == name,
        )
        .order_by(Brokerage.side.asc(), Brokerage.stock_item.asc())
        .all()
    )
    if not rows:
        return None

    date_from, date_to = _month_date_range(fy_start=fy_start, month=month)
    tds_percent = None
    for row in rows:
        if row.tds_percent is not None:
            tds_percent = float(row.tds_percent)
            break

    sale_rows: List[BrokerageRowOut] = []
    purchase_rows: List[BrokerageRowOut] = []
    for row in rows:
        qty = float(row.qty or 0.0)
        qty_adjust = abs(float(row.qty_adjust or 0.0))
        adjusted = float(row.adjusted_qty or 0.0)
        effective = float(row.quintals or 0.0)
        # Recover base quintals so the UI can re-apply adjust drafts.
        if qty != 0.0 and adjusted != 0.0:
            base_quintals = effective * (qty / adjusted)
        else:
            base_quintals = effective
        out = BrokerageRowOut(
            side=row.side,  # type: ignore[arg-type]
            stock_item=row.stock_item,
            qty=qty,
            qty_adjust=qty_adjust,
            adjusted_qty=adjusted,
            quintals=base_quintals,
            rate_per_quintal=(
                None if row.rate_per_quintal is None else float(row.rate_per_quintal)
            ),
            brokerage_amount=float(row.brokerage_amount or 0.0),
            tds_amount=float(row.tds_amount or 0.0),
            net_amount=float(row.net_amount or 0.0),
        )
        if row.side == SIDE_PURCHASE:
            purchase_rows.append(out)
        else:
            sale_rows.append(out)

    def _section(side: str, section_rows: List[BrokerageRowOut]) -> BrokerageSectionOut:
        return BrokerageSectionOut(
            side=side,  # type: ignore[arg-type]
            rows=section_rows,
            total_qty=sum(r.adjusted_qty for r in section_rows),
            total_quintals=sum(
                _effective_quintals(
                    qty=r.qty, base_quintals=r.quintals, qty_adjust=r.qty_adjust
                )
                for r in section_rows
            ),
            total_brokerage=sum(r.brokerage_amount for r in section_rows),
        )

    return BrokerageWorkingsOut(
        fy_start=int(fy_start),
        month=int(month),
        broker=name,
        date_from=date_from.isoformat(),
        date_to=date_to.isoformat(),
        tds_percent=tds_percent,
        sales=_section(SIDE_SALE, sale_rows),
        purchases=_section(SIDE_PURCHASE, purchase_rows),
        is_saved=True,
        has_saved=True,
        matches_saved=True,
    )


def _build_live_workings(
    db: Session,
    *,
    fy_start: int,
    month: int,
    broker: str,
) -> BrokerageWorkingsOut:
    name = _normalize_broker(broker)
    if not name:
        raise ValueError("broker is required")
    date_from, date_to = _month_date_range(fy_start=fy_start, month=month)
    rates = _load_rates(db, fy_start=fy_start, month=month, broker=name)
    previous_rates = _load_previous_rates(
        db, fy_start=fy_start, month=month, broker=name
    )
    tds_percent = _load_tds_percent(db, fy_start=fy_start, month=month, broker=name)
    sales_agg = _aggregate_by_stock_item(
        db,
        model=TallySale,
        date_from=date_from,
        date_to=date_to,
        broker=name,
    )
    purchase_agg = _aggregate_by_stock_item(
        db,
        model=TallyPurchase,
        date_from=date_from,
        date_to=date_to,
        broker=name,
    )
    sales = _section_from_rows(
        side=SIDE_SALE,
        aggregates=sales_agg,
        rates=rates,
        previous_rates=previous_rates,
        tds_percent=tds_percent,
    )
    purchases = _section_from_rows(
        side=SIDE_PURCHASE,
        aggregates=purchase_agg,
        rates=rates,
        previous_rates=previous_rates,
        tds_percent=tds_percent,
    )
    has_saved = _has_saved_snapshot(db, fy_start=fy_start, month=month, broker=name)
    matches = False
    if has_saved:
        saved = _load_saved_workings(
            db, fy_start=fy_start, month=month, broker=name
        )
        if saved is not None:
            live_fp = _snapshot_fingerprint(
                [*sales.rows, *purchases.rows], tds_percent
            )
            saved_fp = _snapshot_fingerprint(
                [*saved.sales.rows, *saved.purchases.rows], saved.tds_percent
            )
            matches = live_fp == saved_fp

    return BrokerageWorkingsOut(
        fy_start=int(fy_start),
        month=int(month),
        broker=name,
        date_from=date_from.isoformat(),
        date_to=date_to.isoformat(),
        tds_percent=tds_percent,
        sales=sales,
        purchases=purchases,
        is_saved=False,
        has_saved=has_saved,
        matches_saved=matches,
    )


def list_brokers(
    db: Session,
    *,
    fy_start: int,
    month: int,
) -> BrokerageBrokersOut:
    date_from, date_to = _month_date_range(fy_start=fy_start, month=month)
    start_dt = datetime.combine(date_from, datetime.min.time())
    end_dt = datetime.combine(date_to, datetime.max.time())

    names: set[str] = set()

    recv = _receivable_broker_subquery(db, start_dt=start_dt, end_dt=end_dt)
    sale_broker = _sale_broker_expr(recv)
    sale_rows = (
        db.query(sale_broker)
        .select_from(TallySale)
        .outerjoin(
            recv,
            and_(
                recv.c.invoice_no == TallySale.voucher_no,
                recv.c.ledger_name == TallySale.ledger_name,
            ),
        )
        .filter(
            TallySale.voucher_date.isnot(None),
            TallySale.voucher_date >= start_dt,
            TallySale.voucher_date <= end_dt,
            sale_broker.isnot(None),
            sale_broker != "",
        )
        .distinct()
        .all()
    )
    for (raw,) in sale_rows:
        name = _normalize_broker(raw)
        if name and not _is_blank_broker(name):
            names.add(name)

    gr = _goods_receipt_broker_subquery(db, date_from=date_from, date_to=date_to)
    purchase_broker = _purchase_broker_expr(gr)
    purchase_rows = (
        db.query(purchase_broker)
        .select_from(TallyPurchase)
        .outerjoin(
            gr,
            and_(
                gr.c.vendor == TallyPurchase.ledger_name,
                gr.c.stock_item == TallyPurchase.stock_item,
                gr.c.receipt_date == func.date(TallyPurchase.voucher_date),
            ),
        )
        .filter(
            TallyPurchase.voucher_date.isnot(None),
            TallyPurchase.voucher_date >= start_dt,
            TallyPurchase.voucher_date <= end_dt,
            purchase_broker.isnot(None),
            purchase_broker != "",
        )
        .distinct()
        .all()
    )
    for (raw,) in purchase_rows:
        name = _normalize_broker(raw)
        if name and not _is_blank_broker(name):
            names.add(name)

    saved = (
        db.query(Brokerage.broker)
        .filter(Brokerage.fy_start == int(fy_start), Brokerage.month == int(month))
        .distinct()
        .all()
    )
    for (raw,) in saved:
        name = _normalize_broker(raw)
        if name and not _is_blank_broker(name):
            names.add(name)

    return BrokerageBrokersOut(brokers=sorted(names, key=lambda n: n.casefold()))


def list_brokerage_buyers(
    db: Session,
    *,
    fy_start: int,
    month: int,
    broker: str,
) -> BrokerageBuyersOut:
    name = _normalize_broker(broker)
    if not name:
        raise ValueError("broker is required")
    date_from, date_to = _month_date_range(fy_start=fy_start, month=month)

    merged: Dict[str, list] = {}
    for model in (TallySale, TallyPurchase):
        for buyer, qty, quintals in _aggregate_by_buyer(
            db,
            model=model,
            date_from=date_from,
            date_to=date_to,
            broker=name,
        ):
            key = buyer.casefold()
            if key not in merged:
                merged[key] = [buyer, qty, quintals]
            else:
                merged[key][1] += qty
                merged[key][2] += quintals

    rows = [
        BrokerageBuyerRowOut(
            buyer=display,
            qty=float(qty),
            quintals=float(quintals),
        )
        for display, qty, quintals in sorted(
            merged.values(), key=lambda item: str(item[0]).casefold()
        )
    ]
    return BrokerageBuyersOut(
        fy_start=int(fy_start),
        month=int(month),
        broker=name,
        rows=rows,
        total_qty=sum(row.qty for row in rows),
        total_quintals=sum(row.quintals for row in rows),
    )


def list_brokerage(
    db: Session,
    *,
    fy_start: int,
    month: int,
    broker: str,
    reload: bool = False,
) -> BrokerageWorkingsOut:
    name = _normalize_broker(broker)
    if not name:
        raise ValueError("broker is required")
    if not reload:
        saved = _load_saved_workings(
            db, fy_start=fy_start, month=month, broker=name
        )
        if saved is not None:
            return saved
    return _build_live_workings(db, fy_start=fy_start, month=month, broker=name)


def _lines_from_rates_payload(payload: BrokerageRatesSaveIn) -> List[BrokerageLineSaveIn]:
    if payload.lines:
        return list(payload.lines)
    # Legacy rate-only payload: rebuild live then overlay rates.
    return []


def save_brokerage(
    db: Session,
    payload: BrokerageSaveIn | BrokerageRatesSaveIn,
) -> BrokerageWorkingsOut:
    broker = _normalize_broker(payload.broker)
    if not broker:
        raise ValueError("broker is required")
    fy_start = int(payload.fy_start)
    month = int(payload.month)
    if month < 1 or month > 12:
        raise ValueError("month must be 1–12")

    tds_percent = payload.tds_percent
    if tds_percent is not None:
        value = float(tds_percent)
        if not (value == value):
            raise ValueError("Invalid TDS percent")
        if value < 0 or value > 100:
            raise ValueError("TDS percent must be between 0 and 100")
        tds_percent = value

    lines: List[BrokerageLineSaveIn]
    if isinstance(payload, BrokerageSaveIn):
        lines = list(payload.lines)
    else:
        lines = _lines_from_rates_payload(payload)
        if not lines and payload.rates:
            # Build from live aggregates + posted rates (legacy clients).
            live = _build_live_workings(
                db, fy_start=fy_start, month=month, broker=broker
            )
            rate_map = {
                (item.side, (item.stock_item or "").strip()): item
                for item in payload.rates
                if (item.stock_item or "").strip()
            }
            built: List[BrokerageLineSaveIn] = []
            for row in [*live.sales.rows, *live.purchases.rows]:
                item = rate_map.get((row.side, row.stock_item))
                qty_adjust = (
                    0.0
                    if item is None or item.qty_adjust is None
                    else abs(float(item.qty_adjust))
                )
                rate = (
                    row.rate_per_quintal
                    if item is None
                    else item.rate_per_quintal
                )
                effective = _effective_quintals(
                    qty=row.qty,
                    base_quintals=row.quintals,
                    qty_adjust=qty_adjust,
                )
                amount = float(effective) * float(rate) if rate is not None else 0.0
                tds_amount = (
                    (amount * float(tds_percent)) / 100.0
                    if tds_percent is not None
                    else 0.0
                )
                built.append(
                    BrokerageLineSaveIn(
                        side=row.side,
                        stock_item=row.stock_item,
                        qty=float(row.qty),
                        qty_adjust=qty_adjust,
                        adjusted_qty=float(row.qty) - qty_adjust,
                        quintals=float(effective),
                        rate_per_quintal=rate,
                        brokerage_amount=amount,
                        tds_amount=tds_amount,
                        net_amount=amount - tds_amount,
                    )
                )
            lines = built

    existing = (
        db.query(Brokerage)
        .filter(
            Brokerage.fy_start == fy_start,
            Brokerage.month == month,
            Brokerage.broker == broker,
        )
        .all()
    )
    by_key = {(row.side, row.stock_item): row for row in existing}
    keep_keys: set[Tuple[str, str]] = set()

    for item in lines:
        stock_item = (item.stock_item or "").strip()
        if not stock_item:
            continue
        side = item.side
        key = (side, stock_item)
        keep_keys.add(key)

        qty = float(item.qty or 0.0)
        qty_adjust = abs(float(item.qty_adjust or 0.0))
        if qty_adjust != int(qty_adjust):
            raise ValueError(f"Adjust for {stock_item} must be a whole number")
        qty_adjust = float(int(qty_adjust))
        adjusted_qty = float(item.adjusted_qty if item.adjusted_qty is not None else qty - qty_adjust)
        quintals = float(item.quintals or 0.0)
        rate = item.rate_per_quintal
        rate_value = None if rate is None else float(rate)
        if rate_value is not None and not (rate_value == rate_value):
            raise ValueError(f"Invalid rate for {stock_item}")
        brokerage_amount = float(item.brokerage_amount or 0.0)
        tds_amount = float(item.tds_amount or 0.0)
        net_amount = float(item.net_amount or 0.0)

        row = by_key.get(key)
        if row is None:
            row = Brokerage(
                fy_start=fy_start,
                month=month,
                broker=broker,
                side=side,
                stock_item=stock_item,
            )
            db.add(row)
            by_key[key] = row
        row.qty = qty
        row.qty_adjust = qty_adjust
        row.adjusted_qty = adjusted_qty
        row.quintals = quintals
        row.rate_per_quintal = rate_value
        row.brokerage_amount = brokerage_amount
        row.tds_percent = tds_percent
        row.tds_amount = tds_amount
        row.net_amount = net_amount

        # Keep legacy rate table in sync for older tooling.
        legacy = (
            db.query(BrokerageRate)
            .filter(
                BrokerageRate.fy_start == fy_start,
                BrokerageRate.month == month,
                BrokerageRate.broker == broker,
                BrokerageRate.side == side,
                BrokerageRate.stock_item == stock_item,
            )
            .first()
        )
        if rate_value is None and qty_adjust == 0.0:
            if legacy is not None:
                db.delete(legacy)
        else:
            if legacy is None:
                legacy = BrokerageRate(
                    fy_start=fy_start,
                    month=month,
                    broker=broker,
                    side=side,
                    stock_item=stock_item,
                    rate_per_quintal=0.0 if rate_value is None else rate_value,
                    qty_adjust=qty_adjust,
                )
                db.add(legacy)
            else:
                legacy.rate_per_quintal = 0.0 if rate_value is None else rate_value
                legacy.qty_adjust = qty_adjust

    for key, row in list(by_key.items()):
        if key not in keep_keys:
            db.delete(row)

    _save_tds_percent(
        db,
        fy_start=fy_start,
        month=month,
        broker=broker,
        tds_percent=tds_percent,
    )

    db.commit()
    saved = _load_saved_workings(db, fy_start=fy_start, month=month, broker=broker)
    if saved is None:
        return _build_live_workings(db, fy_start=fy_start, month=month, broker=broker)
    return saved


def save_brokerage_rates(
    db: Session,
    payload: BrokerageRatesSaveIn,
) -> BrokerageWorkingsOut:
    return save_brokerage(db, payload)
