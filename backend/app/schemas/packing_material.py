from __future__ import annotations

from datetime import date, datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field, field_serializer


class PackingSkuOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    stock_item: str
    brand: str
    stock_group: Optional[str] = None
    unit: Optional[str] = None
    is_active: bool = True
    created_at: datetime
    opening_qty: Optional[float] = None
    purchase_qty: Optional[float] = None
    sales_qty: float = 0.0
    closing_qty: Optional[float] = None

    @field_serializer("created_at")
    def serialize_created_at(self, value: datetime) -> str:
        if value.tzinfo is None:
            return value.isoformat() + "Z"
        return value.isoformat().replace("+00:00", "Z")


class PackingSkuSyncOut(BaseModel):
    stock_groups: List[str]
    sku_count: int
    created_skus: int
    reactivated_skus: int
    deactivated_skus: int
    fy: str
    skus: List[PackingSkuOut] = []


class PackingFyStockOut(BaseModel):
    id: int
    fy: str
    status: str = "Open"
    sku_id: int
    stock_item: str
    brand: str
    stock_group: Optional[str] = None
    unit: Optional[str] = None
    opening_qty: float = 0.0
    purchase_qty: float = 0.0
    sales_qty: float = 0.0
    adjust_qty: float = 0.0
    closing_qty: float = 0.0


class PackingFyStockListOut(BaseModel):
    fy: str
    frozen: bool = False
    rows: List[PackingFyStockOut] = []


class PackingOpeningUpdate(BaseModel):
    opening_qty: float = Field(..., ge=0)


class PackingAdjustUpdate(BaseModel):
    adjust_qty: float


class PackingFyRowUpdate(BaseModel):
    sku_id: int
    adjust_qty: float = 0.0


class PackingFyBulkUpdate(BaseModel):
    rows: List[PackingFyRowUpdate]


class PackingFyFreezeUpdate(BaseModel):
    frozen: bool


class PackingPurchaseCreate(BaseModel):
    sku_id: int
    purchase_date: date
    qty: float = Field(..., gt=0)
    rate: Optional[float] = Field(default=None, ge=0)
    supplier: Optional[str] = Field(default=None, max_length=255)


class PackingPurchaseUpdate(BaseModel):
    purchase_date: date
    qty: float = Field(..., gt=0)
    rate: Optional[float] = Field(default=None, ge=0)
    supplier: Optional[str] = Field(default=None, max_length=255)


class PackingPurchaseOut(BaseModel):
    id: int
    sku_id: int
    purchase_date: date
    qty: float
    rate: Optional[float] = None
    supplier: Optional[str] = None
    stock_item: str
    brand: str
    fy: str
    created_at: datetime

    @field_serializer("created_at")
    def serialize_created_at(self, value: datetime) -> str:
        if value.tzinfo is None:
            return value.isoformat() + "Z"
        return value.isoformat().replace("+00:00", "Z")


class PackingPurchaseListOut(BaseModel):
    fy: str
    sku_id: int
    stock_item: str
    brand: str
    rows: List[PackingPurchaseOut] = []
