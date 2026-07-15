from __future__ import annotations

from datetime import date
from math import ceil
from typing import List, Optional, Tuple

from fastapi import HTTPException, status
from sqlalchemy import cast, Integer
from sqlalchemy.orm import Session, joinedload

from app.models.orid_dhall_production import OridDhallProduction, OridDhallProductionLine
from app.schemas.orid_dhall_production import (
    OridDhallOpenBatchItem,
    OridDhallPeriodOptionsOut,
    OridDhallPeriodYearOut,
    OridDhallProductionCreate,
    OridDhallProductionListItem,
    OridDhallProductionOut,
    OridDhallPurchaseLineIn,
    OridDhallPurchaseLineOut,
)


def get_by_id(db: Session, production_id: int) -> Optional[OridDhallProduction]:
    return (
        db.query(OridDhallProduction)
        .options(joinedload(OridDhallProduction.lines))
        .filter(OridDhallProduction.id == production_id)
        .first()
    )


def _parse_qty(value: Optional[str]) -> float:
    if value is None:
        return 0.0
    try:
        return float(str(value).replace(",", "").strip() or 0)
    except (TypeError, ValueError):
        return 0.0


def _line_weight_kg(line: OridDhallProductionLine) -> float:
    if line.weight is not None:
        try:
            return float(line.weight)
        except (TypeError, ValueError):
            pass
    if line.qty is not None:
        try:
            return float(line.qty)
        except (TypeError, ValueError):
            pass
    return 0.0


def _bags_to_quintal(bags: float) -> float:
    return bags * 50.0 / 100.0


def _value_from_rate_bags(rate_value: Optional[str], bags: float) -> Optional[float]:
    if rate_value is None or str(rate_value).strip() == "":
        return None
    rate = _parse_qty(rate_value)
    return rate * _bags_to_quintal(bags)


def _list_summary(row: OridDhallProduction) -> dict:
    """Search-table metrics: qty + % of raw; overall % and net value (form footer)."""
    raw_weight = 0.0
    raw_value = 0.0
    avg_qty = 0.0
    avg_value = 0.0
    avg_weight = 0.0
    has_raw = False
    has_avg = False
    for line in row.lines:
        if line.line_kind == "raw":
            has_raw = True
            raw_weight += _line_weight_kg(line)
            try:
                raw_value += float(line.amount or 0)
            except (TypeError, ValueError):
                pass
        elif line.line_kind == "avg":
            has_avg = True
            try:
                avg_qty += float(line.qty or 0)
            except (TypeError, ValueError):
                pass
            avg_weight += _line_weight_kg(line)
            try:
                avg_value += float(line.amount or 0)
            except (TypeError, ValueError):
                pass

    raw_quintal = raw_weight / 100.0 if raw_weight else 0.0
    avg_quintal = avg_weight / 100.0 if has_avg else 0.0

    opening_bags = _parse_qty(row.opening_bags)
    previous_bags = _parse_qty(row.previous_batch_bags)
    delivery_bags = _parse_qty(row.delivery_bags)
    closing_bags = _parse_qty(row.closing_bags)
    split_bags = _parse_qty(row.split_bags)
    sortex_bags = _parse_qty(row.sortex_bags)
    husk_bags = _parse_qty(row.husk_bags)

    has_split = str(row.split_bags or "").strip() != ""
    has_sortex = str(row.sortex_bags or "").strip() != ""
    has_husk = str(row.husk_bags or "").strip() != ""
    has_dhall_input = has_avg or any(
        str(v or "").strip() != ""
        for v in (
            row.opening_bags,
            row.previous_batch_bags,
            row.delivery_bags,
            row.closing_bags,
        )
    )

    orid_dhall_bags = (
        delivery_bags + closing_bags - opening_bags - avg_qty - previous_bags
    )
    orid_dhall_quintal = (
        _bags_to_quintal(delivery_bags)
        + _bags_to_quintal(closing_bags)
        - _bags_to_quintal(opening_bags)
        - avg_quintal
        - _bags_to_quintal(previous_bags)
    )

    def pct_of_raw_from_quintal(quintal: float) -> Optional[float]:
        if raw_quintal <= 0:
            return None
        return round((quintal / raw_quintal) * 100, 2)

    def pct_of_raw_from_bags(bags: float) -> Optional[float]:
        return pct_of_raw_from_quintal(_bags_to_quintal(bags))

    orid_dhall_pct = pct_of_raw_from_quintal(orid_dhall_quintal) if raw_quintal else None
    split_pct = pct_of_raw_from_bags(split_bags) if has_split and raw_quintal else None
    sortex_pct = pct_of_raw_from_bags(sortex_bags) if has_sortex and raw_quintal else None
    husk_pct = pct_of_raw_from_bags(husk_bags) if has_husk and raw_quintal else None

    overall_pct = None
    if any(v is not None for v in (orid_dhall_pct, split_pct, sortex_pct, husk_pct)):
        overall_pct = round(
            (orid_dhall_pct or 0)
            + (split_pct or 0)
            + (sortex_pct or 0)
            + (husk_pct or 0),
            2,
        )

    opening_value = _value_from_rate_bags(row.opening_rate, opening_bags)
    previous_value = _value_from_rate_bags(row.previous_batch_rate, previous_bags)
    delivery_value = _value_from_rate_bags(row.delivery_rate, delivery_bags)
    closing_value = _value_from_rate_bags(row.closing_rate, closing_bags)
    split_value = _value_from_rate_bags(row.split_rate, split_bags)
    sortex_value = _value_from_rate_bags(row.sortex_rate, sortex_bags)
    husk_value = _value_from_rate_bags(row.husk_rate, husk_bags)

    orid_dhall_value = (
        (delivery_value or 0)
        + (closing_value or 0)
        - (opening_value or 0)
        - (avg_value if has_avg else 0)
        - (previous_value or 0)
    )

    net_value = (
        (orid_dhall_value if has_dhall_input else 0)
        + (
            (split_value or 0)
            if has_split and str(row.split_rate or "").strip()
            else 0
        )
        + (
            (sortex_value or 0)
            if has_sortex and str(row.sortex_rate or "").strip()
            else 0
        )
        + (
            (husk_value or 0)
            if has_husk and str(row.husk_rate or "").strip()
            else 0
        )
        - (raw_value if has_raw else 0)
    )

    return {
        "orid_raw_qty": round(raw_quintal, 2) if raw_quintal else None,
        "orid_raw_pct": 100.0 if raw_quintal else None,
        "orid_dhall_qty": round(orid_dhall_bags, 2),
        "orid_dhall_pct": orid_dhall_pct,
        "orid_dhall_split_qty": round(split_bags, 2) if has_split else None,
        "orid_dhall_split_pct": split_pct,
        "orid_rejection_pct": sortex_pct,
        "orid_husk_qty": round(husk_bags, 2) if has_husk else None,
        "orid_husk_pct": husk_pct,
        "overall_pct": overall_pct,
        "net_value": round(net_value, 2),
    }


