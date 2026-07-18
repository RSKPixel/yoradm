from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, field_serializer, field_validator, model_validator


class GoodsReceiptCreate(BaseModel):
    receipt_date: date
    vendor: str = Field(min_length=1, max_length=255)
    stock_item: str = Field(min_length=1, max_length=255)
    qty: float
    weight: float
    invoice_no: str = Field(min_length=1, max_length=64)
    invoice_date: Optional[date] = None
    invoice_value: Optional[float] = None
    invoiced_weight: Optional[float] = None
    tds_applicable: bool = False
    tds_value: Optional[float] = None
    unloaded_at: str = Field(min_length=1, max_length=128)
    broker: Optional[str] = Field(default=None, max_length=128)
    received_by: Optional[str] = Field(default=None, max_length=128)
    vehicle_no: Optional[str] = Field(default=None, max_length=64)
    place: Optional[str] = Field(default=None, max_length=128)
    remarks: Optional[str] = Field(default=None, max_length=512)

    @field_validator("vendor", "stock_item", "invoice_no", "unloaded_at")
    @classmethod
    def strip_required(cls, value: str) -> str:
        trimmed = value.strip()
        if not trimmed:
            raise ValueError("must not be empty")
        return trimmed

    @field_validator("broker", "received_by", "vehicle_no", "place", "remarks")
    @classmethod
    def strip_optional(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        trimmed = value.strip()
        return trimmed or None

    @model_validator(mode="after")
    def normalize_tds(self) -> "GoodsReceiptCreate":
        if not self.tds_applicable:
            self.tds_value = None
        return self


class GoodsReceiptOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    receipt_date: date
    vendor: str
    stock_item: str
    qty: float
    weight: float
    invoice_no: str
    invoice_date: Optional[date] = None
    invoice_value: Optional[float] = None
    invoiced_weight: Optional[float] = None
    tds_applicable: bool
    tds_value: Optional[float] = None
    unloaded_at: str
    broker: Optional[str] = None
    received_by: Optional[str] = None
    vehicle_no: Optional[str] = None
    place: Optional[str] = None
    remarks: Optional[str] = None
    created_by: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    @field_serializer("created_at", "updated_at")
    def serialize_datetimes(self, value: datetime) -> str:
        if value.tzinfo is None:
            return value.isoformat() + "Z"
        return value.isoformat().replace("+00:00", "Z")


class GoodsReceiptListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    receipt_date: date
    vendor: str
    stock_item: str
    qty: float
    weight: float
    invoice_no: str
    invoice_date: Optional[date] = None
    unloaded_at: str
    vehicle_no: Optional[str] = None
    created_at: datetime

    @field_serializer("created_at")
    def serialize_created_at(self, value: datetime) -> str:
        if value.tzinfo is None:
            return value.isoformat() + "Z"
        return value.isoformat().replace("+00:00", "Z")
