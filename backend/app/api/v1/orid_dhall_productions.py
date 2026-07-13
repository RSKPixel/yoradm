from datetime import date
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Query, Response, status

from app.core.deps import CurrentUser, DbSession
from app.schemas import PaginatedResponse
from app.schemas.orid_dhall_production import (
    OridDhallOpenBatchItem,
    OridDhallPeriodOptionsOut,
    OridDhallProductionCreate,
    OridDhallProductionListItem,
    OridDhallProductionOut,
    OridDhallProductionStatusUpdate,
)
from app.services import orid_dhall_production_service

router = APIRouter(prefix="/orid-dhall-productions", tags=["orid-dhall-productions"])


@router.get("/used-vouchers", response_model=List[str])
def list_used_vouchers(
    _: CurrentUser,
    db: DbSession,
    line_kind: Optional[str] = Query(default=None),
    exclude_production_id: Optional[int] = Query(default=None),
) -> List[str]:
    kind = line_kind.strip().lower() if line_kind else None
    if kind and kind not in ("raw", "avg"):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="line_kind must be raw or avg",
        )
    return orid_dhall_production_service.list_used_voucher_nos(
        db,
        line_kind=kind,
        exclude_production_id=exclude_production_id,
    )


@router.get("/open-batches", response_model=List[OridDhallOpenBatchItem])
def list_open_batches(_: CurrentUser, db: DbSession) -> List[OridDhallOpenBatchItem]:
    return orid_dhall_production_service.list_open_batches(db)


@router.get("/period-options", response_model=OridDhallPeriodOptionsOut)
def list_period_options(_: CurrentUser, db: DbSession) -> OridDhallPeriodOptionsOut:
    return orid_dhall_production_service.list_period_options(db)


@router.get("", response_model=PaginatedResponse[OridDhallProductionListItem])
def list_productions(
    _: CurrentUser,
    db: DbSession,
    date_from: Optional[date] = Query(default=None),
    date_to: Optional[date] = Query(default=None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
) -> PaginatedResponse[OridDhallProductionListItem]:
    items, total = orid_dhall_production_service.list_productions(
        db,
        date_from=date_from,
        date_to=date_to,
        page=page,
        page_size=page_size,
    )
    meta = orid_dhall_production_service.list_page_meta(total, page, page_size)
    return PaginatedResponse(items=items, **meta)


@router.get("/{production_id}", response_model=OridDhallProductionOut)
def get_production(
    production_id: int,
    _: CurrentUser,
    db: DbSession,
) -> OridDhallProductionOut:
    row = orid_dhall_production_service.get_by_id(db, production_id)
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Orid dhall production not found",
        )
    return orid_dhall_production_service.to_out(row)


@router.post("", response_model=OridDhallProductionOut, status_code=status.HTTP_201_CREATED)
def create_production(
    payload: OridDhallProductionCreate,
    db: DbSession,
    current_user: CurrentUser,
) -> OridDhallProductionOut:
    return orid_dhall_production_service.create_production(
        db,
        payload,
        created_by=current_user.id,
    )


@router.put("/{production_id}", response_model=OridDhallProductionOut)
def update_production(
    production_id: int,
    payload: OridDhallProductionCreate,
    db: DbSession,
    _: CurrentUser,
) -> OridDhallProductionOut:
    return orid_dhall_production_service.update_production(db, production_id, payload)


@router.patch("/{production_id}/status", response_model=OridDhallProductionOut)
def update_production_status(
    production_id: int,
    payload: OridDhallProductionStatusUpdate,
    db: DbSession,
    _: CurrentUser,
) -> OridDhallProductionOut:
    return orid_dhall_production_service.update_production_status(
        db,
        production_id,
        new_status=payload.status,
    )


@router.delete("/{production_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_production(
    production_id: int,
    db: DbSession,
    _: CurrentUser,
) -> Response:
    orid_dhall_production_service.delete_production(db, production_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
