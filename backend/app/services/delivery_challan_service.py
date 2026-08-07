from __future__ import annotations

from datetime import date, datetime
from math import ceil
from typing import Optional, Tuple

from fastapi import HTTPException, status
from sqlalchemy import case, func
from sqlalchemy.orm import Session, joinedload

from app.models.delivery_challan import DeliveryChallan, DeliveryChallanDetail
from app.models.tally import TallyInventoryMaster, TallySale
from app.schemas.delivery_challan import (
    DeliveryChallanCreate,
    DeliveryChallanListItem,
    PendingDeliveriesOut,
    PendingDeliveryByStockGroupOut,
    PendingDeliveryInvoiceOut,
    PendingDeliveryLineOut,
)
from app.utils.packing_kg import (
    MissingPackingError,
    STANDARD_BAG_KG,
    bags_50_from_qty,
    inventory_packing_map,
    require_packing_kg,
    require_packing_kg_from_db,
    resolve_packing_kg_from_db,
)

# Ignore older invoices — project rolled out mid-stream; earlier ones are mostly delivered.
PENDING_DELIVERY_FROM = date(2026, 7, 12)


def _inventory_packing_subquery(db: Session):
    return (
        db.query(
            TallyInventoryMaster.stock_item.label("stock_item"),
            func.max(TallyInventoryMaster.packing).label("packing"),
        )
        .filter(
            TallyInventoryMaster.stock_item.isnot(None),
            TallyInventoryMaster.stock_item != "",
        )
        .group_by(TallyInventoryMaster.stock_item)
        .subquery("inv_packing")
    )


def _packing_kg_expr(inventory_packing_subq):
    return func.coalesce(
        DeliveryChallanDetail.packing,
        inventory_packing_subq.c.packing,
    )


def _bags_50_expr(packing_kg_expr):
    return case(
        (
            packing_kg_expr.isnot(None),
            (func.coalesce(DeliveryChallanDetail.qty, 0.0) * packing_kg_expr)
            / STANDARD_BAG_KG,
        ),
        else_=None,
    )


def _http_missing_packing(error: MissingPackingError) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        detail=str(error),
    )


def _assert_batch_details_have_packing(
    db: Session,
    *,
    batch_no: str,
    stock_items: list[str],
) -> None:
    inv_packing = _inventory_packing_subquery(db)
    packing_kg = _packing_kg_expr(inv_packing)
    rows = (
        db.query(
            DeliveryChallanDetail.stock_item,
            DeliveryChallanDetail.voucher_no,
        )
        .join(DeliveryChallan, DeliveryChallanDetail.challan_id == DeliveryChallan.id)
        .outerjoin(
            inv_packing,
            DeliveryChallanDetail.stock_item == inv_packing.c.stock_item,
        )
        .filter(
            func.trim(DeliveryChallan.batch_no) == batch_no,
            DeliveryChallanDetail.stock_item.in_(stock_items),
            packing_kg.is_(None),
        )
        .distinct()
        .all()
    )
    if not rows:
        return
    item, voucher = rows[0]
    raise _http_missing_packing(
        MissingPackingError(stock_item=item, voucher_no=voucher),
    )


