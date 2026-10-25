from __future__ import annotations

from typing import Optional

from sqlalchemy.orm import Session

from app.models.orid_monthly_opening import OridMonthlyOpening
from app.schemas.monthly_summary import MonthlyOpeningOut, MonthlyOpeningSaveIn


def get_opening(db: Session, *, year: int, month: int) -> MonthlyOpeningOut:
    row = (
        db.query(OridMonthlyOpening)
        .filter(OridMonthlyOpening.year == year, OridMonthlyOpening.month == month)
        .first()
    )
    return MonthlyOpeningOut(
        year=year,
        month=month,
        opening_qty=row.opening_qty if row else None,
        opening_rate=row.opening_rate if row else None,
    )


def save_opening(
    db: Session,
    payload: MonthlyOpeningSaveIn,
    *,
    updated_by: Optional[int] = None,
) -> MonthlyOpeningOut:
    row = (
        db.query(OridMonthlyOpening)
        .filter(
            OridMonthlyOpening.year == payload.year,
            OridMonthlyOpening.month == payload.month,
        )
        .first()
    )
    if row is None:
        row = OridMonthlyOpening(year=payload.year, month=payload.month)
        db.add(row)
    row.opening_qty = payload.opening_qty
    row.opening_rate = payload.opening_rate
    row.updated_by = updated_by
    db.commit()
    return get_opening(db, year=payload.year, month=payload.month)
