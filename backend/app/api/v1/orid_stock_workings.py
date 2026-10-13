from __future__ import annotations

from typing import Optional

from fastapi import APIRouter

from app.core.deps import CurrentUser, DbSession
from app.schemas.orid_stock_workings import OridStockWorkingsOut, OridStockWorkingsSaveIn
from app.services import orid_stock_workings_service

router = APIRouter(prefix="/orid-stock-workings", tags=["orid-stock-workings"])


@router.get("", response_model=Optional[OridStockWorkingsOut])
def get_orid_stock_workings(
    _: CurrentUser,
    db: DbSession,
) -> Optional[OridStockWorkingsOut]:
    return orid_stock_workings_service.get_workings(db)


@router.put("", response_model=OridStockWorkingsOut)
def save_orid_stock_workings(
    payload: OridStockWorkingsSaveIn,
    db: DbSession,
    current_user: CurrentUser,
) -> OridStockWorkingsOut:
    return orid_stock_workings_service.save_workings(
        db,
        payload,
        created_by=current_user.id,
    )