def list_productions(
    db: Session,
    *,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    page: int = 1,
    page_size: int = 50,
) -> Tuple[List[OridDhallProductionListItem], int]:
    query = db.query(OridDhallProduction)
    if date_from is not None:
        query = query.filter(OridDhallProduction.production_date >= date_from)
    if date_to is not None:
        query = query.filter(OridDhallProduction.production_date <= date_to)

    total = query.count()
    rows = (
        query.options(joinedload(OridDhallProduction.lines))
        .order_by(
            cast(OridDhallProduction.lot_no, Integer).desc(),
            OridDhallProduction.id.desc(),
        )
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    items = []
    for row in rows:
        summary = _list_summary(row)
        items.append(
            OridDhallProductionListItem(
                id=row.id,
                production_date=row.production_date,
                lot_no=row.lot_no,
                status=row.status,  # type: ignore[arg-type]
                orid_raw_qty=summary["orid_raw_qty"],
                orid_raw_pct=summary["orid_raw_pct"],
                orid_dhall_qty=summary["orid_dhall_qty"],
                orid_dhall_pct=summary["orid_dhall_pct"],
                orid_dhall_split_qty=summary["orid_dhall_split_qty"],
                orid_dhall_split_pct=summary["orid_dhall_split_pct"],
                orid_rejection_pct=summary["orid_rejection_pct"],
                orid_husk_qty=summary["orid_husk_qty"],
                orid_husk_pct=summary["orid_husk_pct"],
                overall_pct=summary["overall_pct"],
                net_value=summary["net_value"],
                created_at=row.created_at,
            )
        )
    return items, total


def list_open_batches(db: Session) -> List[OridDhallOpenBatchItem]:
    rows = (
        db.query(OridDhallProduction)
        .filter(OridDhallProduction.status == "Open")
        .order_by(OridDhallProduction.id.desc())
        .all()
    )
    return [
        OridDhallOpenBatchItem(
            id=row.id,
            lot_no=row.lot_no,
            production_date=row.production_date,
            status=row.status,  # type: ignore[arg-type]
        )
        for row in rows
    ]


def _fy_start_for_date(value: date) -> int:
    return value.year if value.month >= 4 else value.year - 1


def _fy_label(fy_start: int) -> str:
    return f"{fy_start}-{str(fy_start + 1)[-2:]}"


# April → March order for month chips in an FY dropdown.
_FY_MONTH_ORDER = (4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3)


def list_period_options(db: Session) -> OridDhallPeriodOptionsOut:
    """Financial years and months that have at least one production date."""
    dates = [
        row[0]
        for row in db.query(OridDhallProduction.production_date)
        .filter(OridDhallProduction.production_date.isnot(None))
        .distinct()
        .all()
        if row[0] is not None
    ]
    by_fy: dict[int, set[int]] = {}
    for production_date in dates:
        fy_start = _fy_start_for_date(production_date)
        by_fy.setdefault(fy_start, set()).add(production_date.month)

    years = []
    for fy_start in sorted(by_fy.keys(), reverse=True):
        months = [m for m in _FY_MONTH_ORDER if m in by_fy[fy_start]]
        years.append(
            OridDhallPeriodYearOut(
                fy_start=fy_start,
                label=_fy_label(fy_start),
                months=months,
            )
        )
    return OridDhallPeriodOptionsOut(financial_years=years)


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
    line_kind: Optional[str] = None,
    exclude_production_id: Optional[int] = None,
) -> List[str]:
    query = db.query(OridDhallProductionLine.voucher_no).filter(
        OridDhallProductionLine.voucher_no.isnot(None),
        OridDhallProductionLine.voucher_no != "",
    )
    if line_kind:
        query = query.filter(OridDhallProductionLine.line_kind == line_kind)
    if exclude_production_id is not None:
        query = query.filter(
            OridDhallProductionLine.production_id != exclude_production_id
        )
    return sorted({row[0] for row in query.distinct().all() if row[0]})


