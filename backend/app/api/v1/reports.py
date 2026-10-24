from typing import List, Literal

from fastapi import APIRouter, Query

from app.core.deps import CurrentUser, DbSession
from app.schemas.monthly_summary import (
    MonthlyOridProductionOut,
    MonthlyRateGroupsOut,
    MonthlySummaryOut,
)
from app.services import orid_dhall_production_service

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("/monthly-summary", response_model=MonthlySummaryOut)
def monthly_summary(
    _: CurrentUser,
    db: DbSession,
    year: int = Query(..., ge=2000, le=2100),
    month: int = Query(..., ge=1, le=12),
) -> MonthlySummaryOut:
    clubbed = orid_dhall_production_service.club_closed_productions_for_month(
        db,
        year=year,
        month=month,
    )
    return MonthlySummaryOut(
        year=year,
        month=month,
        orid_production=MonthlyOridProductionOut(**clubbed),
    )


@router.get("/monthly-summary/rate-groups", response_model=MonthlyRateGroupsOut)
def monthly_summary_rate_groups(
    _: CurrentUser,
    db: DbSession,
    year: int = Query(..., ge=2000, le=2100),
    month: int = Query(..., ge=1, le=12),
    kind: Literal["sales", "purchases"] = Query(...),
    stock_group: List[str] = Query(..., min_length=1),
) -> MonthlyRateGroupsOut:
    items = orid_dhall_production_service.month_trade_rate_groups(
        db,
        kind=kind,
        year=year,
        month=month,
        stock_groups=stock_group,
    )
    return MonthlyRateGroupsOut(kind=kind, stock_groups=stock_group, items=items)
