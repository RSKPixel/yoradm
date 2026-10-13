from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Query, Response, status

from app.core.deps import CurrentUser, DbSession
from app.schemas.orid_stock_pending import (
    OridStockPendingCreate,
    OridStockPendingListOut,
    OridStockPendingOut,
    OridStockPendingUpdate,
)
from app.services import orid_stock_pending_service

router = APIRouter(prefix="/orid-stock-pendings", tags=["orid-stock-pendings"])


@router.get("", response_model=OridStockPendingListOut)
def list_orid_stock_pendings(
    _: CurrentUser,
    db: DbSession,
    stock_group: Optional[str] = Query(default=None),
) -> OridStockPendingListOut:
    return orid_stock_pending_service.list_pendings(db, stock_group=stock_group)


@router.post("", response_model=OridStockPendingOut, status_code=status.HTTP_201_CREATED)
def create_orid_stock_pending(
    payload: OridStockPendingCreate,
    db: DbSession,
    current_user: CurrentUser,
) -> OridStockPendingOut:
    return orid_stock_pending_service.create_pending(
        db,
        payload,
        created_by=current_user.id,
    )


@router.patch("/{pending_id}", response_model=OridStockPendingOut)
def update_orid_stock_pending(
    pending_id: int,
    payload: OridStockPendingUpdate,
    _: CurrentUser,
    db: DbSession,
) -> OridStockPendingOut:
    return orid_stock_pending_service.update_pending(db, pending_id, payload)


@router.delete("/{pending_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_orid_stock_pending(
    pending_id: int,
    _: CurrentUser,
    db: DbSession,
) -> Response:
    orid_stock_pending_service.delete_pending(db, pending_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
