from datetime import datetime
from typing import Optional

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


class CostCentreOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: Optional[str] = None
    parent: Optional[str] = None


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
