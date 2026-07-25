from __future__ import annotations

from datetime import date
from math import ceil
from typing import List, Optional, Tuple

from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.models.post_dated_cheque import PostDatedCheque, PostDatedChequeAllocation
from app.schemas.post_dated_cheque import (
    PostDatedChequeAllocationOut,
    PostDatedChequeCreate,
    PostDatedChequeListItem,
    PostDatedChequeOut,
)


def get_by_id(db: Session, cheque_id: int) -> Optional[PostDatedCheque]:
    return (
        db.query(PostDatedCheque)
        .options(joinedload(PostDatedCheque.allocations))
        .filter(PostDatedCheque.id == cheque_id)
        .first()
    )


def _normalize_status(value: Optional[str]) -> str:
    raw = (value or "Postdated").strip()
    if raw == "Passed":
        return "Cleared"
    return raw or "Postdated"


def effective_status(
    value: Optional[str],
    present_date: Optional[date],
    *,
    today: Optional[date] = None,
) -> str:
    """Returned stays Returned; once present date has arrived/passed → Cleared."""
    status = _normalize_status(value)
    if status == "Returned":
        return "Returned"
    as_of = today or date.today()
    if present_date is not None and present_date < as_of:
        return "Cleared"
    return status


def _to_out(row: PostDatedCheque) -> PostDatedChequeOut:
    return PostDatedChequeOut(
        id=row.id,
        party=row.party,
        cheque_no=row.cheque_no,
        cheque_date=row.cheque_date,
        cheque_present_date=row.cheque_present_date,
        cheque_amount=row.cheque_amount,
        status=effective_status(row.status, row.cheque_present_date),
        allocations=[
            PostDatedChequeAllocationOut.model_validate(item)
            for item in (row.allocations or [])
        ],
        created_by=row.created_by,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


def cheque_to_out(row: PostDatedCheque) -> PostDatedChequeOut:
    return _to_out(row)


def list_post_dated_cheques(
    db: Session,
    *,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    party: Optional[str] = None,
    cheque_no: Optional[str] = None,
    page: int = 1,
    page_size: int = 50,
) -> Tuple[list[PostDatedChequeListItem], int]:
    query = db.query(PostDatedCheque)
    if date_from is not None:
        query = query.filter(PostDatedCheque.cheque_date >= date_from)
    if date_to is not None:
        query = query.filter(PostDatedCheque.cheque_date <= date_to)
    party_q = (party or "").strip()
    if party_q:
        query = query.filter(func.lower(PostDatedCheque.party).like(f"%{party_q.lower()}%"))
    cheque_q = (cheque_no or "").strip()
    if cheque_q:
        query = query.filter(
            func.lower(PostDatedCheque.cheque_no).like(f"%{cheque_q.lower()}%")
        )

    total = query.count()
    rows = (
        query.order_by(PostDatedCheque.cheque_date.desc(), PostDatedCheque.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    items = [
        PostDatedChequeListItem(
            id=row.id,
            party=row.party,
            cheque_no=row.cheque_no,
            cheque_date=row.cheque_date,
            cheque_present_date=row.cheque_present_date,
            cheque_amount=row.cheque_amount,
            status=effective_status(row.status, row.cheque_present_date),
            created_at=row.created_at,
        )
        for row in rows
    ]
    return items, total


def list_page_meta(total: int, page: int, page_size: int) -> dict:
    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": ceil(total / page_size) if page_size else 0,
    }


def _assert_allocations_match_cheque(payload: PostDatedChequeCreate) -> None:
    allocations = payload.allocations or []
    if not allocations:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Allocate this cheque to at least one bill.",
        )
    total = sum(float(item.allocated_amount) for item in allocations)
    cheque_amount = float(payload.cheque_amount)
    if abs(total - cheque_amount) >= 0.01:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This cheque total must match cheque amount.",
        )


def _replace_allocations(
    db: Session,
    cheque: PostDatedCheque,
    payload: PostDatedChequeCreate,
) -> None:
    cheque.allocations.clear()
    db.flush()
    for item in payload.allocations or []:
        cheque.allocations.append(
            PostDatedChequeAllocation(
                party=payload.party,
                receivable_id=item.receivable_id,
                invoice_no=item.invoice_no,
                allocated_amount=float(item.allocated_amount),
            )
        )


def create_post_dated_cheque(
    db: Session,
    payload: PostDatedChequeCreate,
    *,
    created_by: Optional[int] = None,
) -> PostDatedChequeOut:
    _assert_allocations_match_cheque(payload)
    row = PostDatedCheque(
        party=payload.party,
        cheque_no=payload.cheque_no,
        cheque_date=payload.cheque_date,
        cheque_present_date=payload.cheque_present_date,
        cheque_amount=payload.cheque_amount,
        status=payload.status,
        created_by=created_by,
    )
    db.add(row)
    db.flush()
    _replace_allocations(db, row, payload)
    db.commit()
    loaded = get_by_id(db, row.id)
    assert loaded is not None
    return _to_out(loaded)


def update_post_dated_cheque(
    db: Session,
    cheque_id: int,
    payload: PostDatedChequeCreate,
) -> PostDatedChequeOut:
    _assert_allocations_match_cheque(payload)
    row = get_by_id(db, cheque_id)
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Post dated cheque not found",
        )

    row.party = payload.party
    row.cheque_no = payload.cheque_no
    row.cheque_date = payload.cheque_date
    row.cheque_present_date = payload.cheque_present_date
    row.cheque_amount = payload.cheque_amount
    row.status = payload.status
    _replace_allocations(db, row, payload)
    db.commit()
    loaded = get_by_id(db, cheque_id)
    assert loaded is not None
    return _to_out(loaded)


def update_post_dated_cheque_status(
    db: Session,
    cheque_id: int,
    *,
    new_status: str,
) -> PostDatedChequeOut:
    row = get_by_id(db, cheque_id)
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Post dated cheque not found",
        )
    row.status = _normalize_status(new_status)
    db.commit()
    loaded = get_by_id(db, cheque_id)
    assert loaded is not None
    return _to_out(loaded)


def delete_post_dated_cheque(db: Session, cheque_id: int) -> None:
    row = get_by_id(db, cheque_id)
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Post dated cheque not found",
        )
    db.delete(row)
    db.commit()


def sum_cheque_received_by_invoice(
    db: Session,
    *,
    party: str,
    exclude_cheque_id: Optional[int] = None,
) -> dict[str, float]:
    """Map invoice_no → total allocated from cheques (optionally excluding one cheque)."""
    name = (party or "").strip()
    if not name:
        return {}
    query = (
        db.query(
            PostDatedChequeAllocation.invoice_no,
            func.coalesce(func.sum(PostDatedChequeAllocation.allocated_amount), 0.0),
        )
        .filter(func.lower(PostDatedChequeAllocation.party) == name.lower())
    )
    if exclude_cheque_id is not None:
        query = query.filter(PostDatedChequeAllocation.cheque_id != int(exclude_cheque_id))
    rows = query.group_by(PostDatedChequeAllocation.invoice_no).all()
    return {
        (invoice or "").strip(): float(total or 0.0)
        for invoice, total in rows
        if (invoice or "").strip()
    }
