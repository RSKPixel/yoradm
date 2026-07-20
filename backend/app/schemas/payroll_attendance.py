from calendar import monthrange
from datetime import date
from typing import Dict, List, Literal, Optional

from pydantic import BaseModel, Field, field_validator

AttendanceStatus = Literal["P", "A", "H", "O"]


class PayrollAttendanceEmployeeSheet(BaseModel):
    id: int
    emp_code: str
    name: str
    designation: Optional[str] = None
    marks: Dict[str, AttendanceStatus] = Field(default_factory=dict)


class PayrollAttendanceSheetOut(BaseModel):
    year: int
    month: int
    days_in_month: int
    employees: List[PayrollAttendanceEmployeeSheet]


class PayrollAttendanceMarkIn(BaseModel):
    employee_id: int
    day: int = Field(ge=1, le=31)
    status: Optional[AttendanceStatus] = None


class PayrollAttendanceSaveIn(BaseModel):
    year: int = Field(ge=2000, le=2100)
    month: int = Field(ge=1, le=12)
    marks: List[PayrollAttendanceMarkIn] = Field(default_factory=list)

    @field_validator("marks")
    @classmethod
    def limit_marks(cls, value: List[PayrollAttendanceMarkIn]) -> List[PayrollAttendanceMarkIn]:
        if len(value) > 5000:
            raise ValueError("Too many attendance marks in one request")
        return value


def days_in_month(year: int, month: int) -> int:
    return monthrange(year, month)[1]


def attendance_date(year: int, month: int, day: int) -> date:
    return date(year, month, day)
