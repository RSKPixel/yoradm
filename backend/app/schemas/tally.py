from datetime import date, datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict


class AccountMasterOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    ledger_name: Optional[str] = None
    address_1: Optional[str] = None
    pin_code: Optional[str] = None
    party_gstin: Optional[str] = None
    pan: Optional[str] = None
    primary_group: Optional[str] = None
    bank_name: Optional[str] = None
    representative: Optional[str] = None


class InventoryMasterOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    stock_item: Optional[str] = None
    packing: Optional[float] = None
    stock_group: Optional[str] = None
    base_unit: Optional[str] = None
    additional_unit: Optional[str] = None


class SaleOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    voucher_no: Optional[str] = None
    voucher_date: Optional[datetime] = None
    ledger_name: Optional[str] = None
    broker: Optional[str] = None
    stock_item: Optional[str] = None
    brand: Optional[str] = None
    packing: Optional[float] = None
    qty: Optional[float] = None
    rate: Optional[float] = None
    amount: Optional[float] = None
    discount: Optional[float] = None
    cartage: Optional[float] = None


class SaleInvoiceOptionOut(BaseModel):
    voucher_no: str
    voucher_date: Optional[datetime] = None
    ledger_name: Optional[str] = None


class SaleInvoiceLineOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    voucher_no: Optional[str] = None
    voucher_date: Optional[datetime] = None
    ledger_name: Optional[str] = None
    stock_item: Optional[str] = None
    brand: Optional[str] = None
    packing: Optional[float] = None
    qty: Optional[float] = None
    rate: Optional[float] = None
    amount: Optional[float] = None
    discount: Optional[float] = None


class CostCentreOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: Optional[str] = None
    parent: Optional[str] = None


class VendorOptionOut(BaseModel):
    ledger_name: str
    primary_group: Optional[str] = None


class InventoryItemOptionOut(BaseModel):
    stock_item: str
    stock_group: Optional[str] = None
    packing: Optional[float] = None


class VendorTdsStatusOut(BaseModel):
    vendor: str
    purchase_total: float = 0
    invoice_value: float = 0
    projected_total: float = 0
    tds_purchase_pct: Optional[float] = None
    tds_threshold: Optional[float] = None
    tds_applicable: bool = False
    tds_value: Optional[float] = None
    fy_start: Optional[str] = None
    fy_end: Optional[str] = None


class TdsWorkingsRow(BaseModel):
    source_id: Optional[int] = None
    voucher_date: Optional[str] = None
    voucher_no: Optional[str] = None
    party: Optional[str] = None
    pan: Optional[str] = None
    tds_head: Optional[str] = None
    amount: float = 0.0
    narration: Optional[str] = None
    bill_no: Optional[str] = None
    bill_type: Optional[str] = None
    expenses_date: Optional[str] = None
    expenses_amount: Optional[float] = None
    status: str = "matched"  # matched | new | deleted


class TdsWorkingsOut(BaseModel):
    date_from: str
    date_to: str
    row_count: int = 0
    total_amount: float = 0.0
    saved: bool = False
    new_count: int = 0
    deleted_count: int = 0
    rows: List[TdsWorkingsRow] = []


class DaybookAvailabilityOut(BaseModel):
    date_from: Optional[date] = None
    date_to: Optional[date] = None


class PurchaseOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    voucher_no: Optional[str] = None
    voucher_date: Optional[datetime] = None
    ledger_name: Optional[str] = None
    broker: Optional[str] = None
    stock_item: Optional[str] = None
    brand: Optional[str] = None
    packing: Optional[float] = None
    qty: Optional[float] = None
    weight: Optional[float] = None
    rate: Optional[float] = None
    amount: Optional[float] = None


class StockSummaryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    vno: Optional[str] = None
    vdt: Optional[datetime] = None
    stock_item: Optional[str] = None
    packing: Optional[float] = None
    particulars: Optional[str] = None
    opening: Optional[float] = None
    vtype: Optional[str] = None
    outwards: Optional[float] = None
    inwards: Optional[float] = None


class ReceivableOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    invoice_no: Optional[str] = None
    invoice_date: Optional[datetime] = None
    ledger_name: Optional[str] = None
    representative: Optional[str] = None
    amount: Optional[float] = None


class ReceivableRepresentativeOut(BaseModel):
    name: str
    invoice_count: int
    total_amount: float


class ReceivableAgeingBuckets(BaseModel):
    bucket_0_30: float = 0.0
    bucket_31_60: float = 0.0
    bucket_61_90: float = 0.0
    bucket_91_120: float = 0.0
    bucket_above_120: float = 0.0
    bucket_undated: float = 0.0
    total: float = 0.0
    invoice_count: int = 0


class ReceivablePartyAgeingOut(ReceivableAgeingBuckets):
    ledger_name: str
    representative: Optional[str] = None


class ReceivableInvoiceAgeingOut(BaseModel):
    id: int
    invoice_no: Optional[str] = None
    invoice_date: Optional[datetime] = None
    ledger_name: Optional[str] = None
    representative: Optional[str] = None
    amount: float = 0.0
    days: Optional[int] = None
    age_bucket: str


class ReceivableAnalysisOut(BaseModel):
    as_of: str
    representative: Optional[str] = None
    totals: ReceivableAgeingBuckets
    parties: List[ReceivablePartyAgeingOut]
    invoices: List[ReceivableInvoiceAgeingOut]


class DaybookTradePointOut(BaseModel):
    date: str
    label: str
    sales: float = 0.0
    purchase: float = 0.0
    receipt: float = 0.0
    payment: float = 0.0
    sales_vouchers: int = 0
    purchase_vouchers: int = 0
    receipt_vouchers: int = 0
    payment_vouchers: int = 0


class DaybookTradeOut(BaseModel):
    date_from: str
    date_to: str
    sales_total: float = 0.0
    purchase_total: float = 0.0
    receipt_total: float = 0.0
    payment_total: float = 0.0
    net_trade: float = 0.0
    net_cash: float = 0.0
    coverage_pct: Optional[float] = None
    collection_pct: Optional[float] = None
    sales_vouchers: int = 0
    purchase_vouchers: int = 0
    receipt_vouchers: int = 0
    payment_vouchers: int = 0
    points: List[DaybookTradePointOut] = []


class CollectionAgeBucketOut(BaseModel):
    key: str
    label: str
    amount: float = 0.0
    count: int = 0
    pct: float = 0.0


class CollectionPerformanceOut(BaseModel):
    date_from: str
    date_to: str
    total_amount: float = 0.0
    matched_amount: float = 0.0
    unmatched_amount: float = 0.0
    matched_count: int = 0
    unmatched_count: int = 0
    avg_days: Optional[float] = None
    buckets: List[CollectionAgeBucketOut] = []
