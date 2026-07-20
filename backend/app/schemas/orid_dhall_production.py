from datetime import date, datetime
from typing import List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_serializer, field_validator


def _empty_to_none(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    trimmed = value.strip()
    return trimmed or None


class OridDhallPurchaseLineIn(BaseModel):
    purchase_id: Optional[int] = None
    voucher_no: Optional[str] = Field(default=None, max_length=64)
    voucher_date: Optional[str] = Field(default=None, max_length=32)
    ledger_name: Optional[str] = Field(default=None, max_length=255)
    broker: Optional[str] = Field(default=None, max_length=255)
    stock_item: Optional[str] = Field(default=None, max_length=255)
    brand: Optional[str] = Field(default=None, max_length=128)
    packing: Optional[float] = None
    qty: Optional[float] = None
    weight: Optional[float] = None
    rate: Optional[float] = None
    amount: Optional[float] = None

    @field_validator(
        "voucher_no",
        "voucher_date",
        "ledger_name",
        "broker",
        "stock_item",
        "brand",
        mode="before",
    )
    @classmethod
    def strip_optional_str(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        return _empty_to_none(str(value))


PRODUCTION_STATUSES = ("Open", "Closed")


class OridDhallProductionCreate(BaseModel):
    production_date: date
    lot_no: Optional[str] = Field(default=None, max_length=64)
    status: Literal["Open", "Closed"] = "Open"
    wet_flour_yield: Optional[str] = Field(default=None, max_length=64)
    split_pct: Optional[str] = Field(default=None, max_length=64)
    opening_bags: Optional[str] = Field(default=None, max_length=64)
    opening_rate: Optional[str] = Field(default=None, max_length=64)
    previous_batch_bags: Optional[str] = Field(default=None, max_length=64)
    previous_batch_rate: Optional[str] = Field(default=None, max_length=64)
    delivery_bags: Optional[str] = Field(default=None, max_length=64)
    delivery_rate: Optional[str] = Field(default=None, max_length=64)
    closing_bags: Optional[str] = Field(default=None, max_length=64)
    closing_rate: Optional[str] = Field(default=None, max_length=64)
    split_bags: Optional[str] = Field(default=None, max_length=64)
    split_rate: Optional[str] = Field(default=None, max_length=64)
    sortex_bags: Optional[str] = Field(default=None, max_length=64)
    sortex_rate: Optional[str] = Field(default=None, max_length=64)
    husk_bags: Optional[str] = Field(default=None, max_length=64)
    husk_rate: Optional[str] = Field(default=None, max_length=64)
    raw_purchases: List[OridDhallPurchaseLineIn] = Field(default_factory=list)
    avg_purchases: List[OridDhallPurchaseLineIn] = Field(default_factory=list)

    @field_validator(
        "lot_no",
        "wet_flour_yield",
        "split_pct",
        "opening_bags",
        "opening_rate",
        "previous_batch_bags",
        "previous_batch_rate",
        "delivery_bags",
        "delivery_rate",
        "closing_bags",
        "closing_rate",
        "split_bags",
        "split_rate",
        "sortex_bags",
        "sortex_rate",
        "husk_bags",
        "husk_rate",
        mode="before",
    )
    @classmethod
    def strip_optional(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        return _empty_to_none(str(value))


class OridDhallPurchaseLineOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    line_kind: Literal["raw", "avg"]
    purchase_id: Optional[int] = None
    voucher_no: Optional[str] = None
    voucher_date: Optional[str] = None
    ledger_name: Optional[str] = None
    broker: Optional[str] = None
    stock_item: Optional[str] = None
    brand: Optional[str] = None
    packing: Optional[float] = None
    qty: Optional[float] = None
    weight: Optional[float] = None
    rate: Optional[float] = None
    amount: Optional[float] = None
    line_no: int


class OridDhallProductionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    production_date: date
    lot_no: Optional[str] = None
    status: Literal["Open", "Closed"] = "Open"
    wet_flour_yield: Optional[str] = None
    split_pct: Optional[str] = None
    opening_bags: Optional[str] = None
    opening_rate: Optional[str] = None
    previous_batch_bags: Optional[str] = None
    previous_batch_rate: Optional[str] = None
    delivery_bags: Optional[str] = None
    delivery_rate: Optional[str] = None
    closing_bags: Optional[str] = None
    closing_rate: Optional[str] = None
    split_bags: Optional[str] = None
    split_rate: Optional[str] = None
    sortex_bags: Optional[str] = None
    sortex_rate: Optional[str] = None
    husk_bags: Optional[str] = None
    husk_rate: Optional[str] = None
    created_by: Optional[int] = None
    created_at: datetime
    updated_at: datetime
    raw_purchases: List[OridDhallPurchaseLineOut] = []
    avg_purchases: List[OridDhallPurchaseLineOut] = []

    @field_serializer("created_at", "updated_at")
    def serialize_datetimes(self, value: datetime) -> str:
        if value.tzinfo is None:
            return value.isoformat() + "Z"
        return value.isoformat().replace("+00:00", "Z")


class OridDhallProductionListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    production_date: date
    lot_no: Optional[str] = None
    status: Literal["Open", "Closed"] = "Open"
    orid_raw_qty: Optional[float] = None
    orid_raw_pct: Optional[float] = None
    orid_dhall_qty: Optional[float] = None
    orid_dhall_pct: Optional[float] = None
    orid_dhall_split_qty: Optional[float] = None
    orid_dhall_split_pct: Optional[float] = None
    orid_rejection_qty: Optional[float] = None
    orid_rejection_pct: Optional[float] = None
    orid_husk_qty: Optional[float] = None
    orid_husk_pct: Optional[float] = None
    overall_pct: Optional[float] = None
    net_value: Optional[float] = None
    created_at: datetime

    @field_serializer("created_at")
    def serialize_created_at(self, value: datetime) -> str:
        if value.tzinfo is None:
            return value.isoformat() + "Z"
        return value.isoformat().replace("+00:00", "Z")


class OridDhallOpenBatchItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    lot_no: Optional[str] = None
    production_date: date
    status: Literal["Open", "Closed"] = "Open"


class OridDhallPeriodYearOut(BaseModel):
    fy_start: int
    label: str
    months: List[int] = []


class OridDhallPeriodOptionsOut(BaseModel):
    financial_years: List[OridDhallPeriodYearOut] = []


class OridDhallProductionStatusUpdate(BaseModel):
    status: Literal["Open", "Closed"]


class OridStockPositionLineOut(BaseModel):
    voucher_no: str
    voucher_date: Optional[date] = None
    ledger_name: Optional[str] = None
    broker: Optional[str] = None
    stock_item: Optional[str] = None
    brand: Optional[str] = None
    packing: Optional[float] = None
    qty: float = 0
    weight: float = 0
    rate: Optional[float] = None
    amount: float = 0
    bags_50: float = 0
    bags_100: float = 0


class OridStockPositionItemOut(BaseModel):
    """Unselected purchase stock (not yet used on any production)."""

    stock_group: str
    label: str
    voucher_count: int = 0
    qty: float = 0
    weight: float = 0
    amount: float = 0
    avg_rate: float = 0  # ₹ per quintal: (amount / weight) × 100
    bags_50: float = 0
    bags_100: float = 0
    lines: List[OridStockPositionLineOut] = []


class OridStockPositionOut(BaseModel):
    items: List[OridStockPositionItemOut] = []
    total_vouchers: int = 0
    qty: float = 0
    weight: float = 0
    amount: float = 0
    avg_rate: float = 0
    bags_50: float = 0
    bags_100: float = 0
