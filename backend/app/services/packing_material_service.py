from __future__ import annotations

from datetime import date, datetime
from typing import Dict, List, Optional, Tuple

from fastapi import HTTPException, status
from sqlalchemy import func, or_
from sqlalchemy.orm import Session, joinedload

from app.models.packing_material import PackingPurchase, PackingSku, PackingStockFy
from app.models.tally import TallyInventoryMaster, TallySale
from app.schemas.packing_material import (
    PackingAdjustUpdate,
    PackingFyBulkUpdate,
    PackingFyStockListOut,
    PackingFyStockOut,
    PackingOpeningUpdate,
    PackingPurchaseCreate,
    PackingPurchaseListOut,
    PackingPurchaseOut,
    PackingPurchaseUpdate,
    PackingSkuOut,
    PackingSkuSyncOut,
)

PACKING_STOCK_GROUPS = (
    "Orid Dhall",
    "Orid Dhall Split",
    "Toor Dhall",
    "Moong Dhall",
)


def _normalize_brand(brand: Optional[str]) -> str:
    raw = (brand or "").strip()
    return raw if raw else "(Blank)"


def current_fy_start_year(today: Optional[date] = None) -> int:
    day = today or date.today()
    return day.year if day.month >= 4 else day.year - 1


def fy_label_from_start_year(start_year: int) -> str:
    """2026 → 2026-2027."""
    start = int(start_year)
    return f"{start}-{start + 1}"