def _assert_vouchers_available(
    db: Session,
    voucher_nos: List[str],
    *,
    line_kind: str,
    exclude_production_id: Optional[int] = None,
) -> None:
    unique_nos = sorted({no.strip() for no in voucher_nos if no and str(no).strip()})
    if not unique_nos:
        return
    query = db.query(OridDhallProductionLine.voucher_no).filter(
        OridDhallProductionLine.voucher_no.in_(unique_nos),
        OridDhallProductionLine.line_kind == line_kind,
    )
    if exclude_production_id is not None:
        query = query.filter(
            OridDhallProductionLine.production_id != exclude_production_id
        )
    used = sorted({row[0] for row in query.distinct().all() if row[0]})
    if used:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Purchase voucher(s) already used in another production: {', '.join(used)}",
        )


def _voucher_date_str(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    return str(value)[:32] if value else None


def _add_lines(
    db: Session,
    production: OridDhallProduction,
    lines: List[OridDhallPurchaseLineIn],
    *,
    line_kind: str,
    start_index: int,
) -> int:
    index = start_index
    for line in lines:
        db.add(
            OridDhallProductionLine(
                production_id=production.id,
                line_kind=line_kind,
                purchase_id=line.purchase_id,
                voucher_no=line.voucher_no,
                voucher_date=_voucher_date_str(line.voucher_date),
                ledger_name=line.ledger_name,
                broker=line.broker,
                stock_item=line.stock_item,
                brand=line.brand,
                packing=line.packing,
                qty=line.qty,
                weight=line.weight,
                rate=line.rate,
                amount=line.amount,
                line_no=index,
            )
        )
        index += 1
    return index


def _replace_lines(
    db: Session,
    production: OridDhallProduction,
    payload: OridDhallProductionCreate,
) -> None:
    production.lines.clear()
    db.flush()
    index = 1
    index = _add_lines(
        db,
        production,
        payload.raw_purchases,
        line_kind="raw",
        start_index=index,
    )
    _add_lines(
        db,
        production,
        payload.avg_purchases,
        line_kind="avg",
        start_index=index,
    )


def _apply_header(row: OridDhallProduction, payload: OridDhallProductionCreate) -> None:
    row.production_date = payload.production_date
    row.status = payload.status
    row.wet_flour_yield = payload.wet_flour_yield
    row.split_pct = payload.split_pct
    row.opening_bags = payload.opening_bags
    row.opening_rate = payload.opening_rate
    row.previous_batch_bags = payload.previous_batch_bags
    row.previous_batch_rate = payload.previous_batch_rate
    row.delivery_bags = payload.delivery_bags
    row.delivery_rate = payload.delivery_rate
    row.closing_bags = payload.closing_bags
    row.closing_rate = payload.closing_rate
    row.split_bags = payload.split_bags
    row.split_rate = payload.split_rate
    row.sortex_bags = payload.sortex_bags
    row.sortex_rate = payload.sortex_rate
    row.husk_bags = payload.husk_bags
    row.husk_rate = payload.husk_rate


def _sync_lot_no(row: OridDhallProduction) -> None:
    """Lot / batch no. is always the production row id."""
    row.lot_no = str(row.id)


def _line_out(line: OridDhallProductionLine) -> OridDhallPurchaseLineOut:
    return OridDhallPurchaseLineOut(
        id=line.id,
        line_kind=line.line_kind,  # type: ignore[arg-type]
        purchase_id=line.purchase_id,
        voucher_no=line.voucher_no,
        voucher_date=line.voucher_date,
        ledger_name=line.ledger_name,
        broker=line.broker,
        stock_item=line.stock_item,
        brand=line.brand,
        packing=line.packing,
        qty=line.qty,
        weight=line.weight,
        rate=line.rate,
        amount=line.amount,
        line_no=line.line_no,
    )


def to_out(row: OridDhallProduction) -> OridDhallProductionOut:
    raw_purchases = [_line_out(line) for line in row.lines if line.line_kind == "raw"]
    avg_purchases = [_line_out(line) for line in row.lines if line.line_kind == "avg"]
    return OridDhallProductionOut(
        id=row.id,
        production_date=row.production_date,
        lot_no=row.lot_no,
        status=row.status,  # type: ignore[arg-type]
        wet_flour_yield=row.wet_flour_yield,
        split_pct=row.split_pct,
        opening_bags=row.opening_bags,
        opening_rate=row.opening_rate,
        previous_batch_bags=row.previous_batch_bags,
        previous_batch_rate=row.previous_batch_rate,
        delivery_bags=row.delivery_bags,
        delivery_rate=row.delivery_rate,
        closing_bags=row.closing_bags,
        closing_rate=row.closing_rate,
        split_bags=row.split_bags,
        split_rate=row.split_rate,
        sortex_bags=row.sortex_bags,
        sortex_rate=row.sortex_rate,
        husk_bags=row.husk_bags,
        husk_rate=row.husk_rate,
        created_by=row.created_by,
        created_at=row.created_at,
        updated_at=row.updated_at,
        raw_purchases=raw_purchases,
        avg_purchases=avg_purchases,
    )


def create_production(
    db: Session,
    payload: OridDhallProductionCreate,
    *,
    created_by: Optional[int] = None,
) -> OridDhallProductionOut:
    _assert_vouchers_available(
        db,
        [line.voucher_no or "" for line in payload.raw_purchases],
        line_kind="raw",
    )
    _assert_vouchers_available(
        db,
        [line.voucher_no or "" for line in payload.avg_purchases],
        line_kind="avg",
    )
    row = OridDhallProduction(created_by=created_by)
    _apply_header(row, payload)
    db.add(row)
    db.flush()
    _sync_lot_no(row)
    _replace_lines(db, row, payload)
    db.commit()
    saved = get_by_id(db, row.id)
    assert saved is not None
    return to_out(saved)


def update_production(
    db: Session,
    production_id: int,
    payload: OridDhallProductionCreate,
) -> OridDhallProductionOut:
    row = get_by_id(db, production_id)
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Orid dhall production not found",
        )
    if row.status == "Closed":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Closed production cannot be updated; change status to Open first",
        )
    _assert_vouchers_available(
        db,
        [line.voucher_no or "" for line in payload.raw_purchases],
        line_kind="raw",
        exclude_production_id=production_id,
    )
    _assert_vouchers_available(
        db,
        [line.voucher_no or "" for line in payload.avg_purchases],
        line_kind="avg",
        exclude_production_id=production_id,
    )
    _apply_header(row, payload)
    _sync_lot_no(row)
    _replace_lines(db, row, payload)
    db.commit()
    saved = get_by_id(db, production_id)
    assert saved is not None
    return to_out(saved)


def update_production_status(
    db: Session,
    production_id: int,
    *,
    new_status: str,
) -> OridDhallProductionOut:
    row = get_by_id(db, production_id)
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Orid dhall production not found",
        )
    if new_status not in ("Open", "Closed"):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="status must be Open or Closed",
        )
    row.status = new_status
    db.commit()
    saved = get_by_id(db, production_id)
    assert saved is not None
    return to_out(saved)


def delete_production(db: Session, production_id: int) -> None:
    row = get_by_id(db, production_id)
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Orid dhall production not found",
        )
    db.delete(row)
    db.commit()
