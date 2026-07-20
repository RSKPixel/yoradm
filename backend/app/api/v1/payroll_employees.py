from typing import Optional

from fastapi import APIRouter, HTTPException, Query, Response, status

from app.core.deps import AdminUser, DbSession
from app.schemas import PaginatedResponse
from app.schemas.payroll_employee import (
    PayrollEmployeeCreate,
    PayrollEmployeeListItem,
    PayrollEmployeeOut,
)
from app.services import payroll_employee_service

router = APIRouter(prefix="/payroll/employees", tags=["payroll-employees"])


@router.get("", response_model=PaginatedResponse[PayrollEmployeeListItem])
def list_employees(
    _: AdminUser,
    db: DbSession,
    q: Optional[str] = Query(default=None),
    active_only: Optional[bool] = Query(default=None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
) -> PaginatedResponse[PayrollEmployeeListItem]:
    items, total = payroll_employee_service.list_employees(
        db,
        q=q,
        active_only=active_only,
        page=page,
        page_size=page_size,
    )
    meta = payroll_employee_service.list_page_meta(total, page, page_size)
    return PaginatedResponse(items=items, **meta)


@router.get("/{employee_id}", response_model=PayrollEmployeeOut)
def get_employee(
    employee_id: int,
    _: AdminUser,
    db: DbSession,
) -> PayrollEmployeeOut:
    row = payroll_employee_service.get_by_id(db, employee_id)
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found")
    return row


@router.post("", response_model=PayrollEmployeeOut, status_code=status.HTTP_201_CREATED)
def create_employee(
    payload: PayrollEmployeeCreate,
    db: DbSession,
    current_user: AdminUser,
) -> PayrollEmployeeOut:
    return payroll_employee_service.create_employee(
        db,
        payload,
        created_by=current_user.id,
    )


@router.put("/{employee_id}", response_model=PayrollEmployeeOut)
def update_employee(
    employee_id: int,
    payload: PayrollEmployeeCreate,
    db: DbSession,
    _: AdminUser,
) -> PayrollEmployeeOut:
    return payroll_employee_service.update_employee(db, employee_id, payload)


@router.delete("/{employee_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_employee(
    employee_id: int,
    db: DbSession,
    _: AdminUser,
) -> Response:
    payroll_employee_service.delete_employee(db, employee_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