def fy_start_year_from_label(fy: str | int) -> int:
    """2026-2027 → 2026. Also accepts 2627 or 2026."""
    raw = str(fy).strip()
    if "-" in raw:
        return int(raw.split("-", 1)[0])
    value = int(raw)
    if 1990 <= value <= 2100:
        return value
    # Compact 2627 → 2026
    return 2000 + (value // 100)


def current_fy(today: Optional[date] = None) -> str:
    return fy_label_from_start_year(current_fy_start_year(today))


def normalize_fy(fy: Optional[str | int] = None) -> str:
    """Normalize to yyyy-yyyy (e.g. 2026-2027)."""
    if fy is None or str(fy).strip() == "":
        return current_fy()
    return fy_label_from_start_year(fy_start_year_from_label(fy))


def prior_fy(fy: str | int) -> str:
    """Previous FY label, e.g. 2026-2027 → 2025-2026."""
    return fy_label_from_start_year(fy_start_year_from_label(normalize_fy(fy)) - 1)


def fy_for_date(day: date) -> str:
    """FY label containing the given date."""
    start_year = day.year if day.month >= 4 else day.year - 1
    return fy_label_from_start_year(start_year)


def fy_date_bounds(fy: str | int) -> Tuple[date, date]:
    start_year = fy_start_year_from_label(normalize_fy(fy))
    return date(start_year, 4, 1), date(start_year + 1, 3, 31)


def _closing(opening: float, purchase: float, sales: float, adjust: float = 0.0) -> float:
    return (
        float(opening or 0.0)
        + float(purchase or 0.0)
        - float(sales or 0.0)
        - float(adjust or 0.0)
    )


def _items_by_allowed_groups(db: Session) -> Dict[str, Tuple[str, Optional[str]]]:
    """stock_item.lower() -> (canonical stock_group, base_unit)."""
    group_filters = [g.lower() for g in PACKING_STOCK_GROUPS]
    rows = (
        db.query(
            TallyInventoryMaster.stock_item,
            TallyInventoryMaster.stock_group,
            TallyInventoryMaster.base_unit,
        )
        .filter(
            TallyInventoryMaster.stock_item.isnot(None),
            TallyInventoryMaster.stock_item != "",
            func.lower(TallyInventoryMaster.stock_group).in_(group_filters),
        )
        .all()
    )
    out: Dict[str, Tuple[str, Optional[str]]] = {}
    group_canon = {g.lower(): g for g in PACKING_STOCK_GROUPS}
    for stock_item, stock_group, base_unit in rows:
        name = (stock_item or "").strip()
        if not name:
            continue
        key = name.lower()
        if key in out:
            continue
        group_raw = (stock_group or "").strip()
        group = group_canon.get(group_raw.lower(), group_raw or None)
        out[key] = (group or "", (base_unit or "").strip() or None)
    return out


def _sales_sku_pairs(
    db: Session,
    *,
    allowed_items: Dict[str, Tuple[str, Optional[str]]],
) -> List[Tuple[str, str, str, Optional[str]]]:
    """Returns (stock_item, brand, stock_group, unit) from sales ∩ allowed groups."""
    if not allowed_items:
        return []

    inv_names = {
        r[0].strip(): r[0].strip()
        for r in (
            db.query(TallyInventoryMaster.stock_item)
            .filter(
                TallyInventoryMaster.stock_item.isnot(None),
                TallyInventoryMaster.stock_item != "",
                func.lower(TallyInventoryMaster.stock_group).in_(
                    [g.lower() for g in PACKING_STOCK_GROUPS]
                ),
            )
            .distinct()
            .all()
        )
        if r[0]
    }
    item_names = list(inv_names.values())
    if not item_names:
        return []

    rows = (
        db.query(TallySale.stock_item, TallySale.brand)
        .filter(
            TallySale.stock_item.in_(item_names),
            or_(
                TallySale.brand.is_(None),
                func.trim(TallySale.brand) == "",
                func.lower(func.trim(TallySale.brand)) != "x",
            ),
        )
        .distinct()
        .order_by(TallySale.stock_item.asc(), TallySale.brand.asc())
        .all()
    )

    pairs: List[Tuple[str, str, str, Optional[str]]] = []
    seen: set[Tuple[str, str]] = set()
    for stock_item, brand in rows:
        item = (stock_item or "").strip()
        brand_norm = _normalize_brand(brand)
        if not item:
            continue
        if brand_norm.lower() == "x":
            continue
        meta = allowed_items.get(item.lower())
        if not meta:
            continue
        key = (item.lower(), brand_norm.lower())
        if key in seen:
            continue
        seen.add(key)
        stock_group, unit = meta
        pairs.append((item, brand_norm, stock_group, unit))
    return pairs


def _fy_sales_by_pair(
    db: Session,
    *,
    item_names: List[str],
    date_from: date,
    date_to: date,
) -> Dict[Tuple[str, str], float]:
    if not item_names:
        return {}

    start_dt = datetime.combine(date_from, datetime.min.time())
    end_dt = datetime.combine(date_to, datetime.max.time())
    rows = (
        db.query(
            TallySale.stock_item,
            TallySale.brand,
            func.coalesce(func.sum(TallySale.qty), 0.0),
        )
        .filter(
            TallySale.voucher_date.isnot(None),
            TallySale.voucher_date >= start_dt,
            TallySale.voucher_date <= end_dt,
            TallySale.stock_item.in_(item_names),
            or_(
                TallySale.brand.is_(None),
                func.trim(TallySale.brand) == "",
                func.lower(func.trim(TallySale.brand)) != "x",
            ),
        )
        .group_by(TallySale.stock_item, TallySale.brand)
        .all()
    )

    by_key: Dict[Tuple[str, str], float] = {}
    for stock_item, brand, qty in rows:
        key = (
            (stock_item or "").strip().lower(),
            _normalize_brand(brand).lower(),
        )
        by_key[key] = by_key.get(key, 0.0) + float(qty or 0.0)
    return by_key


def _sales_sums_for_skus(
    db: Session,
    *,
    skus: List[PackingSku],
    date_from: date,
    date_to: date,
) -> Dict[int, float]:
    if not skus:
        return {}

    item_names = list({(sku.stock_item or "").strip() for sku in skus if sku.stock_item})
    by_key = _fy_sales_by_pair(
        db, item_names=item_names, date_from=date_from, date_to=date_to
    )
    return {
        sku.id: by_key.get(
            (
                (sku.stock_item or "").strip().lower(),
                (sku.brand or "").strip().lower(),
            ),
            0.0,
        )
        for sku in skus
    }


def _sku_out(row: PackingSku, *, sales_qty: float = 0.0) -> PackingSkuOut:
    return PackingSkuOut(
        id=row.id,
        stock_item=row.stock_item,
        brand=row.brand,
        stock_group=row.stock_group,
        unit=row.unit,
        is_active=row.is_active,
        created_at=row.created_at,
        opening_qty=None,
        purchase_qty=None,
        sales_qty=float(sales_qty or 0.0),
        closing_qty=None,
    )


STATUS_OPEN = "Open"
STATUS_FROZEN = "Frozen"


def _fy_stock_out(row: PackingStockFy) -> PackingFyStockOut:
    sku = row.sku
    return PackingFyStockOut(
        id=row.id,
        fy=row.fy,
        status=row.status or STATUS_OPEN,
        sku_id=row.sku_id,
        stock_item=sku.stock_item if sku else "",
        brand=sku.brand if sku else "",
        stock_group=sku.stock_group if sku else None,
        unit=sku.unit if sku else None,
        opening_qty=float(row.opening_qty or 0.0),
        purchase_qty=float(row.purchase_qty or 0.0),
        sales_qty=float(row.sales_qty or 0.0),
        adjust_qty=float(row.adjust_qty or 0.0),
        closing_qty=float(row.closing_qty or 0.0),
    )


def _fy_rows(db: Session, *, fy: str) -> List[PackingStockFy]:
    return (
        db.query(PackingStockFy)
        .options(joinedload(PackingStockFy.sku))
        .filter(PackingStockFy.fy == fy)
        .all()
    )


def _fy_is_frozen(rows: List[PackingStockFy]) -> bool:
    return any((row.status or STATUS_OPEN) == STATUS_FROZEN for row in rows)


def _ordered_stock_rows(
    rows: List[PackingStockFy],
) -> List[PackingFyStockOut]:
    def sort_key(row: PackingStockFy) -> Tuple[str, str, str]:
        sku = row.sku
        return (
            (sku.stock_group or "") if sku else "",
            (sku.stock_item or "") if sku else "",
            (sku.brand or "") if sku else "",
        )

    return [_fy_stock_out(row) for row in sorted(rows, key=sort_key)]


def _closing_by_sku_for_fy(db: Session, *, fy: str) -> Dict[int, float]:
    """sku_id -> closing_qty for rows with positive closing in the given FY."""
    rows = (
        db.query(PackingStockFy.sku_id, PackingStockFy.closing_qty)
        .filter(PackingStockFy.fy == fy)
        .all()
    )
    out: Dict[int, float] = {}
    for sku_id, closing_qty in rows:
        closing = float(closing_qty or 0.0)
        if closing > 0.0:
            out[int(sku_id)] = closing
    return out


def _row_is_listable(row: PackingStockFy) -> bool:
    """Show row when it has sales, purchases, or positive opening/closing stock."""
    return (
        float(row.sales_qty or 0.0) > 0.0
        or float(row.purchase_qty or 0.0) > 0.0
        or float(row.opening_qty or 0.0) > 0.0
        or float(row.closing_qty or 0.0) > 0.0
    )


def _purchase_sums_for_fy(db: Session, *, fy: str) -> Dict[int, float]:
    date_from, date_to = fy_date_bounds(fy)
    rows = (
        db.query(
            PackingPurchase.sku_id,
            func.coalesce(func.sum(PackingPurchase.qty), 0.0),
        )
        .filter(
            PackingPurchase.purchase_date >= date_from,
            PackingPurchase.purchase_date <= date_to,
        )
        .group_by(PackingPurchase.sku_id)
        .all()
    )
    return {int(sku_id): float(qty or 0.0) for sku_id, qty in rows}


def _upsert_skus_for_fy(db: Session, *, fy: str) -> None:
    """Upsert active SKUs that have sales in the FY, or prior-FY closing stock."""
    allowed = _items_by_allowed_groups(db)
    pairs = _sales_sku_pairs(db, allowed_items=allowed)
    date_from, date_to = fy_date_bounds(fy)
    item_names = list({item for item, _, _, _ in pairs})
    sales_by_key = _fy_sales_by_pair(
        db, item_names=item_names, date_from=date_from, date_to=date_to
    )
    pairs = [
        pair
        for pair in pairs
        if (sales_by_key.get((pair[0].lower(), pair[1].lower()), 0.0) or 0.0) > 0
    ]

    existing = {
        ((s.stock_item or "").strip().lower(), (s.brand or "").strip().lower()): s
        for s in db.query(PackingSku).all()
    }
    keep_keys: set[Tuple[str, str]] = set()

    for stock_item, brand, stock_group, unit in pairs:
        key = (stock_item.lower(), brand.lower())
        keep_keys.add(key)
        sku = existing.get(key)
        if sku is None:
            sku = PackingSku(
                stock_item=stock_item,
                brand=brand,
                stock_group=stock_group or None,
                unit=unit,
                is_active=True,
            )
            db.add(sku)
            db.flush()
            existing[key] = sku
        else:
            sku.stock_group = stock_group or sku.stock_group
            if unit:
                sku.unit = unit
            sku.is_active = True

    # Also keep SKUs with prior-FY positive closing (carry-forward stock).
    prior_closing = _closing_by_sku_for_fy(db, fy=prior_fy(fy))
    if prior_closing:
        by_id = {s.id: s for s in existing.values()}
        for sku_id in prior_closing:
            sku = by_id.get(sku_id)
            if sku is None:
                continue
            key = (
                (sku.stock_item or "").strip().lower(),
                (sku.brand or "").strip().lower(),
            )
            keep_keys.add(key)
            sku.is_active = True

    for key, sku in existing.items():
        if key in keep_keys:
            continue
        if sku.is_active:
            sku.is_active = False

    db.flush()


def _skus_for_fy_stock(
    db: Session,
    *,
    fy: str,
) -> Tuple[List[PackingSku], Dict[int, float], Dict[int, float], Dict[int, float]]:
    """SKUs to sync for FY: sales, prior/current positive closing, or purchases."""
    prior_closing = _closing_by_sku_for_fy(db, fy=prior_fy(fy))
    current_closing = _closing_by_sku_for_fy(db, fy=fy)
    purchase_by_id = _purchase_sums_for_fy(db, fy=fy)
    keep_extra_ids = set(prior_closing) | set(current_closing) | set(purchase_by_id)

    query = db.query(PackingSku)
    if keep_extra_ids:
        query = query.filter(
            or_(PackingSku.is_active.is_(True), PackingSku.id.in_(list(keep_extra_ids)))
        )
    else:
        query = query.filter(PackingSku.is_active.is_(True))
    skus = query.order_by(
        PackingSku.stock_group.asc(),
        PackingSku.stock_item.asc(),
        PackingSku.brand.asc(),
    ).all()
    date_from, date_to = fy_date_bounds(fy)
    sales_by_id = _sales_sums_for_skus(
        db, skus=skus, date_from=date_from, date_to=date_to
    )
    kept: List[PackingSku] = []
    for sku in skus:
        has_sales = (sales_by_id.get(sku.id, 0.0) or 0.0) > 0
        if has_sales or sku.id in keep_extra_ids:
            if not sku.is_active:
                sku.is_active = True
            kept.append(sku)
    if kept:
        db.flush()
    return kept, sales_by_id, prior_closing, purchase_by_id


def ensure_fy_stock_rows(
    db: Session,
    *,
    fy: Optional[str | int] = None,
    commit: bool = True,
    refresh: bool = True,
) -> PackingFyStockListOut:
    """Ensure FY stock rows for SKUs with sales or positive closing; refresh sales."""
    fy_code = normalize_fy(fy)
    existing_rows = _fy_rows(db, fy=fy_code)
    frozen = _fy_is_frozen(existing_rows)

    if frozen or not refresh:
        return PackingFyStockListOut(
            fy=fy_code,
            frozen=frozen,
            rows=_ordered_stock_rows([r for r in existing_rows if _row_is_listable(r)]),
        )

    skus, sales_by_id, prior_closing, purchase_by_id = _skus_for_fy_stock(db, fy=fy_code)
    existing = {row.sku_id: row for row in existing_rows}
    status = STATUS_OPEN
    keep_ids: set[int] = set()

    for sku in skus:
        sales = float(sales_by_id.get(sku.id, 0.0) or 0.0)
        prior = float(prior_closing.get(sku.id, 0.0) or 0.0)
        purchase = float(purchase_by_id.get(sku.id, 0.0) or 0.0)
        if sales <= 0.0 and prior <= 0.0 and purchase <= 0.0:
            continue

        row = existing.get(sku.id)
        # Opening is always prior-FY positive closing (read-only).
        opening = prior if prior > 0.0 else 0.0
        if row is None:
            row = PackingStockFy(
                sku_id=sku.id,
                fy=fy_code,
                status=status,
                opening_qty=opening,
                purchase_qty=purchase,
                sales_qty=sales,
                adjust_qty=0.0,
                closing_qty=_closing(opening, purchase, sales, 0.0),
            )
            db.add(row)
            db.flush()
            row.sku = sku
            existing[sku.id] = row
        else:
            row.opening_qty = opening
            row.purchase_qty = purchase
            row.sales_qty = sales
            row.closing_qty = _closing(
                opening, purchase, sales, row.adjust_qty
            )

        keep_ids.add(sku.id)

    for sku_id, row in list(existing.items()):
        if sku_id in keep_ids and _row_is_listable(row):
            continue
        db.delete(row)
        existing.pop(sku_id, None)

    if commit:
        db.commit()
        existing_rows = _fy_rows(db, fy=fy_code)
    else:
        db.flush()
        existing_rows = list(existing.values())

    return PackingFyStockListOut(
        fy=fy_code,
        frozen=False,
        rows=_ordered_stock_rows([r for r in existing_rows if _row_is_listable(r)]),
    )


def list_fy_stock(
    db: Session,
    *,
    fy: Optional[str | int] = None,
) -> PackingFyStockListOut:
    """Fast load: return stored FY rows only (no sales sync)."""
    fy_code = normalize_fy(fy)
    existing_rows = _fy_rows(db, fy=fy_code)
    return PackingFyStockListOut(
        fy=fy_code,
        frozen=_fy_is_frozen(existing_rows),
        rows=_ordered_stock_rows([r for r in existing_rows if _row_is_listable(r)]),
    )


def refresh_fy_stock(
    db: Session,
    *,
    fy: Optional[str | int] = None,
) -> PackingFyStockListOut:
    """Populate/refresh SKUs for the FY from Tally + prior closing (blocked when frozen)."""
    fy_code = normalize_fy(fy)
    existing_rows = _fy_rows(db, fy=fy_code)
    if _fy_is_frozen(existing_rows):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Packing stock is frozen for this FY",
        )

    _upsert_skus_for_fy(db, fy=fy_code)
    return ensure_fy_stock_rows(db, fy=fy_code, commit=True, refresh=True)


