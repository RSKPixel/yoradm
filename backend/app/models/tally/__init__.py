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


class TallySyncAccount(Base):
    """Tally accounts sync (replaces tallydata_accountmaster for live reads)."""

    __tablename__ = "tallysync_accounts"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    master_id: Mapped[Optional[str]] = mapped_column(Text)
    guid: Mapped[Optional[str]] = mapped_column(Text)
    ledger_name: Mapped[Optional[str]] = mapped_column(Text)
    account_group: Mapped[Optional[str]] = mapped_column(Text)
    mailing_name: Mapped[Optional[str]] = mapped_column(Text)
    # App/API still call this party_gstin; DB column is gstin.
    party_gstin: Mapped[Optional[str]] = mapped_column("gstin", Text)
    gst_registration_type: Mapped[Optional[str]] = mapped_column(Text)
    state: Mapped[Optional[str]] = mapped_column(Text)
    country: Mapped[Optional[str]] = mapped_column(Text)
    pan: Mapped[Optional[str]] = mapped_column(Text)
    phone: Mapped[Optional[str]] = mapped_column(Text)
    mobile: Mapped[Optional[str]] = mapped_column(Text)
    email: Mapped[Optional[str]] = mapped_column(Text)
    bill_wise: Mapped[Optional[str]] = mapped_column(Text)
    address_1: Mapped[Optional[str]] = mapped_column(Text)
    address_2: Mapped[Optional[str]] = mapped_column(Text)
    address_3: Mapped[Optional[str]] = mapped_column(Text)
    address_4: Mapped[Optional[str]] = mapped_column(Text)
    pin_code: Mapped[Optional[str]] = mapped_column(Text)
    favouring_name: Mapped[Optional[str]] = mapped_column(Text)
    account_number: Mapped[Optional[str]] = mapped_column(Text)
    bank_code: Mapped[Optional[str]] = mapped_column(Text)
    bank_name: Mapped[Optional[str]] = mapped_column(Text)
    representative: Mapped[Optional[str]] = mapped_column(Text)
    primary_group: Mapped[Optional[str]] = mapped_column(Text)


class TallyCostCentre(Base):
    __tablename__ = "tallydata_costcentre"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    name: Mapped[Optional[str]] = mapped_column("NAME", Text)
    parent: Mapped[Optional[str]] = mapped_column("PARENT", Text)


class TallySyncCostCentre(Base):
    """Tally cost centres sync (replaces tallydata_costcentre for live reads)."""

    __tablename__ = "tallysync_costcentres"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    master_id: Mapped[Optional[str]] = mapped_column(Text)
    guid: Mapped[Optional[str]] = mapped_column(Text)
    # App/API still call this name; DB column is cost_centre.
    name: Mapped[Optional[str]] = mapped_column("cost_centre", Text)
    parent: Mapped[Optional[str]] = mapped_column(Text)
    category: Mapped[Optional[str]] = mapped_column(Text)


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
    debit_credit: Mapped[Optional[str]] = mapped_column("DEBIT_CREDIT", Text)
    ledger_name: Mapped[Optional[str]] = mapped_column("LEDGER_NAME", Text)
    costcentre_name: Mapped[Optional[str]] = mapped_column("COSTCENTRE_NAME", Text)
    costcentre_amt: Mapped[Optional[float]] = mapped_column("COSTCENTRE_AMT", Float)
    ledger_amount: Mapped[Optional[float]] = mapped_column("LEDGER_AMOUNT", Float)
    bill_no: Mapped[Optional[str]] = mapped_column("BILL_NO", Text)
    bill_type: Mapped[Optional[str]] = mapped_column("BILL_TYPE", Text)


class TallySyncDaybook(Base):
    """Tally daybook sync (replaces tallydata_daybook2 for live reads).

    Attribute names match TallyDaybook2 so TDS / trade callers stay unchanged.
    """

    __tablename__ = "tallysync_daybook"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    vtype: Mapped[Optional[str]] = mapped_column("voucher_type", Text)
    vno: Mapped[Optional[str]] = mapped_column("voucher_no", Text)
    vdt: Mapped[Optional[datetime]] = mapped_column("voucher_date", DateTime)
    narration: Mapped[Optional[str]] = mapped_column(Text)
    debit_credit: Mapped[Optional[str]] = mapped_column(Text)
    ledger_name: Mapped[Optional[str]] = mapped_column(Text)
    costcentre_name: Mapped[Optional[str]] = mapped_column(Text)
    costcentre_amt: Mapped[Optional[float]] = mapped_column(Float)
    ledger_amount: Mapped[Optional[float]] = mapped_column(Float)
    bill_no: Mapped[Optional[str]] = mapped_column(Text)
    bill_type: Mapped[Optional[str]] = mapped_column(Text)


class TallyInventoryMaster(Base):
    __tablename__ = "tallydata_inventorymaster"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    stock_item: Mapped[Optional[str]] = mapped_column(Text)
    packing: Mapped[Optional[float]] = mapped_column(Float)
    stock_group: Mapped[Optional[str]] = mapped_column(Text)
    base_unit: Mapped[Optional[str]] = mapped_column(Text)
    additional_unit: Mapped[Optional[str]] = mapped_column(Text)


