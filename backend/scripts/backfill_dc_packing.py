#!/usr/bin/env python3
"""Backfill delivery challan detail packing from tallydata_sales."""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.db.session import SessionLocal
from app.models.delivery_challan import DeliveryChallanDetail
from app.models.tally import TallySale


def _norm(value: str | None) -> str:
    return (value or "").strip().lower()


def main() -> None:
    db = SessionLocal()
    try:
        details = (
            db.query(DeliveryChallanDetail)
            .filter(DeliveryChallanDetail.packing.is_(None))
            .order_by(DeliveryChallanDetail.id.asc())
            .all()
        )
        if not details:
            print("No delivery challan lines need packing backfill.")
            return

        voucher_nos = sorted({d.voucher_no for d in details if d.voucher_no})
        sales = (
            db.query(TallySale)
            .filter(
                TallySale.voucher_no.in_(voucher_nos),
                TallySale.packing.isnot(None),
            )
            .all()
        )

        # voucher_no -> list of sales rows with packing
        by_voucher: dict[str, list[TallySale]] = {}
        for sale in sales:
            key = sale.voucher_no or ""
            by_voucher.setdefault(key, []).append(sale)

        updated = 0
        unmatched = 0

        for detail in details:
            candidates = by_voucher.get(detail.voucher_no or "", [])
            if not candidates:
                unmatched += 1
                continue

            stock = _norm(detail.stock_item)
            brand = _norm(detail.brand)

            match = next(
                (
                    sale
                    for sale in candidates
                    if _norm(sale.stock_item) == stock and _norm(sale.brand) == brand
                ),
                None,
            )
            if match is None:
                # Fallback: stock item only when brand is blank on either side.
                match = next(
                    (
                        sale
                        for sale in candidates
                        if _norm(sale.stock_item) == stock
                        and (not brand or not _norm(sale.brand) or _norm(sale.brand) == brand)
                    ),
                    None,
                )
            if match is None and detail.qty is not None:
                match = next(
                    (
                        sale
                        for sale in candidates
                        if _norm(sale.stock_item) == stock
                        and sale.qty is not None
                        and float(sale.qty) == float(detail.qty)
                    ),
                    None,
                )

            if match is None or match.packing is None:
                unmatched += 1
                continue

            detail.packing = float(match.packing)
            updated += 1

        db.commit()
        print(
            f"Packing backfill complete: updated={updated} "
            f"unmatched={unmatched} scanned={len(details)}"
        )
    finally:
        db.close()


if __name__ == "__main__":
    main()
