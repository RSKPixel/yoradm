from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, Query

from app.core.deps import CurrentUser, DbSession
from app.schemas.packing_material import (
    PackingAdjustUpdate,
    PackingFyBulkUpdate,
    PackingFyFreezeUpdate,
    PackingFyStockListOut,
    PackingFyStockOut,
    PackingOpeningUpdate,
    PackingPurchaseCreate,
    PackingPurchaseListOut,
    PackingPurchaseUpdate,
    PackingSkuOut,
)
from app.services import packing_material_service

router = APIRouter(prefix="/packing-material", tags=["packing-material"])


@router.get("/skus", response_model=List[PackingSkuOut])
def list_skus(
    _: CurrentUser,
    db: DbSession,
    active_only: bool = Query(default=True),
) -> List[PackingSkuOut]:
    return packing_material_service.list_skus(db, active_only=active_only)


@router.get("/stock", response_model=PackingFyStockListOut)
def list_fy_stock(
    _: CurrentUser,
    db: DbSession,
    fy: Optional[str] = Query(default=None, description="FY label, e.g. 2026-2027"),
) -> PackingFyStockListOut:
    return packing_material_service.list_fy_stock(db, fy=fy)


@router.post("/stock/refresh", response_model=PackingFyStockListOut)
def refresh_fy_stock(
    _: CurrentUser,
    db: DbSession,
    fy: Optional[str] = Query(default=None, description="FY label, e.g. 2026-2027"),
) -> PackingFyStockListOut:
    return packing_material_service.refresh_fy_stock(db, fy=fy)


@router.post("/stock/update", response_model=PackingFyStockListOut)
def bulk_update_fy_rows(
    _: CurrentUser,
    db: DbSession,
    payload: PackingFyBulkUpdate,
    fy: Optional[str] = Query(default=None, description="FY label, e.g. 2026-2027"),
) -> PackingFyStockListOut:
    return packing_material_service.bulk_update_fy_rows(db, fy=fy, payload=payload)


@router.patch("/stock/{sku_id}/opening", response_model=PackingFyStockOut)
def update_fy_opening(
    _: CurrentUser,
    db: DbSession,
    sku_id: int,
    payload: PackingOpeningUpdate,
    fy: Optional[str] = Query(default=None, description="FY label, e.g. 2026-2027"),
) -> PackingFyStockOut:
    fy_label = fy if fy is not None else packing_material_service.current_fy()
    return packing_material_service.update_fy_opening(
        db, sku_id=sku_id, fy=fy_label, payload=payload
    )


@router.patch("/stock/{sku_id}/adjust", response_model=PackingFyStockOut)
def update_fy_adjust(
    _: CurrentUser,
    db: DbSession,
    sku_id: int,
    payload: PackingAdjustUpdate,
    fy: Optional[str] = Query(default=None, description="FY label, e.g. 2026-2027"),
) -> PackingFyStockOut:
    fy_label = fy if fy is not None else packing_material_service.current_fy()
    return packing_material_service.update_fy_adjust(
        db, sku_id=sku_id, fy=fy_label, payload=payload
    )


@router.post("/stock/freeze", response_model=PackingFyStockListOut)
def set_fy_frozen(
    _: CurrentUser,
    db: DbSession,
    payload: PackingFyFreezeUpdate,
    fy: Optional[str] = Query(default=None, description="FY label, e.g. 2026-2027"),
) -> PackingFyStockListOut:
    return packing_material_service.set_fy_frozen(db, fy=fy, frozen=payload.frozen)


@router.get("/suppliers", response_model=List[str])
def list_purchase_suppliers(_: CurrentUser, db: DbSession) -> List[str]:
    return packing_material_service.list_purchase_suppliers(db)


@router.get("/purchases", response_model=PackingPurchaseListOut)
def list_purchases(
    _: CurrentUser,
    db: DbSession,
    sku_id: int = Query(...),
    fy: Optional[str] = Query(default=None, description="FY label, e.g. 2026-2027"),
) -> PackingPurchaseListOut:
    return packing_material_service.list_purchases_for_sku(db, sku_id=sku_id, fy=fy)


@router.post("/purchases", response_model=PackingFyStockListOut)
def create_purchase(
    _: CurrentUser,
    db: DbSession,
    payload: PackingPurchaseCreate,
    fy: Optional[str] = Query(default=None, description="FY label, e.g. 2026-2027"),
) -> PackingFyStockListOut:
    _, stock = packing_material_service.create_purchase(db, payload=payload, fy=fy)
    return stock


@router.patch("/purchases/{purchase_id}", response_model=PackingFyStockListOut)
def update_purchase(
    _: CurrentUser,
    db: DbSession,
    purchase_id: int,
    payload: PackingPurchaseUpdate,
    fy: Optional[str] = Query(default=None, description="FY label, e.g. 2026-2027"),
) -> PackingFyStockListOut:
    _, stock = packing_material_service.update_purchase(
        db, purchase_id=purchase_id, payload=payload, fy=fy
    )
    return stock


@router.delete("/purchases/{purchase_id}", response_model=PackingFyStockListOut)
def delete_purchase(
    _: CurrentUser,
    db: DbSession,
    purchase_id: int,
    fy: Optional[str] = Query(default=None, description="FY label, e.g. 2026-2027"),
) -> PackingFyStockListOut:
    return packing_material_service.delete_purchase(db, purchase_id=purchase_id, fy=fy)
