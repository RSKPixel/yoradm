from collections import defaultdict
from datetime import date, datetime
from math import ceil
from typing import Any, Dict, List, Optional, Sequence, Set, Tuple, Type

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
from app.models.tds_working import TdsWorking
from app.schemas import DashboardStats
from app.schemas.tally import (
    CollectionAgeBucketOut,
    CollectionPerformanceOut,
    DaybookAvailabilityOut,
    DaybookTradeOut,
    DaybookTradePointOut,
    InventoryItemOptionOut,
    ReceivableAgeingBuckets,
    ReceivableAnalysisOut,
    ReceivableInvoiceAgeingOut,
    ReceivablePartyAgeingOut,
    ReceivableRepresentativeOut,
    SaleInvoiceOptionOut,
    TdsWorkingsOut,
    TdsWorkingsRow,
    TdsExpenseMatchApplyOut,
    TdsExpenseMatchCandidate,
    TdsExpenseMatchOut,
    VendorOptionOut,
    VendorTdsStatusOut,
)

VENDOR_PRIMARY_GROUPS = ("Sundry Creditors", "Sundry Debtors")

SALES_VTYPE = "SIVENDHI BILLING"
PURCHASE_VTYPE = "Purchase"
RECEIPT_VTYPE = "Receipt"
PAYMENT_VTYPE = "Payment"
JOURNAL_VTYPE = "Journal"
TDS_PAYABLE_LEDGER = "TDS Payable"
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


