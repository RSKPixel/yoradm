from datetime import date
from typing import Optional

from fastapi import APIRouter, HTTPException, Query, Response, status

from app.core.deps import CurrentUser, DbSession
from app.schemas import PaginatedResponse
from app.schemas.goods_receipt import GoodsReceiptCreate, GoodsReceiptListItem, GoodsReceiptOut
from app.services import goods_receipt_service

router = APIRouter(prefix="/goods-receipts", tags=["goods-receipts"])


@router.get("", response_model=PaginatedResponse[GoodsReceiptListItem])
def list_goods_receipts(
    _: CurrentUser,
    db: DbSession,
    date_from: Optional[date] = Query(default=None),
    date_to: Optional[date] = Query(default=None),
    vendor: Optional[str] = Query(default=None),
    invoice_no: Optional[str] = Query(default=None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
) -> PaginatedResponse[GoodsReceiptListItem]:
    items, total = goods_receipt_service.list_goods_receipts(
        db,
        date_from=date_from,
        date_to=date_to,
        vendor=vendor,
        invoice_no=invoice_no,
        page=page,
        page_size=page_size,
    )
    meta = goods_receipt_service.list_page_meta(total, page, page_size)
    return PaginatedResponse(items=items, **meta)


@router.get("/received-by", response_model=list[str])
def list_received_by(_: CurrentUser, db: DbSession) -> list[str]:
    return goods_receipt_service.list_received_by(db)


@router.get("/{receipt_id}", response_model=GoodsReceiptOut)
def get_goods_receipt(
    receipt_id: int,
    _: CurrentUser,
    db: DbSession,
) -> GoodsReceiptOut:
    receipt = goods_receipt_service.get_by_id(db, receipt_id)
    if not receipt:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Goods receipt not found")
    return receipt


@router.post("", response_model=GoodsReceiptOut, status_code=status.HTTP_201_CREATED)
def create_goods_receipt(
    payload: GoodsReceiptCreate,
    db: DbSession,
    current_user: CurrentUser,
) -> GoodsReceiptOut:
    return goods_receipt_service.create_goods_receipt(
        db,
        payload,
        created_by=current_user.id,
    )


@router.put("/{receipt_id}", response_model=GoodsReceiptOut)
def update_goods_receipt(
    receipt_id: int,
    payload: GoodsReceiptCreate,
    db: DbSession,
    _: CurrentUser,
) -> GoodsReceiptOut:
    return goods_receipt_service.update_goods_receipt(db, receipt_id, payload)


@router.delete("/{receipt_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_goods_receipt(
    receipt_id: int,
    db: DbSession,
    _: CurrentUser,
) -> Response:
    goods_receipt_service.delete_goods_receipt(db, receipt_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
