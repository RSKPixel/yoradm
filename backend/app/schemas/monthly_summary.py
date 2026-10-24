from typing import List, Optional

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
    overall_qty: Optional[float] = None
    overall_pct: Optional[float] = None
    overall_value: Optional[float] = None
    overall_rate: Optional[float] = None
    purchase_orid_dhall_qty: Optional[float] = None
    purchase_orid_dhall_rate: Optional[float] = None
    purchase_orid_dhall_value: Optional[float] = None
    purchase_orid_dhall_split_qty: Optional[float] = None
    purchase_orid_dhall_split_rate: Optional[float] = None
    purchase_orid_dhall_split_value: Optional[float] = None
    sales_orid_dhall_qty: Optional[float] = None
    sales_orid_dhall_rate: Optional[float] = None
    sales_orid_dhall_value: Optional[float] = None
    sales_orid_dhall_split_qty: Optional[float] = None
    sales_orid_dhall_split_rate: Optional[float] = None
    sales_orid_dhall_split_value: Optional[float] = None
    sales_orid_rejection_qty: Optional[float] = None
    sales_orid_rejection_rate: Optional[float] = None
    sales_orid_rejection_value: Optional[float] = None
    # Before the allocated invoice discount.
    sales_orid_dhall_gross_rate: Optional[float] = None
    sales_orid_dhall_gross_value: Optional[float] = None
    sales_orid_dhall_split_gross_rate: Optional[float] = None
    sales_orid_dhall_split_gross_value: Optional[float] = None
    sales_orid_rejection_gross_rate: Optional[float] = None
    sales_orid_rejection_gross_value: Optional[float] = None


class MonthlySummaryOut(BaseModel):
    year: int
    month: int = Field(ge=1, le=12)
    orid_production: MonthlyOridProductionOut


class MonthlyRateGroupOut(BaseModel):
    """Trade lines for one month grouped by Tally line rate."""

    line_rate: Optional[float] = None
    lines: int = 0
    invoices: int = 0
    bags: float = 0
    quintal: float = 0
    gross_value: float = 0
    gross_rate: Optional[float] = None
    discount: float = 0
    value: float = 0
    rate: Optional[float] = None


class MonthlyRateGroupsOut(BaseModel):
    kind: str
    stock_groups: List[str]
    items: List[MonthlyRateGroupOut] = Field(default_factory=list)
