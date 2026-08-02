from __future__ import annotations

from calendar import monthrange
from datetime import date, datetime
from typing import Dict, List, Optional, Sequence, Tuple, Type

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.brokerage_rate import BrokerageRate
from app.models.brokerage_setting import BrokerageSetting
from app.models.tally import TallyPurchase, TallySale
from app.schemas.brokerage import (
    BrokerageBrokersOut,
    BrokerageRatesSaveIn,
    BrokerageRowOut,
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


def _aggregate_by_stock_item(
    db: Session,
    *,
    model: Type[TallySale] | Type[TallyPurchase],
    date_from: date,
    date_to: date,
    broker: str,
) -> List[Tuple[str, float, float]]:
    start_dt = datetime.combine(date_from, datetime.min.time())
    end_dt = datetime.combine(date_to, datetime.max.time())
    packing_kg = func.coalesce(model.packing, DEFAULT_PACKING_KG)
    qty = func.coalesce(model.qty, 0.0)
    quintals = qty * packing_kg / 100.0

    rows = (
        db.query(
            model.stock_item,
            func.coalesce(func.sum(qty), 0.0).label("qty"),
            func.coalesce(func.sum(quintals), 0.0).label("quintals"),
        )
        .filter(
            model.voucher_date.isnot(None),
            model.voucher_date >= start_dt,
            model.voucher_date <= end_dt,
            _broker_filter(model.broker, broker),
            model.stock_item.isnot(None),
            model.stock_item != "",
        )
        .group_by(model.stock_item)
        .order_by(model.stock_item.asc())
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


def _effective_quintals(*, qty: float, base_quintals: float, qty_adjust: float) -> float:
    """Scale tally quintals by (qty - adjust) / qty when qty is non-zero."""
    q = float(qty or 0.0)
    base = float(base_quintals or 0.0)
    adj = abs(float(qty_adjust or 0.0))
    if q == 0.0:
        return 0.0
    return base * ((q - adj) / q)


def _load_rates(
    db: Session,
    *,
    fy_start: int,
    month: int,
    broker: str,
) -> Dict[Tuple[str, str], Tuple[float, float]]:
    rows = (
        db.query(BrokerageRate)
        .filter(
            BrokerageRate.fy_start == int(fy_start),
            BrokerageRate.month == int(month),
            BrokerageRate.broker == _normalize_broker(broker),
        )
        .all()
    )
    return {
        (row.side, row.stock_item): (
            float(row.rate_per_quintal or 0.0),
            abs(float(row.qty_adjust or 0.0)),
        )
        for row in rows
    }


def _load_tds_percent(
    db: Session,
    *,
    fy_start: int,
    month: int,
    broker: str,
) -> Optional[float]:
    row = (
        db.query(BrokerageSetting)
        .filter(
            BrokerageSetting.fy_start == int(fy_start),
            BrokerageSetting.month == int(month),
            BrokerageSetting.broker == _normalize_broker(broker),
        )
        .first()
    )
    if row is None or row.tds_percent is None:
        return None
    return float(row.tds_percent)


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
) -> BrokerageSectionOut:
    out_rows: List[BrokerageRowOut] = []
    total_qty = 0.0
    total_quintals = 0.0
    total_brokerage = 0.0
    for stock_item, qty, base_quintals in aggregates:
        saved = rates.get((side, stock_item))
        rate = saved[0] if saved is not None else None
        qty_adjust = float(saved[1]) if saved is not None else 0.0
        effective = _effective_quintals(
            qty=float(qty),
            base_quintals=float(base_quintals),
            qty_adjust=qty_adjust,
        )
        amount = float(effective) * float(rate) if rate is not None else 0.0
        out_rows.append(
            BrokerageRowOut(
                side=side,  # type: ignore[arg-type]
                stock_item=stock_item,
                qty=float(qty),
                qty_adjust=qty_adjust,
                quintals=float(base_quintals),
                rate_per_quintal=rate,
                brokerage_amount=amount,
            )
        )
        total_qty += float(qty) - abs(qty_adjust)
        total_quintals += float(effective)
        total_brokerage += amount
    return BrokerageSectionOut(
        side=side,  # type: ignore[arg-type]
        rows=out_rows,
        total_qty=total_qty,
        total_quintals=total_quintals,
        total_brokerage=total_brokerage,
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
    for model in (TallySale, TallyPurchase):
        rows = (
            db.query(model.broker)
            .filter(
                model.voucher_date.isnot(None),
                model.voucher_date >= start_dt,
                model.voucher_date <= end_dt,
                model.broker.isnot(None),
                model.broker != "",
            )
            .distinct()
            .all()
        )
        for (raw,) in rows:
            name = _normalize_broker(raw)
            if name and not _is_blank_broker(name):
                names.add(name)

    return BrokerageBrokersOut(brokers=sorted(names, key=lambda n: n.casefold()))


def list_brokerage(
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
    return BrokerageWorkingsOut(
        fy_start=int(fy_start),
        month=int(month),
        broker=name,
        date_from=date_from.isoformat(),
        date_to=date_to.isoformat(),
        tds_percent=tds_percent,
        sales=_section_from_rows(side=SIDE_SALE, aggregates=sales_agg, rates=rates),
        purchases=_section_from_rows(
            side=SIDE_PURCHASE, aggregates=purchase_agg, rates=rates
        ),
    )


def save_brokerage_rates(
    db: Session,
    payload: BrokerageRatesSaveIn,
) -> BrokerageWorkingsOut:
    broker = _normalize_broker(payload.broker)
    if not broker:
        raise ValueError("broker is required")
    fy_start = int(payload.fy_start)
    month = int(payload.month)
    if month < 1 or month > 12:
        raise ValueError("month must be 1–12")

    existing = (
        db.query(BrokerageRate)
        .filter(
            BrokerageRate.fy_start == fy_start,
            BrokerageRate.month == month,
            BrokerageRate.broker == broker,
        )
        .all()
    )
    by_key = {(row.side, row.stock_item): row for row in existing}

    for item in payload.rates:
        side = item.side
        stock_item = (item.stock_item or "").strip()
        if not stock_item:
            continue
        key = (side, stock_item)
        rate = item.rate_per_quintal
        qty_adjust = item.qty_adjust
        adjust_value = 0.0 if qty_adjust is None else abs(float(qty_adjust))
        if not (adjust_value == adjust_value):  # NaN
            raise ValueError(f"Invalid adjust for {stock_item}")
        if adjust_value != int(adjust_value):
            raise ValueError(f"Adjust for {stock_item} must be a whole number")
        adjust_value = float(int(adjust_value))

        if rate is None and adjust_value == 0.0:
            row = by_key.get(key)
            if row is not None:
                db.delete(row)
            continue

        rate_value = 0.0 if rate is None else float(rate)
        if not (rate_value == rate_value):  # NaN
            raise ValueError(f"Invalid rate for {stock_item}")
        row = by_key.get(key)
        if row is None:
            row = BrokerageRate(
                fy_start=fy_start,
                month=month,
                broker=broker,
                side=side,
                stock_item=stock_item,
                rate_per_quintal=rate_value,
                qty_adjust=adjust_value,
            )
            db.add(row)
            by_key[key] = row
        else:
            row.rate_per_quintal = rate_value
            row.qty_adjust = adjust_value

    _save_tds_percent(
        db,
        fy_start=fy_start,
        month=month,
        broker=broker,
        tds_percent=payload.tds_percent,
    )

    db.commit()
    return list_brokerage(db, fy_start=fy_start, month=month, broker=broker)
