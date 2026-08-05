from __future__ import annotations

from typing import List, Literal, Optional

from pydantic import BaseModel, Field


BrokerageSide = Literal["sale", "purchase"]


class BrokerageBrokersOut(BaseModel):
    brokers: List[str] = []


class BrokerageRowOut(BaseModel):
    side: BrokerageSide
    stock_item: str
    qty: float = 0.0
    qty_adjust: float = 0.0
    adjusted_qty: float = 0.0
    quintals: float = 0.0
    rate_per_quintal: Optional[float] = None
    brokerage_amount: float = 0.0
    tds_amount: float = 0.0
    net_amount: float = 0.0


class BrokerageSectionOut(BaseModel):
    side: BrokerageSide
    rows: List[BrokerageRowOut] = []
    total_qty: float = 0.0
    total_quintals: float = 0.0
    total_brokerage: float = 0.0


class BrokerageWorkingsOut(BaseModel):
    fy_start: int
    month: int
    broker: str
    date_from: str
    date_to: str
    tds_percent: Optional[float] = None
    sales: BrokerageSectionOut
    purchases: BrokerageSectionOut
    is_saved: bool = False
    has_saved: bool = False
    matches_saved: bool = False


class BrokerageLineSaveIn(BaseModel):
    side: BrokerageSide
    stock_item: str = Field(min_length=1, max_length=255)
    qty: float = 0.0
    qty_adjust: float = Field(default=0.0, ge=0)
    adjusted_qty: float = 0.0
    quintals: float = 0.0
    rate_per_quintal: Optional[float] = None
    brokerage_amount: float = 0.0
    tds_amount: float = 0.0
    net_amount: float = 0.0


class BrokerageSaveIn(BaseModel):
    fy_start: int
    month: int = Field(ge=1, le=12)
    broker: str = Field(min_length=1, max_length=255)
    tds_percent: Optional[float] = None
    lines: List[BrokerageLineSaveIn] = []


# Backward-compatible alias used by older clients.
class BrokerageRateItemIn(BaseModel):
    side: BrokerageSide
    stock_item: str = Field(min_length=1, max_length=255)
    rate_per_quintal: Optional[float] = None
    qty_adjust: Optional[float] = Field(default=None, ge=0)


class BrokerageRatesSaveIn(BaseModel):
    fy_start: int
    month: int = Field(ge=1, le=12)
    broker: str = Field(min_length=1, max_length=255)
    tds_percent: Optional[float] = None
    rates: List[BrokerageRateItemIn] = []
    lines: List[BrokerageLineSaveIn] = []


class BrokerageBuyerRowOut(BaseModel):
    buyer: str
    qty: float = 0.0
    quintals: float = 0.0


class BrokerageBuyersOut(BaseModel):
    fy_start: int
    month: int
    broker: str
    rows: List[BrokerageBuyerRowOut] = []
    total_qty: float = 0.0
    total_quintals: float = 0.0
