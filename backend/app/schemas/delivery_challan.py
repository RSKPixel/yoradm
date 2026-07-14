from datetime import date, datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field, field_serializer, field_validator


class DeliveryChallanLineIn(BaseModel):
    voucher_no: str = Field(min_length=1, max_length=64)
    voucher_date: Optional[str] = Field(default=None, max_length=32)
    ledger_name: Optional[str] = Field(default=None, max_length=255)
    stock_item: Optional[str] = Field(default=None, max_length=255)
    brand: Optional[str] = Field(default=None, max_length=128)
    packing: Optional[float] = None
    qty: Optional[float] = None
    amount: Optional[float] = None
    discount: Optional[float] = None
    delivery_location: str = Field(min_length=1, max_length=128)

    @field_validator("voucher_no", "delivery_location")
    @classmethod
    def strip_required(cls, value: str) -> str:
        trimmed = value.strip()
        if not trimmed:
            raise ValueError("must not be empty")
        return trimmed


class DeliveryChallanCreate(BaseModel):
    challan_date: date
    vehicle_no: str = Field(min_length=1, max_length=64)
    driver_name: str = Field(min_length=1, max_length=128)
    batch_no: Optional[str] = Field(default=None, max_length=64)
    lines: List[DeliveryChallanLineIn] = Field(min_length=1)

    @field_validator("vehicle_no", "driver_name")
    @classmethod
    def strip_required(cls, value: str) -> str:
        trimmed = value.strip()
        if not trimmed:
            raise ValueError("must not be empty")
        return trimmed

    @field_validator("batch_no")
    @classmethod
    def strip_optional(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        trimmed = value.strip()
        return trimmed or None


class DeliveryChallanLineOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    voucher_no: str
    voucher_date: Optional[str] = None
    ledger_name: Optional[str] = None
    stock_item: Optional[str] = None
    brand: Optional[str] = None
    packing: Optional[float] = None
    qty: Optional[float] = None
    amount: Optional[float] = None
    discount: Optional[float] = None
    delivery_location: str
    line_no: int


class DeliveryChallanOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    challan_date: date
    vehicle_no: str
    driver_name: str
    batch_no: Optional[str] = None
    created_by: Optional[int] = None
    created_at: datetime
    updated_at: datetime
    details: List[DeliveryChallanLineOut] = []

    @field_serializer("created_at", "updated_at")
    def serialize_datetimes(self, value: datetime) -> str:
        if value.tzinfo is None:
            return value.isoformat() + "Z"
        return value.isoformat().replace("+00:00", "Z")


class DeliveryChallanListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    challan_date: date
    vehicle_no: str
    driver_name: str
    batch_no: Optional[str] = None
    invoice_count: int = 0
    total_qty: float = 0
    created_at: datetime

    @field_serializer("created_at")
    def serialize_created_at(self, value: datetime) -> str:
        if value.tzinfo is None:
            return value.isoformat() + "Z"
        return value.isoformat().replace("+00:00", "Z")


class DeliveryQtyByBatchOut(BaseModel):
    batch_no: str
    stock_group: str
    total_qty: float
    total_amount: float = 0


class DeliveryQtyByDateItem(BaseModel):
    challan_date: date
    total_qty: float


class DeliveryQtyByBatchDatesOut(BaseModel):
    batch_no: str
    stock_group: str
    items: List[DeliveryQtyByDateItem] = []
    total_qty: float = 0


class PendingDeliveryLineOut(BaseModel):
    stock_item: Optional[str] = None
    brand: Optional[str] = None
    packing: Optional[float] = None
    qty: float = 0
    bags_50: float = 0
    bags_100: float = 0


class PendingDeliveryInvoiceOut(BaseModel):
    voucher_no: str
    voucher_date: Optional[datetime] = None
    ledger_name: Optional[str] = None
    bags_50: float = 0
    bags_100: float = 0
    lines: List[PendingDeliveryLineOut] = []


class PendingDeliveryByStockGroupOut(BaseModel):
    stock_group: str
    invoice_count: int = 0
    bags_50: float = 0
    bags_100: float = 0
    invoices: List[PendingDeliveryInvoiceOut] = []


class PendingDeliveriesOut(BaseModel):
    items: List[PendingDeliveryByStockGroupOut] = []
    total_invoices: int = 0
    bags_50: float = 0
    bags_100: float = 0