def set_fy_frozen(
    db: Session,
    *,
    fy: Optional[str | int] = None,
    frozen: bool,
) -> PackingFyStockListOut:
    fy_code = normalize_fy(fy)

    if frozen:
        rows = _fy_rows(db, fy=fy_code)
        if not rows:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No packing stock to freeze. Click Refresh FY first.",
            )
        for row in rows:
            row.status = STATUS_FROZEN
        db.commit()
        return PackingFyStockListOut(
            fy=fy_code,
            frozen=True,
            rows=_ordered_stock_rows(_fy_rows(db, fy=fy_code)),
        )

    rows = _fy_rows(db, fy=fy_code)
    for row in rows:
        row.status = STATUS_OPEN
    db.commit()
    return list_fy_stock(db, fy=fy_code)


def update_fy_opening(
    db: Session,
    *,
    sku_id: int,
    fy: str | int,
    payload: PackingOpeningUpdate,
) -> PackingFyStockOut:
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Opening is read-only and always brought forward from prior FY closing. Use Adjust for stock differences.",
    )


def update_fy_adjust(
    db: Session,
    *,
    sku_id: int,
    fy: str | int,
    payload: PackingAdjustUpdate,
) -> PackingFyStockOut:
    fy_code = normalize_fy(fy)
    existing_rows = _fy_rows(db, fy=fy_code)
    if _fy_is_frozen(existing_rows):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Packing stock is frozen for this FY",
        )

    sku = db.query(PackingSku).filter(PackingSku.id == sku_id).first()
    if sku is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="SKU not found")

    prior_closing = _closing_by_sku_for_fy(db, fy=prior_fy(fy_code))
    opening = float(prior_closing.get(sku_id, 0.0) or 0.0)

    row = (
        db.query(PackingStockFy)
        .options(joinedload(PackingStockFy.sku))
        .filter(
            PackingStockFy.sku_id == sku_id,
            PackingStockFy.fy == fy_code,
        )
        .first()
    )
    if row is None:
        date_from, date_to = fy_date_bounds(fy_code)
        sales = _sales_sums_for_skus(
            db, skus=[sku], date_from=date_from, date_to=date_to
        ).get(sku.id, 0.0)
        adjust = float(payload.adjust_qty)
        row = PackingStockFy(
            sku_id=sku.id,
            fy=fy_code,
            status=STATUS_OPEN,
            opening_qty=opening,
            purchase_qty=0.0,
            sales_qty=float(sales or 0.0),
            adjust_qty=adjust,
            closing_qty=_closing(opening, 0.0, sales, adjust),
        )
        db.add(row)
    else:
        row.opening_qty = opening
        row.adjust_qty = float(payload.adjust_qty)
        row.closing_qty = _closing(
            row.opening_qty, row.purchase_qty, row.sales_qty, row.adjust_qty
        )

    db.commit()
    db.refresh(row)
    if row.sku is None:
        row.sku = sku
    return _fy_stock_out(row)