def daybook_availability(db: Session) -> DaybookAvailabilityOut:
    """Min/max VDT from daybook2 — synced Tally data window."""
    row = db.query(
        func.min(TallyDaybook2.vdt).label("date_from"),
        func.max(TallyDaybook2.vdt).label("date_to"),
    ).one()

    def to_date(value: Any) -> Optional[date]:
        if value is None:
            return None
        if isinstance(value, datetime):
            return value.date()
        if isinstance(value, date):
            return value
        return None

    return DaybookAvailabilityOut(
        date_from=to_date(row.date_from),
        date_to=to_date(row.date_to),
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


def list_vendors(db: Session) -> List[VendorOptionOut]:
    """Party ledgers under Sundry Creditors / Sundry Debtors."""
    rows = (
        db.query(TallyAccountMaster.ledger_name, TallyAccountMaster.primary_group)
        .filter(
            TallyAccountMaster.primary_group.in_(VENDOR_PRIMARY_GROUPS),
            TallyAccountMaster.ledger_name.isnot(None),
            TallyAccountMaster.ledger_name != "",
        )
        .order_by(TallyAccountMaster.ledger_name.asc())
        .all()
    )
    return [
        VendorOptionOut(ledger_name=row.ledger_name, primary_group=row.primary_group)
        for row in rows
        if row.ledger_name
    ]


def list_inventory_items(db: Session) -> List[InventoryItemOptionOut]:
    rows = (
        db.query(
            TallyInventoryMaster.stock_item,
            TallyInventoryMaster.stock_group,
            TallyInventoryMaster.packing,
        )
        .filter(
            TallyInventoryMaster.stock_item.isnot(None),
            TallyInventoryMaster.stock_item != "",
        )
        .order_by(TallyInventoryMaster.stock_item.asc())
        .all()
    )
    return [
        InventoryItemOptionOut(
            stock_item=row.stock_item,
            stock_group=row.stock_group,
            packing=row.packing,
        )
        for row in rows
        if row.stock_item
    ]


def _indian_fy_bounds(as_of: date) -> Tuple[date, date]:
    """Indian FY: 1 Apr → 31 Mar containing as_of."""
    if as_of.month >= 4:
        start = date(as_of.year, 4, 1)
        end = date(as_of.year + 1, 3, 31)
    else:
        start = date(as_of.year - 1, 4, 1)
        end = date(as_of.year, 3, 31)
    return start, end


def sum_vendor_purchases(
    db: Session,
    *,
    ledger_name: str,
    date_from: date,
    date_to: date,
) -> float:
    """Sum Purchase (New Ref) ledger amounts for a vendor in a date range."""
    name = (ledger_name or "").strip()
    if not name:
        return 0.0
    start_dt = datetime.combine(date_from, datetime.min.time())
    end_dt = datetime.combine(date_to, datetime.max.time())
    total = (
        db.query(func.coalesce(func.sum(TallyDaybook2.ledger_amount), 0.0))
        .filter(
            TallyDaybook2.vtype == PURCHASE_VTYPE,
            TallyDaybook2.bill_type == PARTY_BILL_TYPE_NEW,
            TallyDaybook2.ledger_name == name,
            TallyDaybook2.vdt.isnot(None),
            TallyDaybook2.vdt >= start_dt,
            TallyDaybook2.vdt <= end_dt,
        )
        .scalar()
    )
    return float(total or 0.0)


def vendor_tds_status(
    db: Session,
    *,
    ledger_name: str,
    invoice_value: float = 0.0,
    as_of: Optional[date] = None,
) -> VendorTdsStatusOut:
    from app.services import company_service

    vendor = (ledger_name or "").strip()
    invoice = float(invoice_value or 0.0)
    if invoice < 0:
        invoice = 0.0
    as_of_date = as_of or date.today()
    fy_start, fy_end = _indian_fy_bounds(as_of_date)
    # Purchases in this FY up to the receipt date (not beyond it).
    period_end = min(as_of_date, fy_end)

    purchase_total = sum_vendor_purchases(
        db,
        ledger_name=vendor,
        date_from=fy_start,
        date_to=period_end,
    ) if vendor else 0.0
    projected = purchase_total + invoice

    company = company_service.get_company(db)
    pct = float(company.tds_purchase_pct) if company and company.tds_purchase_pct is not None else None
    threshold = float(company.tds_threshold) if company and company.tds_threshold is not None else None

    applicable = (
        vendor != ""
        and pct is not None
        and pct > 0
        and threshold is not None
        and threshold >= 0
        and invoice > 0
        and projected >= threshold
    )
    tds_value = (
        float((invoice * pct / 100.0 // 5) * 5)
        if applicable and pct is not None
        else None
    )

    return VendorTdsStatusOut(
        vendor=vendor,
        purchase_total=purchase_total,
        invoice_value=invoice,
        projected_total=projected,
        tds_purchase_pct=pct,
        tds_threshold=threshold,
        tds_applicable=applicable,
        tds_value=tds_value,
        fy_start=fy_start.isoformat(),
        fy_end=fy_end.isoformat(),
    )


def _daybook_vdt_date(value: Any) -> Optional[date]:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    return None


def _voucher_key(vno: Optional[str], vdt: Any) -> Optional[Tuple[str, str]]:
    no = (vno or "").strip()
    day = _daybook_vdt_date(vdt)
    if not no or day is None:
        return None
    return (no, day.isoformat())


def _resolve_tds_party(
    siblings: Sequence[TallyDaybook2],
    party_groups: Dict[str, str],
) -> Optional[str]:
    """Pick party ledger from Journal sibling lines (exclude TDS Payable)."""
    candidates: List[Tuple[str, float, bool]] = []
    for row in siblings:
        name = (row.ledger_name or "").strip()
        if not name or name.casefold() == TDS_PAYABLE_LEDGER.casefold():
            continue
        amount = abs(float(row.ledger_amount or 0.0))
        is_party = party_groups.get(name.casefold(), "") in {
            g.casefold() for g in VENDOR_PRIMARY_GROUPS
        }
        candidates.append((name, amount, is_party))
    if not candidates:
        return None
    party_candidates = [c for c in candidates if c[2]]
    pool = party_candidates or candidates
    pool.sort(key=lambda c: c[1], reverse=True)
    return pool[0][0]


def _resolve_tds_bill(
    line: TallyDaybook2,
    siblings: Sequence[TallyDaybook2],
    party: Optional[str],
) -> Tuple[Optional[str], Optional[str]]:
    """Bill ref from the TDS line, else the party sibling, else any sibling with a bill."""
    bill_no = (line.bill_no or "").strip() or None
    bill_type = (line.bill_type or "").strip() or None
    if bill_no:
        return bill_no, bill_type

    ordered: List[TallyDaybook2] = []
    if party:
        party_cf = party.casefold()
        ordered.extend(
            row
            for row in siblings
            if (row.ledger_name or "").strip().casefold() == party_cf
        )
    ordered.extend(
        row
        for row in siblings
        if (row.ledger_name or "").strip()
        and (row.ledger_name or "").strip().casefold() != TDS_PAYABLE_LEDGER.casefold()
        and row not in ordered
    )
    for row in ordered:
        sibling_bill = (row.bill_no or "").strip() or None
        if sibling_bill:
            return sibling_bill, (row.bill_type or "").strip() or None
    return None, bill_type


def _expense_lookup_key(party: Optional[str], bill_no: Optional[str]) -> Optional[Tuple[str, str]]:
    name = (party or "").strip()
    bill = (bill_no or "").strip()
    if not name or not bill:
        return None
    return (name.casefold(), bill)


def _pan_from_account(pan: Optional[str], party_gstin: Optional[str]) -> Optional[str]:
    """If PAN is set use it; otherwise take chars 3–12 from GSTIN."""
    pan_value = (pan or "").strip()
    if pan_value:
        return pan_value.upper()
    gstin = "".join(ch for ch in (party_gstin or "").strip().upper() if ch.isalnum())
    if len(gstin) >= 12:
        return gstin[2:12]
    return None


def _load_expense_refs(
    db: Session,
    party_bill_pairs: Sequence[Tuple[str, str]],
) -> Dict[Tuple[str, str], Tuple[Optional[date], float, int]]:
    """Map (party_cf, bill_no) → (vdt date, ledger_amount, daybook id) from New Ref rows."""
    pairs = {
        (party.strip(), bill.strip())
        for party, bill in party_bill_pairs
        if (party or "").strip() and (bill or "").strip()
    }
    if not pairs:
        return {}

    parties = sorted({party for party, _ in pairs})
    bill_nos = sorted({bill for _, bill in pairs})
    wanted = {_expense_lookup_key(party, bill) for party, bill in pairs}

    expense_rows = (
        db.query(TallyDaybook2)
        .filter(
            TallyDaybook2.bill_type == PARTY_BILL_TYPE_NEW,
            TallyDaybook2.ledger_name.in_(parties),
            TallyDaybook2.bill_no.in_(bill_nos),
            TallyDaybook2.vdt.isnot(None),
        )
        .order_by(TallyDaybook2.vdt.asc(), TallyDaybook2.id.asc())
        .all()
    )

    result: Dict[Tuple[str, str], Tuple[Optional[date], float, int]] = {}
    for row in expense_rows:
        key = _expense_lookup_key(row.ledger_name, row.bill_no)
        if key is None or key not in wanted or key in result:
            continue
        result[key] = (
            _daybook_vdt_date(row.vdt),
            float(row.ledger_amount or 0.0),
            int(row.id),
        )
    return result


TDS_STATUS_MATCHED = "matched"
TDS_STATUS_NEW = "new"
TDS_STATUS_DELETED = "deleted"


def _parse_iso_date(value: Optional[str]) -> Optional[date]:
    text = (value or "").strip()
    if not text:
        return None
    try:
        return date.fromisoformat(text[:10])
    except ValueError:
        return None


def _tds_row_from_saved(row: TdsWorking, *, status: str) -> TdsWorkingsRow:
    return TdsWorkingsRow(
        source_id=int(row.source_id),
        voucher_date=row.voucher_date.isoformat() if row.voucher_date else None,
        voucher_no=(row.voucher_no or None),
        party=(row.party or None),
        pan=(row.pan or None),
        tds_head=(row.tds_head or None),
        amount=float(row.amount or 0.0),
        narration=(row.narration or None),
        bill_no=(row.bill_no or None),
        bill_type=(row.bill_type or None),
        expenses_date=row.expenses_date.isoformat() if row.expenses_date else None,
        expenses_amount=(
            float(row.expenses_amount) if row.expenses_amount is not None else None
        ),
        expense_source_id=(
            int(row.expense_source_id) if row.expense_source_id is not None else None
        ),
        status=status,
    )


def _tds_entity_from_row(row: TdsWorkingsRow) -> TdsWorking:
    return TdsWorking(
        source_id=int(row.source_id),
        voucher_date=_parse_iso_date(row.voucher_date),
        voucher_no=(row.voucher_no or None),
        party=(row.party or None),
        pan=(row.pan or None),
        tds_head=(row.tds_head or None),
        amount=float(row.amount or 0.0),
        narration=(row.narration or None),
        bill_no=(row.bill_no or None),
        bill_type=(row.bill_type or None),
        expenses_date=_parse_iso_date(row.expenses_date),
        expenses_amount=(
            float(row.expenses_amount) if row.expenses_amount is not None else None
        ),
        expense_source_id=row.expense_source_id,
    )


def _apply_live_fields(target: TdsWorking, live: TdsWorkingsRow) -> None:
    target.voucher_date = _parse_iso_date(live.voucher_date)
    target.voucher_no = live.voucher_no or None
    target.party = live.party or None
    target.pan = live.pan or None
    target.tds_head = live.tds_head or None
    target.amount = float(live.amount or 0.0)
    target.narration = live.narration or None
    target.bill_no = live.bill_no or None
    target.bill_type = live.bill_type or None
    if target.expenses_date is None and target.expenses_amount is None:
        target.expenses_date = _parse_iso_date(live.expenses_date)
        target.expenses_amount = (
            float(live.expenses_amount) if live.expenses_amount is not None else None
        )


def _saved_has_manual_expenses(saved: TdsWorking) -> bool:
    return (
        saved.expenses_date is not None
        or saved.expenses_amount is not None
        or saved.expense_source_id is not None
    )


def _expense_claim_from_saved(saved: TdsWorking) -> Dict[str, Any]:
    return {
        "expenses_date": saved.expenses_date.isoformat() if saved.expenses_date else None,
        "expenses_amount": (
            float(saved.expenses_amount) if saved.expenses_amount is not None else None
        ),
        "expense_source_id": (
            int(saved.expense_source_id) if saved.expense_source_id is not None else None
        ),
    }


def _infer_expense_source_id(
    db: Session,
    *,
    party: Optional[str],
    expenses_date: Optional[date],
    expenses_amount: Optional[float],
) -> Optional[int]:
    """Best-effort daybook id for legacy rows saved without expense_source_id."""
    name = (party or "").strip()
    if not name or expenses_date is None:
        return None
    start_dt = datetime.combine(expenses_date, datetime.min.time())
    end_dt = datetime.combine(expenses_date, datetime.max.time())
    query = db.query(TallyDaybook2.id).filter(
        TallyDaybook2.ledger_name == name,
        TallyDaybook2.vdt.isnot(None),
        TallyDaybook2.vdt >= start_dt,
        TallyDaybook2.vdt <= end_dt,
        func.lower(TallyDaybook2.debit_credit) == "cr",
    )
    if expenses_amount is not None:
        query = query.filter(TallyDaybook2.ledger_amount == float(expenses_amount))
    ids = [int(row[0]) for row in query.all()]
    if len(ids) != 1:
        return None
    return ids[0]


def _other_claimed_expense_source_ids(
    db: Session,
    *,
    except_tds_source_id: int,
) -> Set[int]:
    """Daybook Cr line ids already linked to a different TDS working row."""
    claimed: Set[int] = set()
    rows = (
        db.query(
            TdsWorking.source_id,
            TdsWorking.expense_source_id,
            TdsWorking.party,
            TdsWorking.expenses_date,
            TdsWorking.expenses_amount,
        )
        .filter(
            or_(
                TdsWorking.expense_source_id.isnot(None),
                TdsWorking.expenses_date.isnot(None),
                TdsWorking.expenses_amount.isnot(None),
            )
        )
        .all()
    )
    for tds_source_id, expense_source_id, party, exp_date, exp_amount in rows:
        if int(tds_source_id) == int(except_tds_source_id):
            continue
        if expense_source_id is not None:
            claimed.add(int(expense_source_id))
            continue
        inferred = _infer_expense_source_id(
            db,
            party=party,
            expenses_date=exp_date,
            expenses_amount=exp_amount,
        )
        if inferred is not None:
            claimed.add(inferred)
    return claimed


def _assert_expense_source_available(
    db: Session,
    *,
    expense_source_id: Optional[int],
    tds_source_id: int,
) -> None:
    if expense_source_id is None:
        return
    expense_id = int(expense_source_id)
    existing = (
        db.query(TdsWorking.source_id)
        .filter(
            TdsWorking.expense_source_id == expense_id,
            TdsWorking.source_id != int(tds_source_id),
        )
        .first()
    )
    if existing is not None:
        raise ValueError("This expense transaction is already matched to another TDS line")


def _score_cr_expense_row(
    row: TallyDaybook2,
    *,
    tds_date: date,
    journal_bill_no: Optional[str],
) -> int:
    dc = (row.debit_credit or "").strip().casefold()
    if dc != "cr":
        return -1
    row_day = _daybook_vdt_date(row.vdt)
    if row_day is None or row_day > tds_date:
        return -1

    score = 0
    if journal_bill_no:
        row_bill = (row.bill_no or "").strip()
        if row_bill and row_bill == journal_bill_no:
            score += 100
    if row_day == tds_date:
        score += 50
    else:
        days = abs((row_day - tds_date).days)
        score += max(0, 20 - min(days, 20))
    if (row.bill_type or "").strip() == PARTY_BILL_TYPE_NEW:
        score += 30
    if (row.vtype or "").strip().casefold() == PURCHASE_VTYPE.casefold():
        score += 5
    return score


def _load_journal_siblings_for_line(
    db: Session,
    line: TallyDaybook2,
    *,
    tds_date: date,
) -> List[TallyDaybook2]:
    vno = (line.vno or "").strip()
    if not vno:
        return []
    start_dt = datetime.combine(tds_date, datetime.min.time())
    end_dt = datetime.combine(tds_date, datetime.max.time())
    return (
        db.query(TallyDaybook2)
        .filter(
            TallyDaybook2.vtype == JOURNAL_VTYPE,
            TallyDaybook2.vno == vno,
            TallyDaybook2.vdt.isnot(None),
            TallyDaybook2.vdt >= start_dt,
            TallyDaybook2.vdt <= end_dt,
        )
        .all()
    )


def _party_groups_for_names(
    db: Session,
    ledger_names: Sequence[str],
) -> Dict[str, str]:
    names = sorted({(n or "").strip() for n in ledger_names if (n or "").strip()})
    if not names:
        return {}
    party_groups: Dict[str, str] = {}
    for ledger_name, primary_group in (
        db.query(TallyAccountMaster.ledger_name, TallyAccountMaster.primary_group)
        .filter(TallyAccountMaster.ledger_name.in_(names))
        .all()
    ):
        name = (ledger_name or "").strip()
        if name:
            party_groups[name.casefold()] = (primary_group or "").strip()
    return party_groups


def match_tds_expense(db: Session, *, source_id: int) -> TdsExpenseMatchOut:
    """Find Cr party ledger lines from FY start through TDS date for manual expense match."""
    line = db.query(TallyDaybook2).filter(TallyDaybook2.id == source_id).first()
    if line is None:
        raise ValueError("TDS journal line not found")
    if (line.ledger_name or "").strip() != TDS_PAYABLE_LEDGER:
        raise ValueError("Not a TDS Payable journal line")
    if (line.vtype or "").strip() != JOURNAL_VTYPE:
        raise ValueError("Not a journal voucher")

    tds_date = _daybook_vdt_date(line.vdt)
    if tds_date is None:
        raise ValueError("TDS line has no voucher date")

    siblings = _load_journal_siblings_for_line(db, line, tds_date=tds_date)
    sibling_names = [
        (row.ledger_name or "").strip()
        for row in siblings
        if (row.ledger_name or "").strip()
        and (row.ledger_name or "").strip().casefold() != TDS_PAYABLE_LEDGER.casefold()
    ]
    party_groups = _party_groups_for_names(db, sibling_names)
    party = _resolve_tds_party(siblings, party_groups)
    journal_bill_no, journal_bill_type = _resolve_tds_bill(line, siblings, party)
    if not party:
        raise ValueError("Could not resolve party for this TDS line")

    fy_start, _ = _indian_fy_bounds(tds_date)
    start_dt = datetime.combine(fy_start, datetime.min.time())
    end_dt = datetime.combine(tds_date, datetime.max.time())
    claimed_expense_ids = _other_claimed_expense_source_ids(
        db,
        except_tds_source_id=int(source_id),
    )

    cr_rows = (
        db.query(TallyDaybook2)
        .filter(
            TallyDaybook2.ledger_name == party,
            TallyDaybook2.vdt.isnot(None),
            TallyDaybook2.vdt >= start_dt,
            TallyDaybook2.vdt <= end_dt,
            func.lower(TallyDaybook2.debit_credit) == "cr",
        )
        .order_by(TallyDaybook2.vdt.desc(), TallyDaybook2.id.desc())
        .all()
    )

    scored: List[Tuple[int, TallyDaybook2]] = []
    for row in cr_rows:
        if int(row.id) in claimed_expense_ids:
            continue
        score = _score_cr_expense_row(
            row,
            tds_date=tds_date,
            journal_bill_no=journal_bill_no,
        )
        if score >= 0:
            scored.append((score, row))
    scored.sort(key=lambda item: (-item[0], item[1].vdt or datetime.min, item[1].id))

    best_score = scored[0][0] if scored else -1
    best_id = scored[0][1].id if scored else None
    tds_head = (line.costcentre_name or "").strip() or None
    tds_amount = float(line.ledger_amount or 0.0)

    candidates: List[TdsExpenseMatchCandidate] = []
    for score, row in scored:
        row_day = _daybook_vdt_date(row.vdt)
        selected = best_id is not None and int(row.id) == int(best_id)
        candidates.append(
            TdsExpenseMatchCandidate(
                source_id=int(row.id),
                voucher_date=row_day.isoformat() if row_day else None,
                voucher_no=(row.vno or "").strip() or None,
                voucher_type=(row.vtype or "").strip() or None,
                party=party,
                bill_no=(row.bill_no or "").strip() or None,
                bill_type=(row.bill_type or "").strip() or None,
                debit_credit=(row.debit_credit or "").strip() or None,
                amount=float(row.ledger_amount or 0.0),
                selected=selected,
            )
        )

    matched = best_score >= 0 and best_id is not None
    expenses_date: Optional[str] = None
    expenses_amount: Optional[float] = None
    if matched:
        best = scored[0][1]
        best_day = _daybook_vdt_date(best.vdt)
        expenses_date = best_day.isoformat() if best_day else None
        expenses_amount = float(best.ledger_amount or 0.0)

    return TdsExpenseMatchOut(
        source_id=int(source_id),
        tds_voucher_date=tds_date.isoformat(),
        tds_voucher_no=(line.vno or "").strip() or None,
        tds_head=tds_head,
        tds_amount=tds_amount,
        party=party,
        expenses_date=expenses_date,
        expenses_amount=expenses_amount,
        matched=matched,
        candidates=candidates,
    )


def apply_tds_expense_match(
    db: Session,
    *,
    source_id: int,
    expenses_date: Optional[str],
    expenses_amount: Optional[float],
    expense_source_id: Optional[int] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
) -> TdsExpenseMatchApplyOut:
    """Persist manual expense match on saved TDS working row (upsert from live if needed)."""
    _assert_expense_source_available(
        db,
        expense_source_id=expense_source_id,
        tds_source_id=source_id,
    )

    saved = db.query(TdsWorking).filter(TdsWorking.source_id == source_id).first()
    if saved is not None:
        saved.expenses_date = _parse_iso_date(expenses_date)
        saved.expenses_amount = (
            float(expenses_amount) if expenses_amount is not None else None
        )
        saved.expense_source_id = (
            int(expense_source_id) if expense_source_id is not None else None
        )
        db.commit()
        return TdsExpenseMatchApplyOut(
            applied=True,
            saved=True,
            expenses_date=expenses_date,
            expenses_amount=expenses_amount,
        )

    if date_from is None or date_to is None:
        return TdsExpenseMatchApplyOut(
            applied=False,
            saved=False,
            expenses_date=expenses_date,
            expenses_amount=expenses_amount,
        )

    live_rows = _build_live_tds_workings(db, date_from=date_from, date_to=date_to)
    live = next((row for row in live_rows if row.source_id == source_id), None)
    if live is None:
        return TdsExpenseMatchApplyOut(
            applied=False,
            saved=False,
            expenses_date=expenses_date,
            expenses_amount=expenses_amount,
        )

    live = live.model_copy(
        update={
            "expenses_date": expenses_date,
            "expenses_amount": expenses_amount,
            "expense_source_id": expense_source_id,
        }
    )
    db.add(_tds_entity_from_row(live))
    db.commit()
    return TdsExpenseMatchApplyOut(
        applied=True,
        saved=False,
        expenses_date=expenses_date,
        expenses_amount=expenses_amount,
    )


def _build_live_tds_workings(
    db: Session,
    *,
    date_from: date,
    date_to: date,
    q: Optional[str] = None,
) -> List[TdsWorkingsRow]:
    """Journal lines on TDS Payable, with party/PAN/expenses resolved (no saved merge)."""
    start = min(date_from, date_to)
    end = max(date_from, date_to)
    start_dt = datetime.combine(start, datetime.min.time())
    end_dt = datetime.combine(end, datetime.max.time())

    tds_lines = (
        db.query(TallyDaybook2)
        .filter(
            TallyDaybook2.vtype == JOURNAL_VTYPE,
            TallyDaybook2.ledger_name == TDS_PAYABLE_LEDGER,
            TallyDaybook2.vdt.isnot(None),
            TallyDaybook2.vdt >= start_dt,
            TallyDaybook2.vdt <= end_dt,
        )
        .order_by(TallyDaybook2.vdt.asc(), TallyDaybook2.vno.asc(), TallyDaybook2.id.asc())
        .all()
    )

    vnos = sorted(
        {
            (row.vno or "").strip()
            for row in tds_lines
            if (row.vno or "").strip()
        }
    )

    siblings_by_key: Dict[Tuple[str, str], List[TallyDaybook2]] = defaultdict(list)
    if vnos:
        sibling_rows = (
            db.query(TallyDaybook2)
            .filter(
                TallyDaybook2.vtype == JOURNAL_VTYPE,
                TallyDaybook2.vno.in_(vnos),
                TallyDaybook2.vdt.isnot(None),
                TallyDaybook2.vdt >= start_dt,
                TallyDaybook2.vdt <= end_dt,
            )
            .all()
        )
        for row in sibling_rows:
            key = _voucher_key(row.vno, row.vdt)
            if key:
                siblings_by_key[key].append(row)

    sibling_names = {
        (row.ledger_name or "").strip()
        for rows in siblings_by_key.values()
        for row in rows
        if (row.ledger_name or "").strip()
        and (row.ledger_name or "").strip().casefold() != TDS_PAYABLE_LEDGER.casefold()
    }
    party_groups: Dict[str, str] = {}
    party_pans: Dict[str, str] = {}
    if sibling_names:
        for ledger_name, primary_group, pan, party_gstin in (
            db.query(
                TallyAccountMaster.ledger_name,
                TallyAccountMaster.primary_group,
                TallyAccountMaster.pan,
                TallyAccountMaster.party_gstin,
            )
            .filter(TallyAccountMaster.ledger_name.in_(sibling_names))
            .all()
        ):
            name = (ledger_name or "").strip()
            if not name:
                continue
            key = name.casefold()
            party_groups[key] = (primary_group or "").strip()
            pan_value = _pan_from_account(pan, party_gstin)
            if pan_value:
                party_pans[key] = pan_value

    search = (q or "").strip().lower()
    search_tokens = [t for t in search.split() if t] if search else []

    pending: List[dict] = []
    party_bill_pairs: List[Tuple[str, str]] = []
    for line in tds_lines:
        key = _voucher_key(line.vno, line.vdt)
        siblings = siblings_by_key.get(key, []) if key else []
        party = _resolve_tds_party(siblings, party_groups)
        pan = party_pans.get(party.casefold()) if party else None
        amount = float(line.ledger_amount or 0.0)
        day = _daybook_vdt_date(line.vdt)
        voucher_no = (line.vno or "").strip() or None
        tds_head = (line.costcentre_name or "").strip() or None
        narration = (line.narration or "").strip() or None
        bill_no, bill_type = _resolve_tds_bill(line, siblings, party)

        if search_tokens:
            haystack = " ".join(
                [
                    party or "",
                    pan or "",
                    tds_head or "",
                    voucher_no or "",
                    narration or "",
                    bill_no or "",
                    bill_type or "",
                ]
            ).lower()
            if not all(token in haystack for token in search_tokens):
                continue

        if party and bill_no:
            party_bill_pairs.append((party, bill_no))

        pending.append(
            {
                "source_id": int(line.id),
                "voucher_date": day.isoformat() if day else None,
                "voucher_no": voucher_no,
                "party": party,
                "pan": pan,
                "tds_head": tds_head,
                "amount": amount,
                "narration": narration,
                "bill_no": bill_no,
                "bill_type": bill_type,
            }
        )

    expense_refs = _load_expense_refs(db, party_bill_pairs)
    claimed_expense_ids: Set[int] = {
        int(row[0])
        for row in db.query(TdsWorking.expense_source_id)
        .filter(TdsWorking.expense_source_id.isnot(None))
        .all()
    }

    rows: List[TdsWorkingsRow] = []
    for item in pending:
        expense_key = _expense_lookup_key(item["party"], item["bill_no"])
        expense = expense_refs.get(expense_key) if expense_key else None
        expenses_date: Optional[str] = None
        expenses_amount: Optional[float] = None
        expense_source_id: Optional[int] = None
        if expense:
            exp_id = int(expense[2])
            if exp_id not in claimed_expense_ids:
                claimed_expense_ids.add(exp_id)
                expenses_date = expense[0].isoformat() if expense[0] else None
                expenses_amount = expense[1]
                expense_source_id = exp_id

        rows.append(
            TdsWorkingsRow(
                source_id=item["source_id"],
                voucher_date=item["voucher_date"],
                voucher_no=item["voucher_no"],
                party=item["party"],
                pan=item["pan"],
                tds_head=item["tds_head"],
                amount=item["amount"],
                narration=item["narration"],
                bill_no=item["bill_no"],
                bill_type=item["bill_type"],
                expenses_date=expenses_date,
                expenses_amount=expenses_amount,
                expense_source_id=expense_source_id,
                status=TDS_STATUS_NEW,
            )
        )
    return rows


def _load_saved_tds_workings(
    db: Session,
    *,
    date_from: date,
    date_to: date,
) -> List[TdsWorking]:
    start = min(date_from, date_to)
    end = max(date_from, date_to)
    return (
        db.query(TdsWorking)
        .filter(
            TdsWorking.voucher_date.isnot(None),
            TdsWorking.voucher_date >= start,
            TdsWorking.voucher_date <= end,
        )
        .order_by(
            TdsWorking.voucher_date.asc(),
            TdsWorking.voucher_no.asc(),
            TdsWorking.source_id.asc(),
        )
        .all()
    )


def _merge_tds_workings(
    live_rows: Sequence[TdsWorkingsRow],
    saved_rows: Sequence[TdsWorking],
) -> Tuple[List[TdsWorkingsRow], int, int, bool]:
    saved_by_source = {int(row.source_id): row for row in saved_rows}
    live_by_source = {
        int(row.source_id): row for row in live_rows if row.source_id is not None
    }

    merged: List[TdsWorkingsRow] = []
    for source_id, live in live_by_source.items():
        if source_id in saved_by_source:
            saved = saved_by_source[source_id]
            row = live.model_copy(update={"status": TDS_STATUS_MATCHED})
            if _saved_has_manual_expenses(saved):
                row = row.model_copy(update=_expense_claim_from_saved(saved))
            merged.append(row)
        else:
            merged.append(live.model_copy(update={"status": TDS_STATUS_NEW}))

    for source_id, saved in saved_by_source.items():
        if source_id not in live_by_source:
            merged.append(_tds_row_from_saved(saved, status=TDS_STATUS_DELETED))

    def sort_key(row: TdsWorkingsRow) -> Tuple:
        return (
            row.voucher_date or "",
            row.voucher_no or "",
            row.source_id or 0,
        )

    merged.sort(key=sort_key)
    new_count = sum(1 for row in merged if row.status == TDS_STATUS_NEW)
    deleted_count = sum(1 for row in merged if row.status == TDS_STATUS_DELETED)
    return merged, new_count, deleted_count, bool(saved_rows)


def list_tds_workings(
    db: Session,
    *,
    date_from: date,
    date_to: date,
    q: Optional[str] = None,
) -> TdsWorkingsOut:
    """Live TDS lines merged with saved snapshot (new/deleted highlighted)."""
    start = min(date_from, date_to)
    end = max(date_from, date_to)
    live_rows = _build_live_tds_workings(db, date_from=start, date_to=end, q=q)
    saved_rows = _load_saved_tds_workings(db, date_from=start, date_to=end)
    merged, new_count, deleted_count, saved = _merge_tds_workings(live_rows, saved_rows)

    total_amount = sum(
        float(row.amount or 0.0)
        for row in merged
        if row.status != TDS_STATUS_DELETED
    )
    return TdsWorkingsOut(
        date_from=start.isoformat(),
        date_to=end.isoformat(),
        row_count=len(merged),
        total_amount=total_amount,
        saved=saved,
        new_count=new_count,
        deleted_count=deleted_count,
        rows=merged,
    )


def save_tds_workings(
    db: Session,
    *,
    date_from: date,
    date_to: date,
) -> TdsWorkingsOut:
    """Replace saved snapshot for the period with current live Tally rows."""
    start = min(date_from, date_to)
    end = max(date_from, date_to)
    live_rows = _build_live_tds_workings(db, date_from=start, date_to=end)
    existing_rows = _load_saved_tds_workings(db, date_from=start, date_to=end)
    manual_by_source = {
        int(row.source_id): row
        for row in existing_rows
        if _saved_has_manual_expenses(row)
    }

    db.query(TdsWorking).filter(
        TdsWorking.voucher_date.isnot(None),
        TdsWorking.voucher_date >= start,
        TdsWorking.voucher_date <= end,
    ).delete(synchronize_session=False)

    for row in live_rows:
        if row.source_id is None:
            continue
        entity = _tds_entity_from_row(row)
        manual = manual_by_source.get(int(row.source_id))
        if manual is not None:
            entity.expenses_date = manual.expenses_date
            entity.expenses_amount = manual.expenses_amount
            entity.expense_source_id = manual.expense_source_id
        db.add(entity)
    db.commit()

    return list_tds_workings(db, date_from=start, date_to=end)


def update_tds_workings(
    db: Session,
    *,
    date_from: date,
    date_to: date,
) -> TdsWorkingsOut:
    """Apply diff: insert new live rows, remove deleted saved rows, refresh matched."""
    start = min(date_from, date_to)
    end = max(date_from, date_to)
    live_rows = _build_live_tds_workings(db, date_from=start, date_to=end)
    saved_rows = _load_saved_tds_workings(db, date_from=start, date_to=end)
    saved_by_source = {int(row.source_id): row for row in saved_rows}
    live_by_source = {
        int(row.source_id): row for row in live_rows if row.source_id is not None
    }

    for source_id, live in live_by_source.items():
        existing = saved_by_source.get(source_id)
        if existing is None:
            db.add(_tds_entity_from_row(live))
        else:
            _apply_live_fields(existing, live)

    for source_id, saved in saved_by_source.items():
        if source_id not in live_by_source:
            db.delete(saved)

    db.commit()
    return list_tds_workings(db, date_from=start, date_to=end)


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
