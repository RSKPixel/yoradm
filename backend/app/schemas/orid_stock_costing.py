from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

OridCostingRawQtySource = Literal["in_stock", "pendings", "both", "manual"]


class OridStockCostingOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    raw_qty_source: Optional[str] = "both"
    manual_raw_qty: Optional[float] = None
    manual_raw_rate: Optional[float] = None
    manual_mfg_expenses_pct: Optional[float] = None
    manual_overheads_pct: Optional[float] = None
    manual_lot_id: Optional[int] = None
    orid_dhall_pct: Optional[float] = None
    orid_dhall_split_pct: Optional[float] = None
    orid_rejection_pct: Optional[float] = None
    orid_husk_pct: Optional[float] = None
    expenses_pct: Optional[float] = None
    split_rate: Optional[float] = None
    rejection_rate: Optional[float] = None
    husk_rate: Optional[float] = None
    dhall_cost_rate: Optional[float] = None
    dhall_overheads_pct: Optional[float] = None
    dhall_discount_pct: Optional[float] = None
    created_at: datetime
    updated_at: datetime


class OridStockCostingSaveIn(BaseModel):
    raw_qty_source: OridCostingRawQtySource = "both"
    manual_raw_qty: Optional[float] = Field(default=None)
    manual_raw_rate: Optional[float] = Field(default=None)
    manual_mfg_expenses_pct: Optional[float] = Field(default=None)
    manual_overheads_pct: Optional[float] = Field(default=None)
    manual_lot_id: Optional[int] = Field(default=None)
    orid_dhall_pct: Optional[float] = Field(default=None)
    orid_dhall_split_pct: Optional[float] = Field(default=None)
    orid_rejection_pct: Optional[float] = Field(default=None)
    orid_husk_pct: Optional[float] = Field(default=None)
    expenses_pct: Optional[float] = Field(default=None)
    split_rate: Optional[float] = Field(default=None)
    rejection_rate: Optional[float] = Field(default=None)
    husk_rate: Optional[float] = Field(default=None)
    dhall_cost_rate: Optional[float] = Field(default=None)
    dhall_overheads_pct: Optional[float] = Field(default=None)
    dhall_discount_pct: Optional[float] = Field(default=None)