def bulk_update_fy_rows(
    db: Session,
    *,
    fy: Optional[str | int] = None,
    payload: PackingFyBulkUpdate,
) -> PackingFyStockListOut:
    fy_code = normalize_fy(fy)
    existing_rows = _fy_rows(db, fy=fy_code)
    if _fy_is_frozen(existing_rows):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Packing stock is frozen for this FY",
        )
    if not payload.rows:
        return list_fy_stock(db, fy=fy_code)

    prior_closing = _closing_by_sku_for_fy(db, fy=prior_fy(fy_code))
    by_sku = {row.sku_id: row for row in existing_rows}
    for item in payload.rows:
        row = by_sku.get(item.sku_id)
        if row is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Stock row not found for sku_id={item.sku_id}",
            )
        # Opening stays brought-forward from prior FY; only Adjust is editable.
        opening = float(prior_closing.get(item.sku_id, 0.0) or 0.0)
        row.opening_qty = opening
        row.adjust_qty = float(item.adjust_qty)
        row.closing_qty = _closing(
            row.opening_qty, row.purchase_qty, row.sales_qty, row.adjust_qty
        )

    db.commit()
    return list_fy_stock(db, fy=fy_code)


def list_skus(db: Session, *, active_only: bool = True) -> List[PackingSkuOut]:
    query = db.query(PackingSku)
    if active_only:
        query = query.filter(PackingSku.is_active.is_(True))
    rows = query.order_by(
        PackingSku.stock_group.asc(),
        PackingSku.stock_item.asc(),
        PackingSku.brand.asc(),
    ).all()

    fy_code = current_fy()
    date_from, date_to = fy_date_bounds(fy_code)
    sales_by_id = _sales_sums_for_skus(
        db, skus=rows, date_from=date_from, date_to=date_to
    )
    return [
        _sku_out(row, sales_qty=sales_by_id.get(row.id, 0.0))
        for row in rows
        if (sales_by_id.get(row.id, 0.0) or 0.0) > 0
    ]


