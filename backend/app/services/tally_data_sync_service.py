"""Sync tallydata_* tables into application-owned yoradm_* tables.

Rules (per purchases / sales / daybook2 step):
1. Date window = min/max date from the tallydata_* snapshot.
2. Only yoradm_* rows inside that window are added, updated, or deleted.
3. Add — voucher present in tallydata and absent from yoradm (in window).
4. Delete — voucher present in yoradm (in window) and absent from tallydata.
5. Update — voucher present in both: delete yoradm line(s) for that voucher
   (in window), then insert all tallydata lines for that voucher.
"""

from __future__ import annotations

from collections import defaultdict
from collections.abc import Callable
from dataclasses import dataclass
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import TypeVar

from sqlalchemy.orm import Session

from app.models.tally import TallyDaybook2, TallyPurchase, TallySale
from app.models.yoradm_daybook2 import YoradmDaybook2
from app.models.yoradm_purchase import YoradmPurchase
from app.models.yoradm_sale import YoradmSale
from app.schemas.tally_data import TallySyncSessionResponse, TallySyncStepResult
from app.services.tally_sync_key import (
    daybook2_sync_key,
    purchase_sync_key,
    sale_sync_key,
)

TSource = TypeVar("TSource")
TTarget = TypeVar("TTarget")


def _normalize_text(value: str | None) -> str | None:
    if value is None:
        return None
    normalized = value.strip()
    return normalized or None


def _normalize_float(value: float | Decimal | None) -> float | None:
    if value is None:
        return None
    return round(float(value), 2)


