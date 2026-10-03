from fastapi import APIRouter, Query

from app.core.deps import CurrentUser, DbSession
from app.schemas.monthly_summary import MonthlyOridProductionOut, MonthlySummaryOut
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
