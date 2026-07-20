from fastapi import APIRouter, Query

from app.core.deps import AdminUser, DbSession
from app.schemas.payroll_attendance import (
    PayrollAttendanceSaveIn,
    PayrollAttendanceSheetOut,
)
from app.services import payroll_attendance_service

router = APIRouter(prefix="/payroll/attendance", tags=["payroll-attendance"])


@router.get("", response_model=PayrollAttendanceSheetOut)
def get_attendance_sheet(
    _: AdminUser,
    db: DbSession,
    year: int = Query(..., ge=2000, le=2100),
    month: int = Query(..., ge=1, le=12),
) -> PayrollAttendanceSheetOut:
    return payroll_attendance_service.get_month_sheet(db, year=year, month=month)


@router.put("", response_model=PayrollAttendanceSheetOut)
def save_attendance_sheet(
    payload: PayrollAttendanceSaveIn,
    db: DbSession,
    current_user: AdminUser,
) -> PayrollAttendanceSheetOut:
    return payroll_attendance_service.save_month_marks(
        db,
        payload,
        created_by=current_user.id,
    )
