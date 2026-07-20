from __future__ import annotations

import re
from math import ceil
from typing import Optional, Tuple

from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.payroll_employee import PayrollEmployee
from app.schemas.payroll_employee import PayrollEmployeeCreate, PayrollEmployeeListItem

EMP_CODE_PREFIX = "EMP-"
EMP_CODE_RE = re.compile(r"^EMP-(\d+)$", re.IGNORECASE)


def get_by_id(db: Session, employee_id: int) -> Optional[PayrollEmployee]:
    return db.query(PayrollEmployee).filter(PayrollEmployee.id == employee_id).first()


def list_page_meta(total: int, page: int, page_size: int) -> dict:
    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": ceil(total / page_size) if page_size else 0,
    }


def list_employees(
    db: Session,
    *,
    q: Optional[str] = None,
    active_only: Optional[bool] = None,
    page: int = 1,
    page_size: int = 50,
) -> Tuple[list[PayrollEmployeeListItem], int]:
    query = db.query(PayrollEmployee)
    search = (q or "").strip()
    if search:
        like = f"%{search.lower()}%"
        query = query.filter(
            func.lower(PayrollEmployee.emp_code).like(like)
            | func.lower(PayrollEmployee.name).like(like)
            | func.lower(func.coalesce(PayrollEmployee.designation, "")).like(like)
        )
    if active_only is True:
        query = query.filter(PayrollEmployee.is_active.is_(True))
    elif active_only is False:
        query = query.filter(PayrollEmployee.is_active.is_(False))

    total = query.count()
    rows = (
        query.order_by(PayrollEmployee.emp_code.asc(), PayrollEmployee.id.asc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    items = [
        PayrollEmployeeListItem(
            id=row.id,
            emp_code=row.emp_code,
            name=row.name,
            designation=row.designation,
            join_date=row.join_date,
            monthly_salary=row.monthly_salary,
            is_active=row.is_active,
            created_at=row.created_at,
        )
        for row in rows
    ]
    return items, total


def next_emp_code(db: Session) -> str:
    codes = db.query(PayrollEmployee.emp_code).all()
    max_n = 0
    for (code,) in codes:
        match = EMP_CODE_RE.match(str(code or "").strip())
        if match:
            max_n = max(max_n, int(match.group(1)))
    return f"{EMP_CODE_PREFIX}{max_n + 1:03d}"


def create_employee(
    db: Session,
    payload: PayrollEmployeeCreate,
    *,
    created_by: Optional[int] = None,
) -> PayrollEmployee:
    emp_code = next_emp_code(db)
    # Guard rare race: retry once if code collides.
    for _ in range(3):
        exists = (
            db.query(PayrollEmployee.id)
            .filter(func.lower(PayrollEmployee.emp_code) == emp_code.lower())
            .first()
        )
        if not exists:
            break
        emp_code = next_emp_code(db)
    else:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Unable to allocate employee code",
        )

    row = PayrollEmployee(
        emp_code=emp_code,
        name=payload.name,
        designation=payload.designation,
        join_date=payload.join_date,
        phone=payload.phone,
        monthly_salary=payload.monthly_salary,
        is_active=payload.is_active,
        remarks=payload.remarks,
        created_by=created_by,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def update_employee(
    db: Session,
    employee_id: int,
    payload: PayrollEmployeeCreate,
) -> PayrollEmployee:
    row = get_by_id(db, employee_id)
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found")
    row.name = payload.name
    row.designation = payload.designation
    row.join_date = payload.join_date
    row.phone = payload.phone
    row.monthly_salary = payload.monthly_salary
    row.is_active = payload.is_active
    row.remarks = payload.remarks
    db.commit()
    db.refresh(row)
    return row


def delete_employee(db: Session, employee_id: int) -> None:
    row = get_by_id(db, employee_id)
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found")
    db.delete(row)
    db.commit()
