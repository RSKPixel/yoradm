"""Receivables for the mobile app, always limited to the salesman's mapped reps."""

from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime
from typing import Any, Dict, List, Optional

from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.tally import TallySyncAccount, TallySyncReceivable, TallySyncSale
from app.schemas.mobile import (
    MobileBill,
    MobileInvoiceDetail,
    MobileInvoiceLine,
    MobilePartyDetail,
    MobilePartyRow,
    MobileReceivableSummary,
    MobileRepTotal,
)
from app.schemas.tally import ReceivableAgeingBuckets
from app.services.tally_service import _add_amount, _age_bucket, _empty_buckets


def _narrow(reps: List[str], rep: Optional[str]) -> List[str]:
    """Optional single-rep filter, only ever within the phone's own reps."""
    if rep is None:
        return reps
    if rep not in reps:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your representative")
    return [rep]


def _scoped_rows(db: Session, reps: List[str], ledger: Optional[str] = None) -> List[TallySyncReceivable]:
    # No mapped reps means no data, never "all reps".
    if not reps:
        return []
    query = db.query(TallySyncReceivable).filter(func.trim(TallySyncReceivable.representative).in_(reps))
    if ledger is not None:
        query = query.filter(func.trim(TallySyncReceivable.ledger_name) == ledger)
    return query.order_by(TallySyncReceivable.invoice_date.asc(), TallySyncReceivable.id.asc()).all()


def _days(row: TallySyncReceivable, as_of: date) -> Optional[int]:
    value = row.invoice_date
    if isinstance(value, datetime):
        value = value.date()
    if not isinstance(value, date):
        return None
    return max((as_of - value).days, 0)


def _buckets(data: Dict[str, Any]) -> ReceivableAgeingBuckets:
    return ReceivableAgeingBuckets(**data)


def summary(db: Session, reps: List[str], rep: Optional[str] = None) -> MobileReceivableSummary:
    reps = _narrow(reps, rep)
    as_of = date.today()
    totals = _empty_buckets()
    by_rep: Dict[str, Dict[str, Any]] = {name: {"total": 0.0, "count": 0} for name in reps}
    for row in _scoped_rows(db, reps):
        amount = float(row.amount or 0.0)
        _add_amount(totals, _age_bucket(_days(row, as_of)), amount)
        rep = by_rep[(row.representative or "").strip()]
        rep["total"] += amount
        rep["count"] += 1

    synced_at = None
    if reps:
        synced_at = (
            db.query(func.max(TallySyncReceivable.as_on))
            .filter(func.trim(TallySyncReceivable.representative).in_(reps))
            .scalar()
        )
    return MobileReceivableSummary(
        as_of=as_of.isoformat(),
        synced_at=synced_at,
        totals=_buckets(totals),
        reps=[MobileRepTotal(name=name, total=v["total"], invoice_count=v["count"]) for name, v in by_rep.items()],
    )


def parties(db: Session, reps: List[str], rep: Optional[str] = None) -> List[MobilePartyRow]:
    reps = _narrow(reps, rep)
    as_of = date.today()
    party_map: Dict[str, Dict[str, Any]] = defaultdict(_empty_buckets)
    oldest: Dict[str, Optional[int]] = {}
    for row in _scoped_rows(db, reps):
        ledger = (row.ledger_name or "").strip() or "(No party)"
        days = _days(row, as_of)
        _add_amount(party_map[ledger], _age_bucket(days), float(row.amount or 0.0))
        if days is not None and (oldest.get(ledger) is None or days > oldest[ledger]):
            oldest[ledger] = days

    items = [
        MobilePartyRow(ledger_name=ledger, oldest_days=oldest.get(ledger), **data)
        for ledger, data in party_map.items()
    ]
    items.sort(key=lambda p: (-p.total, p.ledger_name.lower()))
    return items


def has_party(db: Session, reps: List[str], ledger: str) -> bool:
    return bool(ledger.strip()) and bool(_scoped_rows(db, reps, ledger=ledger.strip()))


def party_detail(db: Session, reps: List[str], ledger: str, rep: Optional[str] = None) -> MobilePartyDetail:
    reps = _narrow(reps, rep)
    ledger = ledger.strip()
    rows = _scoped_rows(db, reps, ledger=ledger) if ledger else []
    # Same answer for "no such party" and "not your party", so names can't be probed.
    if not rows:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Party not found")

    as_of = date.today()
    totals = _empty_buckets()
    bills: List[MobileBill] = []
    for row in rows:
        amount = float(row.amount or 0.0)
        days = _days(row, as_of)
        bucket = _age_bucket(days)
        _add_amount(totals, bucket, amount)
        bills.append(
            MobileBill(
                invoice_no=row.invoice_no,
                invoice_date=row.invoice_date,
                due_date=row.due_date,
                representative=(row.representative or "").strip() or None,
                amount=amount,
                days=days,
                age_bucket=bucket,
            )
        )

    account = (
        db.query(TallySyncAccount.phone, TallySyncAccount.mobile)
        .filter(func.trim(TallySyncAccount.ledger_name) == ledger)
        .first()
    )
    return MobilePartyDetail(
        ledger_name=ledger,
        phone=(account.phone or "").strip() or None if account else None,
        mobile=(account.mobile or "").strip() or None if account else None,
        totals=_buckets(totals),
        bills=bills,
    )


def invoice_detail(
    db: Session, reps: List[str], ledger: str, invoice_no: str, rep: Optional[str] = None
) -> MobileInvoiceDetail:
    """Sales lines for one outstanding bill. The bill must be in the phone's own receivables."""
    reps = _narrow(reps, rep)
    ledger, invoice_no = ledger.strip(), invoice_no.strip()
    rows = _scoped_rows(db, reps, ledger=ledger) if ledger else []
    bills = [r for r in rows if (r.invoice_no or "").strip() == invoice_no]
    if not invoice_no or not bills:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bill not found")

    bill = bills[0]
    query = db.query(TallySyncSale).filter(
        TallySyncSale.voucher_no == invoice_no,
        func.trim(TallySyncSale.ledger_name) == ledger,
    )
    # Date too, so a voucher number reused in another year can't match.
    if bill.invoice_date is not None:
        query = query.filter(func.date(TallySyncSale.voucher_date) == func.date(bill.invoice_date))
    lines = query.order_by(TallySyncSale.item_no.asc(), TallySyncSale.id.asc()).all()

    return MobileInvoiceDetail(
        invoice_no=invoice_no,
        ledger_name=ledger,
        invoice_date=bill.invoice_date,
        representative=(bill.representative or "").strip() or None,
        outstanding=sum(float(r.amount or 0.0) for r in bills),
        days=_days(bill, date.today()),
        found=bool(lines),
        broker=next(((l.broker or "").strip() for l in lines if (l.broker or "").strip()), None),
        lines=[
            MobileInvoiceLine(
                stock_item=l.stock_item,
                brand=l.brand,
                packing=l.packing,
                qty=l.qty,
                qty_alt=l.qty_alt,
                alternate_unit=l.alternate_unit,
                rate=l.rate,
                amount=l.amount,
                discount=l.discount,
                cartage=l.cartage,
            )
            for l in lines
        ],
        total_qty=sum(float(l.qty or 0.0) for l in lines),
        total_amount=sum(float(l.amount or 0.0) for l in lines),
    )