def sync_skus_from_sales(
    db: Session,
    *,
    fy: Optional[str | int] = None,
) -> PackingSkuSyncOut:
    """Upsert SKUs from sales for an FY and seed FY stock rows (blocked when frozen)."""
    fy_code = normalize_fy(fy)
    if _fy_is_frozen(_fy_rows(db, fy=fy_code)):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Packing stock is frozen for this FY",
        )

    before = {s.id for s in db.query(PackingSku).filter(PackingSku.is_active.is_(True)).all()}
    _upsert_skus_for_fy(db, fy=fy_code)
    db.commit()
    stock = ensure_fy_stock_rows(db, fy=fy_code, commit=True, refresh=True)
    after_active = {
        s.id: s for s in db.query(PackingSku).filter(PackingSku.is_active.is_(True)).all()
    }
    created = len([sid for sid in after_active if sid not in before])
    skus = list_skus(db, active_only=True)

    return PackingSkuSyncOut(
        stock_groups=list(PACKING_STOCK_GROUPS),
        sku_count=len(stock.rows),
        created_skus=created,
        reactivated_skus=0,
        deactivated_skus=0,
        fy=fy_code,
        skus=skus,
    )


def list_purchase_suppliers(db: Session) -> List[str]:
    rows = (
        db.query(PackingPurchase.supplier)
        .filter(
            PackingPurchase.supplier.isnot(None),
            PackingPurchase.supplier != "",
        )
        .distinct()
        .order_by(PackingPurchase.supplier.asc())
        .all()
    )
    return [str(name).strip() for (name,) in rows if str(name or "").strip()]


