from __future__ import annotations

from datetime import date
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Query, status

from app.core.deps import AdminUser, CurrentUser, DbSession
from app.models.tally import (
    TallyAccountMaster,
    TallyInventoryMaster,
    TallyPurchase,
    TallyReceivable,
    TallySale,
    TallyStockSummary,
)
from app.schemas import DashboardStats, PaginatedResponse
from app.schemas.tally import (
    AccountMasterOut,
    CollectionPerformanceOut,
    CostCentreOut,
    DaybookAvailabilityOut,
    DaybookTradeOut,
    InventoryItemOptionOut,
    InventoryMasterOut,
    PurchaseOut,
    ReceivableAnalysisOut,
    ReceivableOut,
    ReceivableRepresentativeOut,
    SaleInvoiceLineOut,
    SaleInvoiceOptionOut,
    SaleOut,
    StockSummaryOut,
    TdsWorkingsOut,
    VendorOptionOut,
    VendorTdsStatusOut,
)
from app.services import tally_service

router = APIRouter(prefix="/tally", tags=["tally"])


@router.get("/dashboard", response_model=DashboardStats)
def get_dashboard(_: CurrentUser, db: DbSession) -> DashboardStats:
    return tally_service.dashboard_stats(db)


@router.get("/daybook/availability", response_model=DaybookAvailabilityOut)
def daybook_availability(_: CurrentUser, db: DbSession) -> DaybookAvailabilityOut:
    return tally_service.daybook_availability(db)


@router.get("/accounts", response_model=PaginatedResponse[AccountMasterOut])
def list_accounts(
    _: AdminUser,
    db: DbSession,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
) -> PaginatedResponse[AccountMasterOut]:
    items, total = tally_service.paginate(db, TallyAccountMaster, page, page_size)
    return PaginatedResponse(items=items, **tally_service.page_meta(total, page, page_size))


@router.get("/inventory", response_model=PaginatedResponse[InventoryMasterOut])
def list_inventory(
    _: AdminUser,
    db: DbSession,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
) -> PaginatedResponse[InventoryMasterOut]:
    items, total = tally_service.paginate(db, TallyInventoryMaster, page, page_size)
    return PaginatedResponse(items=items, **tally_service.page_meta(total, page, page_size))


@router.get("/sales/invoices", response_model=List[SaleInvoiceOptionOut])
def list_sale_invoices(_: CurrentUser, db: DbSession) -> List[SaleInvoiceOptionOut]:
    return tally_service.list_sale_invoices(db)


@router.get("/sales/invoice-lines", response_model=List[SaleInvoiceLineOut])
def list_sale_invoice_lines(
    _: CurrentUser,
    db: DbSession,
    voucher_no: str = Query(..., min_length=1),
) -> List[SaleInvoiceLineOut]:
    items = tally_service.list_sale_invoice_lines(db, voucher_no.strip())
    if not items:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invoice not found")
    return list(items)


@router.get("/locations", response_model=List[CostCentreOut])
def list_locations(_: CurrentUser, db: DbSession) -> List[CostCentreOut]:
    return list(tally_service.list_locations(db))


@router.get("/representatives", response_model=List[CostCentreOut])
def list_representatives(_: CurrentUser, db: DbSession) -> List[CostCentreOut]:
    return list(tally_service.list_locations(db, parent="Representatives"))


@router.get("/vendors", response_model=List[VendorOptionOut])
def list_vendors(_: CurrentUser, db: DbSession) -> List[VendorOptionOut]:
    return tally_service.list_vendors(db)


@router.get("/vendors/tds-status", response_model=VendorTdsStatusOut)
def vendor_tds_status(
    _: CurrentUser,
    db: DbSession,
    ledger_name: str = Query(..., min_length=1),
    invoice_value: float = Query(default=0, ge=0),
    as_of: Optional[date] = Query(default=None),
) -> VendorTdsStatusOut:
    return tally_service.vendor_tds_status(
        db,
        ledger_name=ledger_name.strip(),
        invoice_value=invoice_value,
        as_of=as_of,
    )


@router.get("/tds-workings", response_model=TdsWorkingsOut)
def tds_workings(
    _: CurrentUser,
    db: DbSession,
    date_from: date = Query(...),
    date_to: date = Query(...),
    q: Optional[str] = Query(default=None),
) -> TdsWorkingsOut:
    return tally_service.list_tds_workings(
        db,
        date_from=date_from,
        date_to=date_to,
        q=q,
    )


@router.post("/tds-workings/save", response_model=TdsWorkingsOut)
def save_tds_workings(
    _: CurrentUser,
    db: DbSession,
    date_from: date = Query(...),
    date_to: date = Query(...),
) -> TdsWorkingsOut:
    return tally_service.save_tds_workings(
        db,
        date_from=date_from,
        date_to=date_to,
    )


