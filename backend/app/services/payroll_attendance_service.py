from __future__ import annotations

from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.payroll_attendance import PayrollAttendance
from app.models.payroll_employee import PayrollEmployee
from app.schemas.payroll_attendance import (
    PayrollAttendanceEmployeeSheet,
    PayrollAttendanceSaveIn,
    PayrollAttendanceSheetOut,
    attendance_date,
    days_in_month,
)

VALID_STATUSES = {"P", "A", "H", "O"}


def _sunday_days(year: int, month: int, dim: int) -> list[int]:
    return [
        day
        for day in range(1, dim + 1)
        if attendance_date(year, month, day).weekday() == 6
    ]


def _apply_sunday_holiday_defaults(
    marks_by_emp: dict[int, dict[str, str]],
    *,
    employee_ids: list[int],
    sunday_days: list[int],
) -> None:
    for employee_id in employee_ids:
        marks = marks_by_emp.setdefault(employee_id, {})
        for day in sunday_days:
            key = str(day)
            if key not in marks:
                marks[key] = "O"


def get_month_sheet(db: Session, *, year: int, month: int) -> PayrollAttendanceSheetOut:
    dim = days_in_month(year, month)
    start = attendance_date(year, month, 1)
    end = attendance_date(year, month, dim)
    sunday_days = _sunday_days(year, month, dim)

    employees = (
        db.query(PayrollEmployee)
        .filter(PayrollEmployee.is_active.is_(True))
        .order_by(PayrollEmployee.emp_code.asc(), PayrollEmployee.id.asc())
        .all()
    )
    employee_ids = [row.id for row in employees]

    marks_by_emp: dict[int, dict[str, str]] = {eid: {} for eid in employee_ids}
    if employee_ids:
        rows = (
            db.query(PayrollAttendance)
            .filter(
                PayrollAttendance.employee_id.in_(employee_ids),
                PayrollAttendance.attendance_date >= start,
                PayrollAttendance.attendance_date <= end,
            )
            .all()
        )
        for row in rows:
            if row.status in VALID_STATUSES:
                marks_by_emp[row.employee_id][str(row.attendance_date.day)] = row.status

    _apply_sunday_holiday_defaults(
        marks_by_emp,
        employee_ids=employee_ids,
        sunday_days=sunday_days,
    )

    return PayrollAttendanceSheetOut(
        year=year,
        month=month,
        days_in_month=dim,
        employees=[
            PayrollAttendanceEmployeeSheet(
                id=emp.id,
                emp_code=emp.emp_code,
                name=emp.name,
                designation=emp.designation,
                marks=marks_by_emp.get(emp.id, {}),
            )
            for emp in employees
        ],
    )


def save_month_marks(
    db: Session,
    payload: PayrollAttendanceSaveIn,
    *,
    created_by: Optional[int] = None,
) -> PayrollAttendanceSheetOut:
    dim = days_in_month(payload.year, payload.month)
    employee_ids = {mark.employee_id for mark in payload.marks}
    if employee_ids:
        found = {
            row.id
            for row in db.query(PayrollEmployee.id)
            .filter(PayrollEmployee.id.in_(employee_ids))
            .all()
        }
        missing = employee_ids - found
        if missing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unknown employee id(s): {sorted(missing)}",
            )

    for mark in payload.marks:
        if mark.day > dim:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Day {mark.day} is invalid for {payload.year}-{payload.month:02d}",
            )
        att_date = attendance_date(payload.year, payload.month, mark.day)
        existing = (
            db.query(PayrollAttendance)
            .filter(
                PayrollAttendance.employee_id == mark.employee_id,
                PayrollAttendance.attendance_date == att_date,
            )
            .first()
        )
        # Blank → delete stored override (Sunday holiday default applies again on load).
        if mark.status is None:
            if existing:
                db.delete(existing)
            continue
        if existing:
            existing.status = mark.status
        else:
            db.add(
                PayrollAttendance(
                    employee_id=mark.employee_id,
                    attendance_date=att_date,
                    status=mark.status,
                    created_by=created_by,
                )
            )

    db.commit()
    return get_month_sheet(db, year=payload.year, month=payload.month)