class TallySyncInventory(Base):
    """Tally inventory sync (replaces tallydata_inventorymaster for live reads)."""

    __tablename__ = "tallysync_inventory"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    master_id: Mapped[Optional[str]] = mapped_column(Text)
    guid: Mapped[Optional[str]] = mapped_column(Text)
    stock_item: Mapped[Optional[str]] = mapped_column(Text)
    stock_group: Mapped[Optional[str]] = mapped_column(Text)
    category: Mapped[Optional[str]] = mapped_column(Text)
    base_unit: Mapped[Optional[str]] = mapped_column(Text)
    alternate_unit: Mapped[Optional[str]] = mapped_column(Text)
    conversion: Mapped[Optional[float]] = mapped_column(Float)
    denominator: Mapped[Optional[float]] = mapped_column(Float)
    packing: Mapped[Optional[float]] = mapped_column(Float)
    gst_applicable: Mapped[Optional[str]] = mapped_column(Text)

    @property
    def additional_unit(self) -> Optional[str]:
        """Alias for InventoryMasterOut / older additional_unit callers."""
        return self.alternate_unit


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


class TallySyncPurchase(Base):
    """Tally purchase sync (same columns as tallydata_purchases)."""

    __tablename__ = "tallysync_purchases"

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
    box: Mapped[Optional[float]] = mapped_column(Float)
    qty_per_box: Mapped[Optional[float]] = mapped_column(Float)


class TallyReceivable(Base):
    __tablename__ = "tallydata_receivables"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    invoice_no: Mapped[Optional[str]] = mapped_column(Text)
    invoice_date: Mapped[Optional[datetime]] = mapped_column(DateTime)
    ledger_name: Mapped[Optional[str]] = mapped_column(Text)
    representative: Mapped[Optional[str]] = mapped_column(Text)
    amount: Mapped[Optional[float]] = mapped_column(Float)


class TallySyncReceivable(Base):
    """Tally receivables sync (replaces tallydata_receivables for live reads)."""

    __tablename__ = "tallysync_receivables"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    as_on: Mapped[Optional[datetime]] = mapped_column(DateTime)
    invoice_no: Mapped[Optional[str]] = mapped_column(Text)
    invoice_date: Mapped[Optional[datetime]] = mapped_column(DateTime)
    due_date: Mapped[Optional[datetime]] = mapped_column(DateTime)
    overdue_days: Mapped[Optional[float]] = mapped_column(Float)
    ledger_name: Mapped[Optional[str]] = mapped_column(Text)
    representative: Mapped[Optional[str]] = mapped_column(Text)
    amount: Mapped[Optional[float]] = mapped_column(Float)
    closing: Mapped[Optional[float]] = mapped_column(Float)


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


class TallySyncSale(Base):
    """Tally sales sync (includes stock_group + qty_alt)."""

    __tablename__ = "tallysync_sales"

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
    qty_alt: Mapped[Optional[float]] = mapped_column(Float)
    alternate_unit: Mapped[Optional[str]] = mapped_column(Text)
    conversion: Mapped[Optional[float]] = mapped_column(Float)
    stock_group: Mapped[Optional[str]] = mapped_column(Text)


class TallySyncStockSummary(Base):
    """Tally stock summary sync (closing qty / rate / value by stock group)."""

    __tablename__ = "tallysync_stocksummary"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    period_from: Mapped[Optional[datetime]] = mapped_column(DateTime)
    period_to: Mapped[Optional[datetime]] = mapped_column(DateTime)
    line_no: Mapped[Optional[float]] = mapped_column(Float)
    stock_group: Mapped[Optional[str]] = mapped_column(Text)
    stock_item: Mapped[Optional[str]] = mapped_column(Text)
    opening: Mapped[Optional[str]] = mapped_column(Text)
    opening_rate: Mapped[Optional[float]] = mapped_column(Float)
    opening_value: Mapped[Optional[float]] = mapped_column(Float)
    inwards: Mapped[Optional[str]] = mapped_column(Text)
    inward_rate: Mapped[Optional[float]] = mapped_column(Float)
    inward_value: Mapped[Optional[float]] = mapped_column(Float)
    outwards: Mapped[Optional[str]] = mapped_column(Text)
    outward_rate: Mapped[Optional[float]] = mapped_column(Float)
    outward_value: Mapped[Optional[float]] = mapped_column(Float)
    closing: Mapped[Optional[str]] = mapped_column(Text)
    closing_rate: Mapped[Optional[float]] = mapped_column(Float)
    closing_value: Mapped[Optional[float]] = mapped_column(Float)
    alternate_unit: Mapped[Optional[str]] = mapped_column(Text)
    conversion: Mapped[Optional[float]] = mapped_column(Float)
    opening_alt: Mapped[Optional[float]] = mapped_column(Float)
    inwards_alt: Mapped[Optional[float]] = mapped_column(Float)
    outwards_alt: Mapped[Optional[float]] = mapped_column(Float)
    closing_alt: Mapped[Optional[float]] = mapped_column(Float)
