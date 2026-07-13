from datetime import date
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Query, Response, status

from app.core.deps import CurrentUser, DbSession
from app.schemas import PaginatedResponse
from app.schemas.delivery_challan import (
    DeliveryChallanCreate,
    DeliveryChallanListItem,
    DeliveryChallanOut,
    DeliveryQtyByBatchDatesOut,
    DeliveryQtyByBatchOut,
    DeliveryQtyByDateItem,
)
from app.services import delivery_challan_service

router = APIRouter(prefix="/delivery-challans", tags=["delivery-challans"])


@router.get("/used-invoices", response_model=List[str])
def list_used_invoices(
    _: CurrentUser,
    db: DbSession,
    exclude_challan_id: Optional[int] = Query(default=None),
) -> List[str]:
    return delivery_challan_service.list_used_voucher_nos(
        db,
        exclude_challan_id=exclude_challan_id,
    )


@router.get("/qty-by-batch", response_model=DeliveryQtyByBatchOut)
def qty_by_batch(
    _: CurrentUser,
    db: DbSession,
    batch_no: str = Query(..., min_length=1),
    stock_group: str = Query(default="Orid Dhall", min_length=1),
) -> DeliveryQtyByBatchOut:
    batch = batch_no.strip()
    group = stock_group.strip()
    total_qty, total_amount = delivery_challan_service.sum_qty_by_batch(
        db,
        batch_no=batch,
        stock_group=group,
    )
    return DeliveryQtyByBatchOut(
        batch_no=batch,
        stock_group=group,
        total_qty=total_qty,
        total_amount=total_amount,
    )


@router.get("/qty-by-batch-dates", response_model=DeliveryQtyByBatchDatesOut)
def qty_by_batch_dates(
    _: CurrentUser,
    db: DbSession,
    batch_no: str = Query(..., min_length=1),
    stock_group: str = Query(default="Orid Dhall", min_length=1),
) -> DeliveryQtyByBatchDatesOut:
    batch = batch_no.strip()
    group = stock_group.strip()
    rows = delivery_challan_service.list_qty_by_batch_date(
        db,
        batch_no=batch,
        stock_group=group,
    )
    items = [
        DeliveryQtyByDateItem(challan_date=row["challan_date"], total_qty=row["total_qty"])
        for row in rows
    ]
    return DeliveryQtyByBatchDatesOut(
        batch_no=batch,
        stock_group=group,
        items=items,
        total_qty=sum(item.total_qty for item in items),
    )


@router.get("", response_model=PaginatedResponse[DeliveryChallanListItem])
def list_delivery_challans(
    _: CurrentUser,
    db: DbSession,
    date_from: Optional[date] = Query(default=None),
    date_to: Optional[date] = Query(default=None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
) -> PaginatedResponse[DeliveryChallanListItem]:
    items, total = delivery_challan_service.list_delivery_challans(
        db,
        date_from=date_from,
        date_to=date_to,
        page=page,
        page_size=page_size,
    )
    meta = delivery_challan_service.list_page_meta(total, page, page_size)
    return PaginatedResponse(items=items, **meta)


@router.get("/{challan_id}", response_model=DeliveryChallanOut)
def get_delivery_challan(
    challan_id: int,
    _: CurrentUser,
    db: DbSession,
) -> DeliveryChallanOut:
    challan = delivery_challan_service.get_by_id(db, challan_id)
    if not challan:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Delivery challan not found")
    return challan


@router.post("", response_model=DeliveryChallanOut, status_code=status.HTTP_201_CREATED)
def create_delivery_challan(
    payload: DeliveryChallanCreate,
    db: DbSession,
    current_user: CurrentUser,
) -> DeliveryChallanOut:
    return delivery_challan_service.create_delivery_challan(
        db,
        payload,
        created_by=current_user.id,
    )


@router.put("/{challan_id}", response_model=DeliveryChallanOut)
def update_delivery_challan(
    challan_id: int,
    payload: DeliveryChallanCreate,
    db: DbSession,
    _: CurrentUser,
) -> DeliveryChallanOut:
    return delivery_challan_service.update_delivery_challan(db, challan_id, payload)


@router.delete("/{challan_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_delivery_challan(
    challan_id: int,
    db: DbSession,
    _: CurrentUser,
) -> Response:
    delivery_challan_service.delete_delivery_challan(db, challan_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
