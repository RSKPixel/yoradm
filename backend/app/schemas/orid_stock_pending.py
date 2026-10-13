from __future__ import annotations

from datetime import date, datetime
from typing import List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

OridPendingStockGroup = Literal["Orid Raw", "Orid Dhall"]
OridPendingStatus = Literal["pending_purchase", "pending_arrival"]


class OridStockPendingOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    stock_group: str
    broker: Optional[str] = None
    po_date: Optional[date] = None
    delivery_date: Optional[date] = None
    qty: Optional[float] = None
    rate: Optional[float] = None
    status: str
    created_at: datetime
    updated_at: datetime


class OridStockPendingCreate(BaseModel):
    stock_group: OridPendingStockGroup
    broker: Optional[str] = Field(default=None, max_length=255)
    po_date: Optional[date] = None
    delivery_date: Optional[date] = None
    qty: Optional[float] = None
    rate: Optional[float] = None
    status: OridPendingStatus = "pending_purchase"

    @field_validator("broker")
    @classmethod
    def normalize_broker(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        text = value.strip()
        return text or None


class OridStockPendingUpdate(BaseModel):
    broker: Optional[str] = Field(default=None, max_length=255)
    po_date: Optional[date] = None
    delivery_date: Optional[date] = None
    qty: Optional[float] = None
    rate: Optional[float] = None
    status: Optional[OridPendingStatus] = None

    @field_validator("broker")
    @classmethod
    def normalize_broker(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        text = value.strip()
        return text or None


class OridStockPendingListOut(BaseModel):
    rows: List[OridStockPendingOut] = []
