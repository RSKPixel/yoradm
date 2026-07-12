from datetime import datetime
from typing import Optional

from sqlalchemy import BigInteger, DateTime, Float, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class TallyAccountMaster(Base):
    __tablename__ = "tallydata_accountmaster"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    ledger_name: Mapped[Optional[str]] = mapped_column("LEDGER_NAME", Text)
    address_1: Mapped[Optional[str]] = mapped_column("ADDRESS_1", Text)
    address_2: Mapped[Optional[str]] = mapped_column("ADDRESS_2", Text)
    address_3: Mapped[Optional[str]] = mapped_column("ADDRESS_3", Text)
    address_4: Mapped[Optional[str]] = mapped_column("ADDRESS_4", Text)
    pin_code: Mapped[Optional[str]] = mapped_column("PIN_CODE", Text)
    party_gstin: Mapped[Optional[str]] = mapped_column("PARTY_GSTIN", Text)
    pan: Mapped[Optional[str]] = mapped_column("PAN", Text)
    primary_group: Mapped[Optional[str]] = mapped_column("PRIMARY_GROUP", Text)
    favouring_name: Mapped[Optional[str]] = mapped_column("FAVOURING_NAME", Text)
    account_number: Mapped[Optional[str]] = mapped_column("ACCOUNT_NUMBER", Text)
    bank_code: Mapped[Optional[str]] = mapped_column("BANK_CODE", Text)
    bank_name: Mapped[Optional[str]] = mapped_column("BANK_NAME", Text)
    performance: Mapped[Optional[str]] = mapped_column("PERFORMANCE", Text)
    representative: Mapped[Optional[str]] = mapped_column("REPRESENTATIVE", Text)


class TallyCostCentre(Base):
    __tablename__ = "tallydata_costcentre"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    name: Mapped[Optional[str]] = mapped_column("NAME", Text)
    parent: Mapped[Optional[str]] = mapped_column("PARENT", Text)


class TallyDaybook(Base):
    __tablename__ = "tallydata_daybook"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    vtype: Mapped[Optional[str]] = mapped_column("VTYPE", Text)
    vno: Mapped[Optional[str]] = mapped_column("VNO", Text)
    vdt: Mapped[Optional[datetime]] = mapped_column("VDT", DateTime)
    ledger_name: Mapped[Optional[str]] = mapped_column("LEDGER_NAME", Text)
    ledger_amount: Mapped[Optional[float]] = mapped_column("LEDGER_AMOUNT", Float)
    bill_no: Mapped[Optional[str]] = mapped_column("BILL_NO", Text)
    bill_type: Mapped[Optional[str]] = mapped_column("BILL_TYPE", Text)
    bill_amount: Mapped[Optional[float]] = mapped_column("BILL_AMOUNT", Float)
    narration: Mapped[Optional[str]] = mapped_column("NARRATION", Text)


class TallyDaybook2(Base):
    __tablename__ = "tallydata_daybook2"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    vtype: Mapped[Optional[str]] = mapped_column("VTYPE", Text)
    vno: Mapped[Optional[str]] = mapped_column("VNO", Text)
    vdt: Mapped[Optional[datetime]] = mapped_column("VDT", DateTime)
    narration: Mapped[Optional[str]] = mapped_column("NARRATION", Text)
    ledger_name: Mapped[Optional[str]] = mapped_column("LEDGER_NAME", Text)
    costcentre_name: Mapped[Optional[str]] = mapped_column("COSTCENTRE_NAME", Text)
    costcentre_amt: Mapped[Optional[float]] = mapped_column("COSTCENTRE_AMT", Float)
    ledger_amount: Mapped[Optional[float]] = mapped_column("LEDGER_AMOUNT", Float)
    bill_no: Mapped[Optional[str]] = mapped_column("BILL_NO", Text)
    bill_type: Mapped[Optional[str]] = mapped_column("BILL_TYPE", Text)


