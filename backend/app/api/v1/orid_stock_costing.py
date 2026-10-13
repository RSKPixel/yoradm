from __future__ import annotations

from typing import Optional

from fastapi import APIRouter

from app.core.deps import CurrentUser, DbSession
from app.schemas.orid_stock_costing import OridStockCostingOut, OridStockCostingSaveIn
from app.services import orid_stock_costing_service

router = APIRouter(prefix="/orid-stock-costing", tags=["orid-stock-costing"])


@router.get("", response_model=Optional[OridStockCostingOut])
def get_orid_stock_costing(
    _: CurrentUser,
    db: DbSession,
) -> Optional[OridStockCostingOut]:
    return orid_stock_costing_service.get_costing(db)


@router.put("", response_model=OridStockCostingOut)
def save_orid_stock_costing(
    payload: OridStockCostingSaveIn,
    db: DbSession,
    current_user: CurrentUser,
) -> OridStockCostingOut:
    return orid_stock_costing_service.save_costing(
        db,
        payload,
        created_by=current_user.id,
    )
