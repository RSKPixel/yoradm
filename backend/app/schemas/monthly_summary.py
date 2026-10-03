from typing import Optional

from pydantic import BaseModel, Field


class MonthlyOridProductionOut(BaseModel):
    """Closed Orid productions clubbed for one calendar month."""

    lot_count: int = 0
    orid_raw_qty: Optional[float] = None
    orid_raw_pct: Optional[float] = None
    orid_raw_value: Optional[float] = None
    orid_raw_rate: Optional[float] = None
    orid_dhall_qty: Optional[float] = None
    orid_dhall_pct: Optional[float] = None
    orid_dhall_value: Optional[float] = None
    orid_dhall_rate: Optional[float] = None
    orid_dhall_split_qty: Optional[float] = None
    orid_dhall_split_pct: Optional[float] = None
    orid_dhall_split_value: Optional[float] = None
    orid_dhall_split_rate: Optional[float] = None
    orid_rejection_qty: Optional[float] = None
    orid_rejection_pct: Optional[float] = None
    orid_rejection_value: Optional[float] = None
    orid_rejection_rate: Optional[float] = None
    orid_husk_qty: Optional[float] = None
    orid_husk_pct: Optional[float] = None
    orid_husk_value: Optional[float] = None
    orid_husk_rate: Optional[float] = None
    overall_qty: Optional[float] = None
    overall_pct: Optional[float] = None
    overall_value: Optional[float] = None
    overall_rate: Optional[float] = None
    net_value: Optional[float] = None
    opening_qty: Optional[float] = None
    opening_rate: Optional[float] = None
    opening_value: Optional[float] = None
    sales_orid_raw_qty: Optional[float] = None
    sales_orid_raw_rate: Optional[float] = None
    sales_orid_raw_value: Optional[float] = None
    sales_orid_dhall_qty: Optional[float] = None
    sales_orid_dhall_rate: Optional[float] = None
    sales_orid_dhall_value: Optional[float] = None
    sales_orid_dhall_split_qty: Optional[float] = None
    sales_orid_dhall_split_rate: Optional[float] = None
    sales_orid_dhall_split_value: Optional[float] = None
    sales_orid_rejection_qty: Optional[float] = None
    sales_orid_rejection_rate: Optional[float] = None
    sales_orid_rejection_value: Optional[float] = None
    sales_orid_husk_qty: Optional[float] = None
    sales_orid_husk_rate: Optional[float] = None
    sales_orid_husk_value: Optional[float] = None
    sales_overall_qty: Optional[float] = None
    sales_overall_rate: Optional[float] = None
    sales_overall_value: Optional[float] = None
    purchase_orid_raw_qty: Optional[float] = None
    purchase_orid_raw_rate: Optional[float] = None
    purchase_orid_raw_value: Optional[float] = None
    purchase_orid_dhall_qty: Optional[float] = None
    purchase_orid_dhall_rate: Optional[float] = None
    purchase_orid_dhall_value: Optional[float] = None
    purchase_orid_dhall_split_qty: Optional[float] = None
    purchase_orid_dhall_split_rate: Optional[float] = None
    purchase_orid_dhall_split_value: Optional[float] = None
    purchase_orid_rejection_qty: Optional[float] = None
    purchase_orid_rejection_rate: Optional[float] = None
    purchase_orid_rejection_value: Optional[float] = None
    purchase_orid_husk_qty: Optional[float] = None
    purchase_orid_husk_rate: Optional[float] = None
    purchase_orid_husk_value: Optional[float] = None
    purchase_overall_qty: Optional[float] = None
    purchase_overall_rate: Optional[float] = None
    purchase_overall_value: Optional[float] = None


class MonthlySummaryOut(BaseModel):
    year: int
    month: int = Field(ge=1, le=12)
    orid_production: MonthlyOridProductionOut
