from datetime import date, datetime
from typing import List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_serializer, field_validator

ChequeStatus = Literal["Returned", "Cleared", "Postdated"]
CHEQUE_STATUSES = ("Returned", "Cleared", "Postdated")


class PostDatedChequeAllocationIn(BaseModel):
    receivable_id: Optional[int] = None
    invoice_no: str = Field(min_length=1, max_length=128)
    allocated_amount: float = Field(gt=0)

    @field_validator("invoice_no")
    @classmethod
    def strip_invoice(cls, value: str) -> str:
        trimmed = value.strip()
        if not trimmed:
            raise ValueError("must not be empty")
        return trimmed


class PostDatedChequeAllocationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    cheque_id: int
    party: str
    receivable_id: Optional[int] = None
    invoice_no: str
    allocated_amount: float


class PostDatedChequeCreate(BaseModel):
    party: str = Field(min_length=1, max_length=255)
    cheque_no: str = Field(min_length=1, max_length=64)
    cheque_date: date
    cheque_present_date: Optional[date] = None
    cheque_amount: float
    status: ChequeStatus = "Postdated"
    allocations: List[PostDatedChequeAllocationIn] = []

    @field_validator("party", "cheque_no")
    @classmethod
    def strip_required(cls, value: str) -> str:
        trimmed = value.strip()
        if not trimmed:
            raise ValueError("must not be empty")
        return trimmed

    @field_validator("status")
    @classmethod
    def normalize_status(cls, value: str) -> str:
        trimmed = value.strip()
        if trimmed not in CHEQUE_STATUSES:
            raise ValueError("must be Returned, Cleared, or Postdated")
        return trimmed


class PostDatedChequeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    party: str
    cheque_no: str
    cheque_date: date
    cheque_present_date: Optional[date] = None
    cheque_amount: float
    status: ChequeStatus = "Postdated"
    allocations: List[PostDatedChequeAllocationOut] = []
    created_by: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    @field_serializer("created_at", "updated_at")
    def serialize_datetimes(self, value: datetime) -> str:
        if value.tzinfo is None:
            return value.isoformat() + "Z"
        return value.isoformat().replace("+00:00", "Z")


class PostDatedChequeListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    party: str
    cheque_no: str
    cheque_date: date
    cheque_present_date: Optional[date] = None
    cheque_amount: float
    status: ChequeStatus = "Postdated"
    created_at: datetime

    @field_serializer("created_at")
    def serialize_created_at(self, value: datetime) -> str:
        if value.tzinfo is None:
            return value.isoformat() + "Z"
        return value.isoformat().replace("+00:00", "Z")


class PostDatedChequeStatusUpdate(BaseModel):
    status: ChequeStatus

    @field_validator("status")
    @classmethod
    def normalize_status(cls, value: str) -> str:
        trimmed = value.strip()
        if trimmed not in CHEQUE_STATUSES:
            raise ValueError("must be Returned, Cleared, or Postdated")
        return trimmed


class PendingBillOut(BaseModel):
    id: int
    invoice_no: Optional[str] = None
    invoice_date: Optional[datetime] = None
    ledger_name: Optional[str] = None
    representative: Optional[str] = None
    amount: Optional[float] = None
    cheque_received: float = 0.0