def _normalize_datetime(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is not None:
        return value.replace(tzinfo=None)
    return value


def _date_bounds(
    source_rows: list[object],
    *,
    date_attr: str,
) -> tuple[date | None, date | None]:
    dates: list[date] = []
    for row in source_rows:
        value = _normalize_datetime(getattr(row, date_attr, None))
        if value is not None:
            dates.append(value.date())
    if not dates:
        return None, None
    return min(dates), max(dates)


def _is_within_tally_period(
    row_date: datetime | None,
    *,
    min_date: date | None,
    max_date: date | None,
) -> bool:
    if min_date is None or max_date is None:
        return False
    normalized = _normalize_datetime(row_date)
    if normalized is None:
        return False
    value = normalized.date()
    return min_date <= value <= max_date


def _voucher_group_key(voucher_no: str | None, *, sync_key: str) -> str:
    normalized = _normalize_text(voucher_no)
    if normalized is None:
        return f"__line__:{sync_key}"
    return normalized.casefold()


@dataclass(frozen=True)
class _PurchaseSnapshot:
    voucher_no: str | None
    voucher_date: datetime | None
    ledger_name: str | None
    broker: str | None
    item_count: float | None
    itemno: float | None
    stock_item: str | None
    brand: str | None
    packing: float | None
    qty: float | None
    weight: float | None
    rate: float | None
    amount: float | None

    @property
    def sync_key(self) -> str:
        return purchase_sync_key(
            voucher_no=self.voucher_no,
            voucher_date=self.voucher_date,
            ledger_name=self.ledger_name,
            itemno=self.itemno,
            stock_item=self.stock_item,
            brand=self.brand,
            packing=self.packing,
            qty=self.qty,
            weight=self.weight,
            rate=self.rate,
            amount=self.amount,
            broker=self.broker,
        )

    @property
    def voucher_group_key(self) -> str:
        return _voucher_group_key(self.voucher_no, sync_key=self.sync_key)

    @classmethod
    def from_tally(cls, row: TallyPurchase) -> _PurchaseSnapshot:
        return cls(
            voucher_no=_normalize_text(row.voucher_no),
            voucher_date=_normalize_datetime(row.voucher_date),
            ledger_name=_normalize_text(row.ledger_name),
            broker=_normalize_text(row.broker),
            item_count=_normalize_float(row.item_count),
            itemno=_normalize_float(row.itemno),
            stock_item=_normalize_text(row.stock_item),
            brand=_normalize_text(row.brand),
            packing=_normalize_float(row.packing),
            qty=_normalize_float(row.qty),
            weight=_normalize_float(row.weight),
            rate=_normalize_float(row.rate),
            amount=_normalize_float(row.amount),
        )

    @classmethod
    def from_yoradm(cls, row: YoradmPurchase) -> _PurchaseSnapshot:
        return cls(
            voucher_no=_normalize_text(row.voucher_no),
            voucher_date=_normalize_datetime(row.voucher_date),
            ledger_name=_normalize_text(row.ledger_name),
            broker=_normalize_text(row.broker),
            item_count=_normalize_float(row.item_count),
            itemno=_normalize_float(row.itemno),
            stock_item=_normalize_text(row.stock_item),
            brand=_normalize_text(row.brand),
            packing=_normalize_float(row.packing),
            qty=_normalize_float(row.qty),
            weight=_normalize_float(row.weight),
            rate=_normalize_float(row.rate),
            amount=_normalize_float(row.amount),
        )


@dataclass(frozen=True)
class _SaleSnapshot:
    voucher_no: str | None
    voucher_date: datetime | None
    ledger_name: str | None
    broker: str | None
    item_count: float | None
    item_no: float | None
    stock_item: str | None
    brand: str | None
    packing: float | None
    qty: float | None
    rate: float | None
    amount: float | None
    discount: float | None
    cartage: float | None

    @property
    def sync_key(self) -> str:
        return sale_sync_key(
            voucher_no=self.voucher_no,
            voucher_date=self.voucher_date,
            ledger_name=self.ledger_name,
            item_no=self.item_no,
            stock_item=self.stock_item,
            brand=self.brand,
            packing=self.packing,
            qty=self.qty,
            rate=self.rate,
            amount=self.amount,
            discount=self.discount,
            cartage=self.cartage,
            broker=self.broker,
        )

    @property
    def voucher_group_key(self) -> str:
        return _voucher_group_key(self.voucher_no, sync_key=self.sync_key)

    @classmethod
    def from_tally(cls, row: TallySale) -> _SaleSnapshot:
        return cls(
            voucher_no=_normalize_text(row.voucher_no),
            voucher_date=_normalize_datetime(row.voucher_date),
            ledger_name=_normalize_text(row.ledger_name),
            broker=_normalize_text(row.broker),
            item_count=_normalize_float(row.item_count),
            item_no=_normalize_float(row.item_no),
            stock_item=_normalize_text(row.stock_item),
            brand=_normalize_text(row.brand),
            packing=_normalize_float(row.packing),
            qty=_normalize_float(row.qty),
            rate=_normalize_float(row.rate),
            amount=_normalize_float(row.amount),
            discount=_normalize_float(row.discount),
            cartage=_normalize_float(row.cartage),
        )

    @classmethod
    def from_yoradm(cls, row: YoradmSale) -> _SaleSnapshot:
        return cls(
            voucher_no=_normalize_text(row.voucher_no),
            voucher_date=_normalize_datetime(row.voucher_date),
            ledger_name=_normalize_text(row.ledger_name),
            broker=_normalize_text(row.broker),
            item_count=_normalize_float(row.item_count),
            item_no=_normalize_float(row.item_no),
            stock_item=_normalize_text(row.stock_item),
            brand=_normalize_text(row.brand),
            packing=_normalize_float(row.packing),
            qty=_normalize_float(row.qty),
            rate=_normalize_float(row.rate),
            amount=_normalize_float(row.amount),
            discount=_normalize_float(row.discount),
            cartage=_normalize_float(row.cartage),
        )


@dataclass(frozen=True)
class _Daybook2Snapshot:
    vtype: str | None
    vno: str | None
    vdt: datetime | None
    narration: str | None
    debit_credit: str | None
    ledger_name: str | None
    costcentre_name: str | None
    costcentre_amt: float | None
    ledger_amount: float | None
    bill_no: str | None
    bill_type: str | None

    @property
    def sync_key(self) -> str:
        return daybook2_sync_key(
            vtype=self.vtype,
            vno=self.vno,
            vdt=self.vdt,
            ledger_name=self.ledger_name,
            debit_credit=self.debit_credit,
            costcentre_name=self.costcentre_name,
            costcentre_amt=self.costcentre_amt,
            ledger_amount=self.ledger_amount,
            bill_no=self.bill_no,
            bill_type=self.bill_type,
            narration=self.narration,
        )

    @property
    def voucher_group_key(self) -> str:
        return _voucher_group_key(self.vno, sync_key=self.sync_key)

    @classmethod
    def from_tally(cls, row: TallyDaybook2) -> _Daybook2Snapshot:
        return cls(
            vtype=_normalize_text(row.vtype),
            vno=_normalize_text(row.vno),
            vdt=_normalize_datetime(row.vdt),
            narration=_normalize_text(row.narration),
            debit_credit=_normalize_text(row.debit_credit),
            ledger_name=_normalize_text(row.ledger_name),
            costcentre_name=_normalize_text(row.costcentre_name),
            costcentre_amt=_normalize_float(row.costcentre_amt),
            ledger_amount=_normalize_float(row.ledger_amount),
            bill_no=_normalize_text(row.bill_no),
            bill_type=_normalize_text(row.bill_type),
        )

    @classmethod
    def from_yoradm(cls, row: YoradmDaybook2) -> _Daybook2Snapshot:
        return cls(
            vtype=_normalize_text(row.vtype),
            vno=_normalize_text(row.vno),
            vdt=_normalize_datetime(row.vdt),
            narration=_normalize_text(row.narration),
            debit_credit=_normalize_text(row.debit_credit),
            ledger_name=_normalize_text(row.ledger_name),
            costcentre_name=_normalize_text(row.costcentre_name),
            costcentre_amt=_normalize_float(row.costcentre_amt),
            ledger_amount=_normalize_float(row.ledger_amount),
            bill_no=_normalize_text(row.bill_no),
            bill_type=_normalize_text(row.bill_type),
        )


def _apply_purchase_snapshot(target: YoradmPurchase, snapshot: _PurchaseSnapshot) -> None:
    target.sync_key = snapshot.sync_key
    target.voucher_no = snapshot.voucher_no
    target.voucher_date = snapshot.voucher_date
    target.ledger_name = snapshot.ledger_name
    target.broker = snapshot.broker
    target.item_count = snapshot.item_count
    target.itemno = snapshot.itemno
    target.stock_item = snapshot.stock_item
    target.brand = snapshot.brand
    target.packing = snapshot.packing
    target.qty = snapshot.qty
    target.weight = snapshot.weight
    target.rate = snapshot.rate
    target.amount = snapshot.amount


def _apply_sale_snapshot(target: YoradmSale, snapshot: _SaleSnapshot) -> None:
    target.sync_key = snapshot.sync_key
    target.voucher_no = snapshot.voucher_no
    target.voucher_date = snapshot.voucher_date
    target.ledger_name = snapshot.ledger_name
    target.broker = snapshot.broker
    target.item_count = snapshot.item_count
    target.item_no = snapshot.item_no
    target.stock_item = snapshot.stock_item
    target.brand = snapshot.brand
    target.packing = snapshot.packing
    target.qty = snapshot.qty
    target.rate = snapshot.rate
    target.amount = snapshot.amount
    target.discount = snapshot.discount
    target.cartage = snapshot.cartage


def _apply_daybook2_snapshot(target: YoradmDaybook2, snapshot: _Daybook2Snapshot) -> None:
    target.sync_key = snapshot.sync_key
    target.vtype = snapshot.vtype
    target.vno = snapshot.vno
    target.vdt = snapshot.vdt
    target.narration = snapshot.narration
    target.debit_credit = snapshot.debit_credit
    target.ledger_name = snapshot.ledger_name
    target.costcentre_name = snapshot.costcentre_name
    target.costcentre_amt = snapshot.costcentre_amt
    target.ledger_amount = snapshot.ledger_amount
    target.bill_no = snapshot.bill_no
    target.bill_type = snapshot.bill_type


def _label_singular(label: str) -> str:
    if label == "Purchases":
        return "purchase"
    if label == "Sales":
        return "sale"
    if label == "Daybook2":
        return "daybook2"
    return label.lower()


def _step_summary(label: str, step: TallySyncStepResult) -> str:
    parts: list[str] = []
    if step.added:
        parts.append(f"{step.added} added")
    if step.updated:
        parts.append(f"{step.updated} updated")
    if step.removed:
        parts.append(f"{step.removed} removed")
    if step.unchanged:
        parts.append(f"{step.unchanged} unchanged")

    if not parts:
        return f"No {label.lower()} records found in Tally data."
    if step.added == step.source_count and step.updated == 0 and step.removed == 0:
        return f"Imported {step.added} {_label_singular(label)} line(s) from Tally."
    return f"{label}: {', '.join(parts)}"


def _delete_by_sync_keys(
    db: Session,
    model: type,
    sync_keys: list[str],
    *,
    chunk_size: int = 500,
) -> int:
    if not sync_keys:
        return 0
    unique_keys = sorted(set(sync_keys))
    deleted = 0
    for start in range(0, len(unique_keys), chunk_size):
        chunk = unique_keys[start : start + chunk_size]
        deleted += int(
            db.query(model)
            .filter(model.sync_key.in_(chunk))
            .delete(synchronize_session=False)
            or 0
        )
    return deleted


def _voucher_sync_keys(snapshots_or_rows: list) -> frozenset[str]:
    return frozenset(item.sync_key for item in snapshots_or_rows)  # type: ignore[attr-defined]


def _sync_step(
    db: Session,
    *,
    source_table: str,
    target_table: str,
    source_rows: list[TSource],
    existing_rows: list[TTarget],
    date_attr: str,
    snapshot_from_source: Callable[[TSource], object],
    snapshot_from_target: Callable[[TTarget], object],
    create_target: Callable[[str], TTarget],
    apply_snapshot: Callable[[TTarget, object], None],
    target_model: type,
) -> TallySyncStepResult:
    min_date, max_date = _date_bounds(source_rows, date_attr=date_attr)

    tally_by_voucher: dict[str, list] = defaultdict(list)
    for source_row in source_rows:
        snapshot = snapshot_from_source(source_row)
        tally_by_voucher[snapshot.voucher_group_key].append(snapshot)

    yoradm_by_voucher: dict[str, list] = defaultdict(list)
    for existing in existing_rows:
        if not _is_within_tally_period(
            getattr(existing, date_attr, None),
            min_date=min_date,
            max_date=max_date,
        ):
            continue
        snapshot = snapshot_from_target(existing)
        yoradm_by_voucher[snapshot.voucher_group_key].append(existing)

    tally_vouchers = set(tally_by_voucher)
    yoradm_vouchers = set(yoradm_by_voucher)

    vouchers_to_add = tally_vouchers - yoradm_vouchers
    vouchers_to_delete = yoradm_vouchers - tally_vouchers
    vouchers_candidate_update = tally_vouchers & yoradm_vouchers

    vouchers_to_update: set[str] = set()
    unchanged_lines = 0
    for voucher_key in vouchers_candidate_update:
        source_keys = _voucher_sync_keys(tally_by_voucher[voucher_key])
        target_keys = _voucher_sync_keys(yoradm_by_voucher[voucher_key])
        if source_keys == target_keys:
            unchanged_lines += len(tally_by_voucher[voucher_key])
        else:
            vouchers_to_update.add(voucher_key)

    keys_to_delete: list[str] = []
    for voucher_key in vouchers_to_delete | vouchers_to_update:
        for row in yoradm_by_voucher[voucher_key]:
            keys_to_delete.append(row.sync_key)  # type: ignore[attr-defined]

    removed = _delete_by_sync_keys(db, target_model, keys_to_delete)

    added = 0
    updated_lines = 0
    to_insert: list[TTarget] = []

    for voucher_key in vouchers_to_add:
        for snapshot in tally_by_voucher[voucher_key]:
            target = create_target(snapshot.sync_key)
            apply_snapshot(target, snapshot)
            to_insert.append(target)
            added += 1

    for voucher_key in vouchers_to_update:
        for snapshot in tally_by_voucher[voucher_key]:
            target = create_target(snapshot.sync_key)
            apply_snapshot(target, snapshot)
            to_insert.append(target)
            updated_lines += 1

    if to_insert:
        db.add_all(to_insert)
        db.flush()

    removed_only = sum(
        len(yoradm_by_voucher[voucher_key]) for voucher_key in vouchers_to_delete
    )
    target_count_after = (
        len(existing_rows) - removed + added + updated_lines
    )

    return TallySyncStepResult(
        source_table=source_table,
        target_table=target_table,
        source_count=len(source_rows),
        target_count_before=len(existing_rows),
        target_count_after=target_count_after,
        added=added,
        updated=updated_lines,
        unchanged=unchanged_lines,
        removed=removed_only,
    )


def sync_tally_data(db: Session) -> TallySyncSessionResponse:
    started_at = datetime.now(timezone.utc)
    steps: list[TallySyncStepResult] = []

    try:
        purchase_step = _sync_step(
            db,
            source_table="tallydata_purchases",
            target_table="yoradm_purchase",
            source_rows=db.query(TallyPurchase).all(),
            existing_rows=db.query(YoradmPurchase).all(),
            date_attr="voucher_date",
            snapshot_from_source=_PurchaseSnapshot.from_tally,
            snapshot_from_target=_PurchaseSnapshot.from_yoradm,
            create_target=lambda sync_key: YoradmPurchase(sync_key=sync_key),
            apply_snapshot=_apply_purchase_snapshot,
            target_model=YoradmPurchase,
        )
        db.commit()
        steps.append(purchase_step)

        sales_step = _sync_step(
            db,
            source_table="tallydata_sales",
            target_table="yoradm_sales",
            source_rows=db.query(TallySale).all(),
            existing_rows=db.query(YoradmSale).all(),
            date_attr="voucher_date",
            snapshot_from_source=_SaleSnapshot.from_tally,
            snapshot_from_target=_SaleSnapshot.from_yoradm,
            create_target=lambda sync_key: YoradmSale(sync_key=sync_key),
            apply_snapshot=_apply_sale_snapshot,
            target_model=YoradmSale,
        )
        db.commit()
        steps.append(sales_step)

        daybook_step = _sync_step(
            db,
            source_table="tallydata_daybook2",
            target_table="yoradm_daybook2",
            source_rows=db.query(TallyDaybook2).all(),
            existing_rows=db.query(YoradmDaybook2).all(),
            date_attr="vdt",
            snapshot_from_source=_Daybook2Snapshot.from_tally,
            snapshot_from_target=_Daybook2Snapshot.from_yoradm,
            create_target=lambda sync_key: YoradmDaybook2(sync_key=sync_key),
            apply_snapshot=_apply_daybook2_snapshot,
            target_model=YoradmDaybook2,
        )
        db.commit()
        steps.append(daybook_step)
    except Exception:
        db.rollback()
        raise

    completed_at = datetime.now(timezone.utc)
    labels = ["Purchases", "Sales", "Daybook2"]
    message = "; ".join(
        _step_summary(label, step) for label, step in zip(labels, steps)
    )

    return TallySyncSessionResponse(
        started_at=started_at,
        completed_at=completed_at,
        steps=steps,
        message=message,
    )