def backfill_delivery_detail_packing(
    db: Session,
    *,
    reresolve_all: bool = False,
) -> int:
    """Persist Tally-resolved packing on DC lines (tally sale → inventory master)."""
    inventory = inventory_packing_map(db)
    query = db.query(DeliveryChallanDetail)
    if not reresolve_all:
        query = query.filter(DeliveryChallanDetail.packing.is_(None))
    rows = query.all()
    if not rows:
        return 0

    updated = 0
    for detail in rows:
        resolved = resolve_packing_kg_from_db(
            db,
            packing=None,
            stock_item=detail.stock_item,
            voucher_no=detail.voucher_no,
            qty=detail.qty,
            inventory_packing=inventory,
        )
        if resolved is None:
            continue
        if reresolve_all or detail.packing is None:
            detail.packing = resolved
            updated += 1
    db.commit()
    return updated


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
    batch_no: Optional[str] = None,
    page: int = 1,
    page_size: int = 50,
) -> Tuple[list[DeliveryChallanListItem], int]:
    query = db.query(DeliveryChallan)
    if date_from is not None:
        query = query.filter(DeliveryChallan.challan_date >= date_from)
    if date_to is not None:
        query = query.filter(DeliveryChallan.challan_date <= date_to)
    batch = (batch_no or "").strip()
    if batch:
        query = query.filter(func.trim(DeliveryChallan.batch_no).like(f"%{batch}%"))

    total = query.count()
    rows = (
        query.options(joinedload(DeliveryChallan.details))
        .order_by(DeliveryChallan.challan_date.desc(), DeliveryChallan.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    inventory_packing = inventory_packing_map(db)
    items: list[DeliveryChallanListItem] = []
    for row in rows:
        invoice_nos: set[str] = set()
        total_qty = 0.0
        for detail in row.details:
            if detail.voucher_no:
                invoice_nos.add(detail.voucher_no)
            packing_kg = require_packing_kg_from_db(
                db,
                packing=detail.packing,
                stock_item=detail.stock_item,
                voucher_no=detail.voucher_no,
                qty=detail.qty,
                inventory_packing=inventory_packing,
            )
            total_qty += bags_50_from_qty(float(detail.qty or 0.0), packing_kg)
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


def pending_deliveries_by_stock_group(db: Session) -> PendingDeliveriesOut:
    """Pending sale lines (not on a DC), grouped by inventory stock group.

    Bag totals: (qty × packing) / 50 and (qty × packing) / 100.
    Packing resolves tally sale line → tally inventory master.
    Raises if Tally packing is missing.
    """
    used_voucher_nos = (
        db.query(DeliveryChallanDetail.voucher_no)
        .filter(
            DeliveryChallanDetail.voucher_no.isnot(None),
            DeliveryChallanDetail.voucher_no != "",
        )
        .distinct()
    )
    cutoff = datetime.combine(PENDING_DELIVERY_FROM, datetime.min.time())
    stock_group_by_item = _stock_group_by_item(db)
    inventory_packing = inventory_packing_map(db)

    lines = (
        db.query(
            TallySale.voucher_no,
            TallySale.voucher_date,
            TallySale.ledger_name,
            TallySale.stock_item,
            TallySale.brand,
            TallySale.qty,
            TallySale.packing,
            TallySale.amount,
        )
        .filter(
            TallySale.voucher_no.isnot(None),
            TallySale.voucher_no != "",
            TallySale.stock_item.isnot(None),
            TallySale.stock_item != "",
            TallySale.voucher_date.isnot(None),
            TallySale.voucher_date >= cutoff,
            ~TallySale.voucher_no.in_(used_voucher_nos),
        )
        .order_by(TallySale.voucher_date.desc(), TallySale.voucher_no.desc(), TallySale.id.asc())
        .all()
    )

    by_group: dict[str, PendingDeliveryByStockGroupOut] = {}
    # voucher aggregates within each stock group
    invoice_map: dict[tuple[str, str], PendingDeliveryInvoiceOut] = {}
    all_voucher_nos: set[str] = set()
    grand_50 = 0.0
    grand_100 = 0.0
    grand_amount = 0.0
    grand_weight = 0.0

    for line in lines:
        voucher_no = (line.voucher_no or "").strip()
        stock_item = (line.stock_item or "").strip()
        if not voucher_no or not stock_item:
            continue

        stock_group = stock_group_by_item.get(stock_item.lower()) or "—"
        qty = float(line.qty or 0.0)
        amount = float(line.amount or 0.0)
        packing_raw = float(line.packing) if line.packing is not None else None
        packing = require_packing_kg(
            packing=packing_raw,
            inventory_packing=inventory_packing.get(stock_item),
            stock_item=stock_item,
            voucher_no=voucher_no,
        )
        weight = qty * packing
        bags_50 = weight / STANDARD_BAG_KG
        bags_100 = weight / 100.0
        avg_rate = (amount / weight) * 100.0 if weight > 0 else 0.0
        detail = PendingDeliveryLineOut(
            stock_item=stock_item,
            brand=(line.brand or "").strip() or None,
            packing=packing_raw,
            qty=qty,
            amount=amount,
            weight=weight,
            bags_50=bags_50,
            bags_100=bags_100,
            avg_rate=round(avg_rate, 2),
        )

        group = by_group.get(stock_group)
        if group is None:
            group = PendingDeliveryByStockGroupOut(stock_group=stock_group)
            by_group[stock_group] = group

        inv_key = (stock_group, voucher_no)
        invoice = invoice_map.get(inv_key)
        if invoice is None:
            invoice = PendingDeliveryInvoiceOut(
                voucher_no=voucher_no,
                voucher_date=line.voucher_date,
                ledger_name=line.ledger_name,
            )
            invoice_map[inv_key] = invoice
            group.invoices.append(invoice)
            group.invoice_count += 1
            all_voucher_nos.add(voucher_no)
        else:
            if line.voucher_date and (
                invoice.voucher_date is None or line.voucher_date < invoice.voucher_date
            ):
                invoice.voucher_date = line.voucher_date
            if not invoice.ledger_name and line.ledger_name:
                invoice.ledger_name = line.ledger_name

        invoice.lines.append(detail)
        invoice.bags_50 += bags_50
        invoice.bags_100 += bags_100
        invoice.amount += amount
        invoice.weight += weight
        invoice.avg_rate = (
            round((invoice.amount / invoice.weight) * 100.0, 2) if invoice.weight > 0 else 0.0
        )
        group.bags_50 += bags_50
        group.bags_100 += bags_100
        group.amount += amount
        group.weight += weight
        grand_50 += bags_50
        grand_100 += bags_100
        grand_amount += amount
        grand_weight += weight

    items = sorted(by_group.values(), key=lambda item: (-item.invoice_count, item.stock_group))
    for item in items:
        item.avg_rate = (
            round((item.amount / item.weight) * 100.0, 2) if item.weight > 0 else 0.0
        )
        item.invoices.sort(
            key=lambda inv: (
                inv.voucher_date is None,
                -(inv.voucher_date.toordinal() if inv.voucher_date else 0),
                inv.voucher_no,
            )
        )

    return PendingDeliveriesOut(
        items=items,
        total_invoices=len(all_voucher_nos),
        bags_50=grand_50,
        bags_100=grand_100,
        amount=grand_amount,
        weight=grand_weight,
        avg_rate=round((grand_amount / grand_weight) * 100.0, 2) if grand_weight > 0 else 0.0,
    )


def today_deliveries_by_stock_group(
    db: Session,
    *,
    on_date: Optional[date] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
) -> PendingDeliveriesOut:
    """Delivery challan lines for a day or date range, grouped by stock group.

    Bag totals match pending: (qty × packing) / 50 and / 100.
    Packing resolves DC line → tally sale → tally inventory master.
    Raises if Tally packing is missing.
    """
    if date_from is not None or date_to is not None:
        start = date_from or date_to or date.today()
        end = date_to or date_from or date.today()
    else:
        start = end = on_date or date.today()
    if start > end:
        start, end = end, start

    stock_group_by_item = _stock_group_by_item(db)
    inventory_packing = inventory_packing_map(db)

    lines = (
        db.query(DeliveryChallanDetail)
        .join(DeliveryChallan, DeliveryChallanDetail.challan_id == DeliveryChallan.id)
        .filter(
            DeliveryChallan.challan_date >= start,
            DeliveryChallan.challan_date <= end,
        )
        .order_by(
            DeliveryChallanDetail.voucher_date.desc(),
            DeliveryChallanDetail.voucher_no.desc(),
            DeliveryChallanDetail.id.asc(),
        )
        .all()
    )

    by_group: dict[str, PendingDeliveryByStockGroupOut] = {}
    invoice_map: dict[tuple[str, str], PendingDeliveryInvoiceOut] = {}
    all_voucher_nos: set[str] = set()
    grand_50 = 0.0
    grand_100 = 0.0
    grand_amount = 0.0
    grand_weight = 0.0

    for line in lines:
        voucher_no = (line.voucher_no or "").strip()
        stock_item = (line.stock_item or "").strip()
        if not voucher_no or not stock_item:
            continue

        stock_group = stock_group_by_item.get(stock_item.lower()) or "—"
        qty = float(line.qty or 0.0)
        amount = float(line.amount or 0.0)
        packing_raw = float(line.packing) if line.packing is not None else None
        packing = require_packing_kg_from_db(
            db,
            packing=packing_raw,
            stock_item=stock_item,
            voucher_no=voucher_no,
            qty=qty,
            inventory_packing=inventory_packing,
        )
        weight = qty * packing
        bags_50 = weight / STANDARD_BAG_KG
        bags_100 = weight / 100.0
        avg_rate = (amount / weight) * 100.0 if weight > 0 else 0.0
        detail = PendingDeliveryLineOut(
            stock_item=stock_item,
            brand=(line.brand or "").strip() or None,
            packing=packing_raw if packing_raw is not None else packing,
            qty=qty,
            amount=amount,
            weight=weight,
            bags_50=bags_50,
            bags_100=bags_100,
            avg_rate=round(avg_rate, 2),
        )

        group = by_group.get(stock_group)
        if group is None:
            group = PendingDeliveryByStockGroupOut(stock_group=stock_group)
            by_group[stock_group] = group

        inv_key = (stock_group, voucher_no)
        invoice = invoice_map.get(inv_key)
        voucher_dt = _parse_optional_datetime(line.voucher_date)
        if invoice is None:
            invoice = PendingDeliveryInvoiceOut(
                voucher_no=voucher_no,
                voucher_date=voucher_dt,
                ledger_name=line.ledger_name,
            )
            invoice_map[inv_key] = invoice
            group.invoices.append(invoice)
            group.invoice_count += 1
            all_voucher_nos.add(voucher_no)
        else:
            if voucher_dt and (
                invoice.voucher_date is None or voucher_dt < invoice.voucher_date
            ):
                invoice.voucher_date = voucher_dt
            if not invoice.ledger_name and line.ledger_name:
                invoice.ledger_name = line.ledger_name

        invoice.lines.append(detail)
        invoice.bags_50 += bags_50
        invoice.bags_100 += bags_100
        invoice.amount += amount
        invoice.weight += weight
        invoice.avg_rate = (
            round((invoice.amount / invoice.weight) * 100.0, 2) if invoice.weight > 0 else 0.0
        )
        group.bags_50 += bags_50
        group.bags_100 += bags_100
        group.amount += amount
        group.weight += weight
        grand_50 += bags_50
        grand_100 += bags_100
        grand_amount += amount
        grand_weight += weight

    items = sorted(by_group.values(), key=lambda item: (-item.invoice_count, item.stock_group))
    for item in items:
        item.avg_rate = (
            round((item.amount / item.weight) * 100.0, 2) if item.weight > 0 else 0.0
        )
        item.invoices.sort(
            key=lambda inv: (
                inv.voucher_date is None,
                -(inv.voucher_date.toordinal() if inv.voucher_date else 0),
                inv.voucher_no,
            )
        )

    return PendingDeliveriesOut(
        items=items,
        total_invoices=len(all_voucher_nos),
        bags_50=grand_50,
        bags_100=grand_100,
        amount=grand_amount,
        weight=grand_weight,
        avg_rate=round((grand_amount / grand_weight) * 100.0, 2) if grand_weight > 0 else 0.0,
    )


def _parse_optional_datetime(value: Optional[str | datetime | date]) -> Optional[datetime]:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value
    if isinstance(value, date):
        return datetime.combine(value, datetime.min.time())
    text = str(value).strip()
    if not text:
        return None
    for fmt in ("%Y-%m-%d", "%d-%m-%Y", "%Y/%m/%d", "%d/%m/%Y"):
        try:
            return datetime.strptime(text[:10], fmt)
        except ValueError:
            continue
    try:
        return datetime.fromisoformat(text.replace("Z", "+00:00")).replace(tzinfo=None)
    except ValueError:
        return None


def _stock_group_by_item(db: Session) -> dict[str, str]:
    """Lowercased stock_item → stock_group from inventory master."""
    rows = (
        db.query(TallyInventoryMaster.stock_item, TallyInventoryMaster.stock_group)
        .filter(
            TallyInventoryMaster.stock_item.isnot(None),
            TallyInventoryMaster.stock_item != "",
            TallyInventoryMaster.stock_group.isnot(None),
            TallyInventoryMaster.stock_group != "",
        )
        .all()
    )
    lookup: dict[str, str] = {}
    for stock_item, stock_group in rows:
        key = (stock_item or "").strip().lower()
        group = (stock_group or "").strip()
        if key and group and key not in lookup:
            lookup[key] = group
    return lookup


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

    Bags per line: (qty × packing) / 50.
    Packing resolves detail.packing → tally sale → tally inventory master.
    Raises if any matching line lacks Tally packing.
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

    _assert_batch_details_have_packing(db, batch_no=batch, stock_items=stock_items)

    detail_filter = (
        func.trim(DeliveryChallan.batch_no) == batch,
        DeliveryChallanDetail.stock_item.in_(stock_items),
    )

    inv_packing = _inventory_packing_subquery(db)
    packing_kg = _packing_kg_expr(inv_packing)
    bag_expr = _bags_50_expr(packing_kg)
    net_amount_expr = func.coalesce(DeliveryChallanDetail.amount, 0.0) + func.coalesce(
        DeliveryChallanDetail.discount, 0.0
    )

    row = (
        db.query(
            func.coalesce(func.sum(bag_expr), 0.0),
            func.coalesce(func.sum(net_amount_expr), 0.0),
        )
        .join(DeliveryChallan, DeliveryChallanDetail.challan_id == DeliveryChallan.id)
        .outerjoin(
            inv_packing,
            DeliveryChallanDetail.stock_item == inv_packing.c.stock_item,
        )
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

    _assert_batch_details_have_packing(db, batch_no=batch, stock_items=stock_items)

    inv_packing = _inventory_packing_subquery(db)
    packing_kg = _packing_kg_expr(inv_packing)
    bag_expr = _bags_50_expr(packing_kg)

    rows = (
        db.query(
            DeliveryChallan.challan_date,
            func.coalesce(func.sum(bag_expr), 0.0),
        )
        .join(DeliveryChallanDetail, DeliveryChallanDetail.challan_id == DeliveryChallan.id)
        .outerjoin(
            inv_packing,
            DeliveryChallanDetail.stock_item == inv_packing.c.stock_item,
        )
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


def _resolve_line_packing_kg(db: Session, line) -> float:
    try:
        return require_packing_kg_from_db(
            db,
            packing=line.packing,
            stock_item=line.stock_item,
            voucher_no=line.voucher_no,
            qty=line.qty,
        )
    except MissingPackingError as error:
        raise _http_missing_packing(error) from error


def _replace_details(db: Session, challan: DeliveryChallan, payload: DeliveryChallanCreate) -> None:
    challan.details.clear()
    db.flush()
    for index, line in enumerate(payload.lines, start=1):
        amount, discount = _sale_money_for_line(db, line)
        packing = _resolve_line_packing_kg(db, line)
        db.add(
            DeliveryChallanDetail(
                challan_id=challan.id,
                voucher_no=line.voucher_no,
                voucher_date=line.voucher_date,
                ledger_name=line.ledger_name,
                stock_item=line.stock_item,
                brand=line.brand,
                packing=packing,
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
