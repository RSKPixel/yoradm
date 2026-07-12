from __future__ import annotations

from typing import List

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
    CostCentreOut,
    InventoryMasterOut,
    PurchaseOut,
    ReceivableOut,
    SaleInvoiceLineOut,
    SaleInvoiceOptionOut,
    SaleOut,
    StockSummaryOut,
)
from app.services import tally_service

router = APIRouter(prefix="/tally", tags=["tally"])


@router.get("/dashboard", response_model=DashboardStats)
def get_dashboard(_: CurrentUser, db: DbSession) -> DashboardStats:
    return tally_service.dashboard_stats(db)


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


@router.get("/sales", response_model=PaginatedResponse[SaleOut])
def list_sales(
    _: AdminUser,
    db: DbSession,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
) -> PaginatedResponse[SaleOut]:
    items, total = tally_service.paginate(db, TallySale, page, page_size)
    return PaginatedResponse(items=items, **tally_service.page_meta(total, page, page_size))


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