@router.post("/tds-workings/update", response_model=TdsWorkingsOut)
def update_tds_workings(
    _: CurrentUser,
    db: DbSession,
    date_from: date = Query(...),
    date_to: date = Query(...),
) -> TdsWorkingsOut:
    return tally_service.update_tds_workings(
        db,
        date_from=date_from,
        date_to=date_to,
    )


@router.get("/inventory-items", response_model=List[InventoryItemOptionOut])
def list_inventory_items(_: CurrentUser, db: DbSession) -> List[InventoryItemOptionOut]:
    return tally_service.list_inventory_items(db)


@router.get("/sales", response_model=PaginatedResponse[SaleOut])
def list_sales(
    _: AdminUser,
    db: DbSession,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
) -> PaginatedResponse[SaleOut]:
    items, total = tally_service.paginate(db, TallySale, page, page_size)
    return PaginatedResponse(items=items, **tally_service.page_meta(total, page, page_size))


@router.get("/purchases/lines", response_model=List[PurchaseOut])
def list_purchase_lines(
    _: CurrentUser,
    db: DbSession,
    stock_item: Optional[str] = Query(None, min_length=1),
    stock_group: Optional[str] = Query(None, min_length=1),
) -> List[PurchaseOut]:
    item = stock_item.strip() if stock_item else None
    group = stock_group.strip() if stock_group else None
    if not item and not group:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Provide stock_item or stock_group",
        )
    return list(tally_service.list_purchase_lines(db, stock_item=item, stock_group=group))


@router.get("/purchases", response_model=PaginatedResponse[PurchaseOut])
def list_purchases(
    _: AdminUser,
    db: DbSession,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
) -> PaginatedResponse[PurchaseOut]:
    items, total = tally_service.paginate(db, TallyPurchase, page, page_size)
    return PaginatedResponse(items=items, **tally_service.page_meta(total, page, page_size))


@router.get("/stock-summary", response_model=PaginatedResponse[StockSummaryOut])
def list_stock_summary(
    _: AdminUser,
    db: DbSession,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
) -> PaginatedResponse[StockSummaryOut]:
    items, total = tally_service.paginate(db, TallyStockSummary, page, page_size)
    return PaginatedResponse(items=items, **tally_service.page_meta(total, page, page_size))


@router.get("/receivables", response_model=PaginatedResponse[ReceivableOut])
def list_receivables(
    _: AdminUser,
    db: DbSession,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
) -> PaginatedResponse[ReceivableOut]:
    items, total = tally_service.paginate(db, TallyReceivable, page, page_size)
    return PaginatedResponse(items=items, **tally_service.page_meta(total, page, page_size))


@router.get("/receivables/representatives", response_model=List[ReceivableRepresentativeOut])
def list_receivable_representatives(
    _: CurrentUser, db: DbSession
) -> List[ReceivableRepresentativeOut]:
    return tally_service.list_receivable_representatives(db)


@router.get("/receivables/analysis", response_model=ReceivableAnalysisOut)
def receivables_analysis(
    _: CurrentUser,
    db: DbSession,
    representative: Optional[str] = Query(None),
    as_of: Optional[date] = Query(None),
) -> ReceivableAnalysisOut:
    rep = representative.strip() if representative else None
    if rep == "":
        rep = None
    return tally_service.receivables_analysis(db, as_of=as_of, representative=rep)


@router.get("/daybook/sales-purchase", response_model=DaybookTradeOut)
def daybook_sales_purchase(
    _: AdminUser,
    db: DbSession,
    date_from: Optional[date] = Query(default=None),
    date_to: Optional[date] = Query(default=None),
) -> DaybookTradeOut:
    return tally_service.sales_purchase_trend(
        db,
        date_from=date_from,
        date_to=date_to,
    )


@router.get("/sales/representatives", response_model=List[ReceivableRepresentativeOut])
def list_sale_representatives(
    _: AdminUser, db: DbSession
) -> List[ReceivableRepresentativeOut]:
    return tally_service.list_sale_representatives(db)


@router.get("/daybook/collection-performance", response_model=CollectionPerformanceOut)
def daybook_collection_performance(
    _: AdminUser,
    db: DbSession,
    date_from: Optional[date] = Query(default=None),
    date_to: Optional[date] = Query(default=None),
    representative: Optional[str] = Query(None),
) -> CollectionPerformanceOut:
    rep = representative.strip() if representative else None
    if rep == "":
        rep = None
    return tally_service.collection_performance(
        db,
        date_from=date_from,
        date_to=date_to,
        representative=rep,
    )
