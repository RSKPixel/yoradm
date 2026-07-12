from typing import List, Optional

from fastapi import APIRouter, Query, Response, status

from app.core.deps import CurrentUser, DbSession
from app.schemas.delivery_challan import DeliveryChallanCreate, DeliveryChallanOut
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