def _ensure_fy_row_for_purchase(
    db: Session,
    *,
    sku: PackingSku,
    fy_code: str,
) -> PackingStockFy:
    existing_rows = _fy_rows(db, fy=fy_code)
    if _fy_is_frozen(existing_rows):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Packing stock is frozen for this FY",
        )

    row = next((r for r in existing_rows if r.sku_id == sku.id), None)
    prior = float(_closing_by_sku_for_fy(db, fy=prior_fy(fy_code)).get(sku.id, 0.0) or 0.0)
    opening = prior if prior > 0.0 else 0.0
    date_from, date_to = fy_date_bounds(fy_code)
    sales = float(
        _sales_sums_for_skus(
            db, skus=[sku], date_from=date_from, date_to=date_to
        ).get(sku.id, 0.0)
        or 0.0
    )
    purchase = float(_purchase_sums_for_fy(db, fy=fy_code).get(sku.id, 0.0) or 0.0)

    if row is None:
        row = PackingStockFy(
            sku_id=sku.id,
            fy=fy_code,
            status=STATUS_OPEN,
            opening_qty=opening,
            purchase_qty=purchase,
            sales_qty=sales,
            adjust_qty=0.0,
            closing_qty=_closing(opening, purchase, sales, 0.0),
        )
        db.add(row)
        db.flush()
        row.sku = sku
    else:
        row.opening_qty = opening
        row.purchase_qty = purchase
        row.sales_qty = sales
        row.closing_qty = _closing(
            opening, purchase, sales, row.adjust_qty
        )
    return row