class TallyInventoryMaster(Base):
    __tablename__ = "tallydata_inventorymaster"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    stock_item: Mapped[Optional[str]] = mapped_column(Text)
    packing: Mapped[Optional[float]] = mapped_column(Float)
    stock_group: Mapped[Optional[str]] = mapped_column(Text)
    base_unit: Mapped[Optional[str]] = mapped_column(Text)
    additional_unit: Mapped[Optional[str]] = mapped_column(Text)


class TallyPurchase(Base):
    __tablename__ = "tallydata_purchases"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    voucher_no: Mapped[Optional[str]] = mapped_column(Text)
    voucher_date: Mapped[Optional[datetime]] = mapped_column(DateTime)
    ledger_name: Mapped[Optional[str]] = mapped_column(Text)
    broker: Mapped[Optional[str]] = mapped_column(Text)
    item_count: Mapped[Optional[float]] = mapped_column(Float)
    itemno: Mapped[Optional[float]] = mapped_column(Float)
    stock_item: Mapped[Optional[str]] = mapped_column(Text)
    brand: Mapped[Optional[str]] = mapped_column(Text)
    packing: Mapped[Optional[float]] = mapped_column(Float)
    qty: Mapped[Optional[float]] = mapped_column(Float)
    weight: Mapped[Optional[float]] = mapped_column(Float)
    rate: Mapped[Optional[float]] = mapped_column(Float)
    amount: Mapped[Optional[float]] = mapped_column(Float)


class TallyReceivable(Base):
    __tablename__ = "tallydata_receivables"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    invoice_no: Mapped[Optional[str]] = mapped_column(Text)
    invoice_date: Mapped[Optional[datetime]] = mapped_column(DateTime)
    ledger_name: Mapped[Optional[str]] = mapped_column(Text)
    representative: Mapped[Optional[str]] = mapped_column(Text)
    amount: Mapped[Optional[float]] = mapped_column(Float)


class TallySale(Base):
    __tablename__ = "tallydata_sales"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    voucher_no: Mapped[Optional[str]] = mapped_column(Text)
    voucher_date: Mapped[Optional[datetime]] = mapped_column(DateTime)
    ledger_name: Mapped[Optional[str]] = mapped_column(Text)
    broker: Mapped[Optional[str]] = mapped_column(Text)
    item_count: Mapped[Optional[float]] = mapped_column(Float)
    item_no: Mapped[Optional[float]] = mapped_column(Float)
    stock_item: Mapped[Optional[str]] = mapped_column(Text)
    brand: Mapped[Optional[str]] = mapped_column(Text)
    packing: Mapped[Optional[float]] = mapped_column(Float)
    qty: Mapped[Optional[float]] = mapped_column(Float)
    rate: Mapped[Optional[float]] = mapped_column(Float)
    amount: Mapped[Optional[float]] = mapped_column(Float)
    discount: Mapped[Optional[float]] = mapped_column(Float)
    cartage: Mapped[Optional[float]] = mapped_column(Float)


class TallyStockGroup(Base):
    __tablename__ = "tallydata_stockgroups"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    stock_group: Mapped[Optional[str]] = mapped_column(Text)
    parent: Mapped[Optional[str]] = mapped_column(Text)


class TallyStockSummary(Base):
    __tablename__ = "tallydata_stocksummary"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    vno: Mapped[Optional[str]] = mapped_column("VNO", Text)
    vdt: Mapped[Optional[datetime]] = mapped_column("VDT", DateTime)
    stock_item: Mapped[Optional[str]] = mapped_column("STOCK_ITEM", Text)
    packing: Mapped[Optional[float]] = mapped_column("PACKING", Float)
    particulars: Mapped[Optional[str]] = mapped_column("PARTICULARS", Text)
    opening: Mapped[Optional[float]] = mapped_column("OPENING", Float)
    vtype: Mapped[Optional[str]] = mapped_column("VTYPE", Text)
    outwards: Mapped[Optional[float]] = mapped_column("OUTWARDS", Float)
    inwards: Mapped[Optional[float]] = mapped_column("INWARDS", Float)
