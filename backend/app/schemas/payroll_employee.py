from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, field_serializer, field_validator


class PayrollEmployeeCreate(BaseModel):
    name: str = Field(min_length=1, max_length=128)
    designation: Optional[str] = Field(default=None, max_length=128)
    join_date: Optional[date] = None
    phone: Optional[str] = Field(default=None, max_length=32)
    monthly_salary: Optional[float] = None
    is_active: bool = True
    remarks: Optional[str] = Field(default=None, max_length=512)

    @field_validator("name")
    @classmethod
    def strip_required(cls, value: str) -> str:
        trimmed = value.strip()
        if not trimmed:
            raise ValueError("must not be empty")
        return trimmed

    @field_validator("designation", "phone", "remarks")
    @classmethod
    def strip_optional(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        trimmed = value.strip()
        return trimmed or None


class PayrollEmployeeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    emp_code: str
    name: str
    designation: Optional[str] = None
    join_date: Optional[date] = None
    phone: Optional[str] = None
    monthly_salary: Optional[float] = None
    is_active: bool
    remarks: Optional[str] = None
    created_by: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    @field_serializer("created_at", "updated_at")
    def serialize_datetimes(self, value: datetime) -> str:
        if value.tzinfo is None:
            return value.isoformat() + "Z"
        return value.isoformat().replace("+00:00", "Z")


class PayrollEmployeeListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    emp_code: str
    name: str
    designation: Optional[str] = None
    join_date: Optional[date] = None
    monthly_salary: Optional[float] = None
    is_active: bool
    created_at: datetime

    @field_serializer("created_at")
    def serialize_created_at(self, value: datetime) -> str:
        if value.tzinfo is None:
            return value.isoformat() + "Z"
        return value.isoformat().replace("+00:00", "Z")