def create_purchase(
    db: Session,
    *,
    payload: PackingPurchaseCreate,
    fy: Optional[str | int] = None,
) -> Tuple[PackingPurchaseOut, PackingFyStockListOut]:
    sku = db.query(PackingSku).filter(PackingSku.id == payload.sku_id).first()
    if sku is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="SKU not found")

    fy_code = _validate_purchase_date(payload.purchase_date, fy=fy)
    supplier = (payload.supplier or "").strip() or None
    purchase = PackingPurchase(
        sku_id=sku.id,
        purchase_date=payload.purchase_date,
        qty=float(payload.qty),
        rate=float(payload.rate) if payload.rate is not None else None,
        supplier=supplier,
    )
    db.add(purchase)
    db.flush()

    sku.is_active = True
    _ensure_fy_row_for_purchase(db, sku=sku, fy_code=fy_code)
    db.commit()
    db.refresh(purchase)

    stock = list_fy_stock(db, fy=fy_code)
    return _purchase_out(purchase, sku=sku, fy=fy_code), stock


def list_purchases_for_sku(
    db: Session,
    *,
    sku_id: int,
    fy: Optional[str | int] = None,
) -> PackingPurchaseListOut:
    fy_code = normalize_fy(fy)
    sku = db.query(PackingSku).filter(PackingSku.id == sku_id).first()
    if sku is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="SKU not found")

    date_from, date_to = fy_date_bounds(fy_code)
    rows = (
        db.query(PackingPurchase)
        .filter(
            PackingPurchase.sku_id == sku_id,
            PackingPurchase.purchase_date >= date_from,
            PackingPurchase.purchase_date <= date_to,
        )
        .order_by(PackingPurchase.purchase_date.desc(), PackingPurchase.id.desc())
        .all()
    )
    return PackingPurchaseListOut(
        fy=fy_code,
        sku_id=sku.id,
        stock_item=sku.stock_item,
        brand=sku.brand,
        rows=[_purchase_out(row, sku=sku, fy=fy_code) for row in rows],
    )


