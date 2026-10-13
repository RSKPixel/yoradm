from __future__ import annotations

from datetime import date, datetime
from typing import Any, List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

OridEstimatedSalesMode = Literal[
    "manual",
    "last_30_days",
    "last_month",
    "last_3_months_avg",
]


class OridWorkingsMetricIn(BaseModel):
    qty: Optional[float] = None
    rate: Optional[float] = None
    value: Optional[float] = None


class OridWorkingsRowIn(BaseModel):
    id: str = Field(min_length=1, max_length=64)
    orid: OridWorkingsMetricIn = OridWorkingsMetricIn()
    orid_dhall: OridWorkingsMetricIn = OridWorkingsMetricIn()


class OridStockWorkingsOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    as_of: Optional[date] = None
    estimated_sales_mode: Optional[str] = "manual"
    estimated_sales_50kg: Optional[float] = None
    qty_in_50kg: Optional[float] = None
    estimated_days: Optional[float] = None
    rows_json: Optional[Any] = None
    created_at: datetime
    updated_at: datetime


class OridStockWorkingsSaveIn(BaseModel):
    as_of: Optional[date] = None
    estimated_sales_mode: OridEstimatedSalesMode = "manual"
    estimated_sales_50kg: Optional[float] = None
    qty_in_50kg: Optional[float] = None
    estimated_days: Optional[float] = None
    rows: List[OridWorkingsRowIn] = []
