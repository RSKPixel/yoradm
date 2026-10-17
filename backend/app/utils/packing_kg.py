"""Resolve bag packing (kg) from Tally data only — no assumed 50 kg packing."""

from __future__ import annotations

from typing import Optional

from sqlalchemy.orm import Session

from app.models.tally import TallySyncInventory, TallySyncSale

# Standard bag unit for qty × packing_kg → 50 kg bag count (not a packing fallback).
STANDARD_BAG_KG = 50.0


class MissingPackingError(ValueError):
    def __init__(
        self,
        *,
        stock_item: str | None = None,
        voucher_no: str | None = None,
    ) -> None:
        item = str(stock_item or "").strip() or "?"
        voucher = str(voucher_no or "").strip()
        if voucher:
            message = (
                f"Missing packing in Tally for stock item {item!r} "
                f"(invoice {voucher}). Update tallysync_sales or inventory master."
            )
        else:
            message = (
                f"Missing packing in Tally for stock item {item!r}. "
                "Update tallysync_inventory."
            )
        super().__init__(message)
        self.stock_item = item
        self.voucher_no = voucher


def resolve_packing_kg(
    *,
    packing: float | None = None,
    tally_packing: float | None = None,
    inventory_packing: float | None = None,
) -> Optional[float]:
    """Resolve packing kg: line → tally sale → tally inventory master."""
    if packing is not None:
        return float(packing)
    if tally_packing is not None:
        return float(tally_packing)
    if inventory_packing is not None:
        return float(inventory_packing)
    return None


def require_packing_kg(
    *,
    packing: float | None = None,
    tally_packing: float | None = None,
    inventory_packing: float | None = None,
    stock_item: str | None = None,
    voucher_no: str | None = None,
) -> float:
    resolved = resolve_packing_kg(
        packing=packing,
        tally_packing=tally_packing,
        inventory_packing=inventory_packing,
    )
    if resolved is None:
        raise MissingPackingError(stock_item=stock_item, voucher_no=voucher_no)
    return resolved


def inventory_packing_map(db: Session) -> dict[str, float]:
    """Packing from tallysync_inventory keyed by stock_item."""
    return {
        str(row[0]).strip(): float(row[1])
        for row in (
            db.query(TallySyncInventory.stock_item, TallySyncInventory.packing)
            .filter(
                TallySyncInventory.stock_item.isnot(None),
                TallySyncInventory.stock_item != "",
                TallySyncInventory.packing.isnot(None),
            )
            .all()
        )
        if row[0] and str(row[0]).strip() and row[1] is not None
    }


def tally_packing_for_line(
    db: Session,
    *,
    voucher_no: str | None,
    stock_item: str | None,
    qty: float | None = None,
) -> Optional[float]:
    """Packing from tallysync_sales for a voucher + stock item."""
    voucher = str(voucher_no or "").strip()
    item = str(stock_item or "").strip()
    if not voucher or not item:
        return None

    base = db.query(TallySyncSale.packing).filter(
        TallySyncSale.voucher_no == voucher,
        TallySyncSale.stock_item == item,
        TallySyncSale.packing.isnot(None),
    )
    if qty is not None:
        row = base.filter(TallySyncSale.qty == qty).order_by(TallySyncSale.id.desc()).first()
        if row and row[0] is not None:
            return float(row[0])

    row = base.order_by(TallySyncSale.id.desc()).first()
    if row and row[0] is not None:
        return float(row[0])
    return None


def resolve_packing_kg_from_db(
    db: Session,
    *,
    packing: float | None = None,
    stock_item: str | None = None,
    voucher_no: str | None = None,
    qty: float | None = None,
    inventory_packing: dict[str, float] | None = None,
) -> Optional[float]:
    item = str(stock_item or "").strip()
    inv_map = inventory_packing if inventory_packing is not None else inventory_packing_map(db)
    tally_packing = tally_packing_for_line(
        db,
        voucher_no=voucher_no,
        stock_item=item or None,
        qty=qty,
    )
    return resolve_packing_kg(
        packing=packing,
        tally_packing=tally_packing,
        inventory_packing=inv_map.get(item) if item else None,
    )


def require_packing_kg_from_db(
    db: Session,
    *,
    packing: float | None = None,
    stock_item: str | None = None,
    voucher_no: str | None = None,
    qty: float | None = None,
    inventory_packing: dict[str, float] | None = None,
) -> float:
    item = str(stock_item or "").strip()
    inv_map = inventory_packing if inventory_packing is not None else inventory_packing_map(db)
    tally_packing = tally_packing_for_line(
        db,
        voucher_no=voucher_no,
        stock_item=item or None,
        qty=qty,
    )
    return require_packing_kg(
        packing=packing,
        tally_packing=tally_packing,
        inventory_packing=inv_map.get(item) if item else None,
        stock_item=item or None,
        voucher_no=voucher_no,
    )


def bags_50_from_qty(qty: float, packing_kg: float) -> float:
    return float(qty or 0.0) * float(packing_kg) / STANDARD_BAG_KG