def update_purchase(
    db: Session,
    *,
    purchase_id: int,
    payload: PackingPurchaseUpdate,
    fy: Optional[str | int] = None,
) -> Tuple[PackingPurchaseOut, PackingFyStockListOut]:
    purchase = (
        db.query(PackingPurchase)
        .options(joinedload(PackingPurchase.sku))
        .filter(PackingPurchase.id == purchase_id)
        .first()
    )
    if purchase is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Purchase not found")

    sku = purchase.sku or db.query(PackingSku).filter(PackingSku.id == purchase.sku_id).first()
    if sku is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="SKU not found")

    old_fy = fy_for_date(purchase.purchase_date)
    fy_code = _validate_purchase_date(payload.purchase_date, fy=fy or old_fy)

    # Keep edits within the FY currently being viewed when provided.
    if fy is not None and fy_for_date(payload.purchase_date) != normalize_fy(fy):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Purchase date must fall within FY {normalize_fy(fy)}",
        )

    if _fy_is_frozen(_fy_rows(db, fy=old_fy)) or _fy_is_frozen(_fy_rows(db, fy=fy_code)):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Packing stock is frozen for this FY",
        )

    purchase.purchase_date = payload.purchase_date
    purchase.qty = float(payload.qty)
    purchase.rate = float(payload.rate) if payload.rate is not None else None
    purchase.supplier = (payload.supplier or "").strip() or None
    db.flush()

    _ensure_fy_row_for_purchase(db, sku=sku, fy_code=fy_code)
    if old_fy != fy_code:
        _ensure_fy_row_for_purchase(db, sku=sku, fy_code=old_fy)

    db.commit()
    db.refresh(purchase)
    stock = list_fy_stock(db, fy=fy_code)
    return _purchase_out(purchase, sku=sku, fy=fy_code), stock


def delete_purchase(
    db: Session,
    *,
    purchase_id: int,
    fy: Optional[str | int] = None,
) -> PackingFyStockListOut:
    purchase = (
        db.query(PackingPurchase)
        .options(joinedload(PackingPurchase.sku))
        .filter(PackingPurchase.id == purchase_id)
        .first()
    )
    if purchase is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Purchase not found")

    sku = purchase.sku or db.query(PackingSku).filter(PackingSku.id == purchase.sku_id).first()
    purchase_fy = fy_for_date(purchase.purchase_date)
    fy_code = normalize_fy(fy) if fy is not None else purchase_fy

    if _fy_is_frozen(_fy_rows(db, fy=purchase_fy)):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Packing stock is frozen for this FY",
        )

    db.delete(purchase)
    db.flush()
    if sku is not None:
        _ensure_fy_row_for_purchase(db, sku=sku, fy_code=purchase_fy)
    db.commit()
    return list_fy_stock(db, fy=fy_code)


def _validate_purchase_date(
    purchase_date: date,
    *,
    fy: Optional[str | int] = None,
) -> str:
    date_fy = fy_for_date(purchase_date)
    fy_code = normalize_fy(fy) if fy is not None else date_fy
    if date_fy != fy_code:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Purchase date must fall within FY {fy_code}",
        )
    date_from, date_to = fy_date_bounds(fy_code)
    if purchase_date < date_from or purchase_date > date_to:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Purchase date must be between {date_from.isoformat()} and {date_to.isoformat()}",
        )
    return fy_code


def _purchase_out(
    purchase: PackingPurchase,
    *,
    sku: PackingSku,
    fy: str,
) -> PackingPurchaseOut:
    return PackingPurchaseOut(
        id=purchase.id,
        sku_id=purchase.sku_id,
        purchase_date=purchase.purchase_date,
        qty=float(purchase.qty),
        rate=float(purchase.rate) if purchase.rate is not None else None,
        supplier=purchase.supplier,
        stock_item=sku.stock_item,
        brand=sku.brand,
        fy=fy,
        created_at=purchase.created_at,
    )
