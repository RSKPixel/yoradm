from datetime import date
from typing import Optional

from fastapi import APIRouter, HTTPException, Query, Response, status

from app.core.deps import CurrentUser, DbSession
from app.schemas import PaginatedResponse
from app.schemas.post_dated_cheque import (
    PostDatedChequeCreate,
    PostDatedChequeListItem,
    PostDatedChequeOut,
    PostDatedChequeStatusUpdate,
)
from app.services import post_dated_cheque_service

router = APIRouter(prefix="/post-dated-cheques", tags=["post-dated-cheques"])


@router.get("", response_model=PaginatedResponse[PostDatedChequeListItem])
def list_post_dated_cheques(
    _: CurrentUser,
    db: DbSession,
    date_from: Optional[date] = Query(default=None),
    date_to: Optional[date] = Query(default=None),
    party: Optional[str] = Query(default=None),
    cheque_no: Optional[str] = Query(default=None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
) -> PaginatedResponse[PostDatedChequeListItem]:
    items, total = post_dated_cheque_service.list_post_dated_cheques(
        db,
        date_from=date_from,
        date_to=date_to,
        party=party,
        cheque_no=cheque_no,
        page=page,
        page_size=page_size,
    )
    meta = post_dated_cheque_service.list_page_meta(total, page, page_size)
    return PaginatedResponse(items=items, **meta)


@router.get("/{cheque_id}", response_model=PostDatedChequeOut)
def get_post_dated_cheque(
    cheque_id: int,
    _: CurrentUser,
    db: DbSession,
) -> PostDatedChequeOut:
    row = post_dated_cheque_service.get_by_id(db, cheque_id)
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Post dated cheque not found",
        )
    return post_dated_cheque_service.cheque_to_out(row)


@router.post("", response_model=PostDatedChequeOut, status_code=status.HTTP_201_CREATED)
def create_post_dated_cheque(
    payload: PostDatedChequeCreate,
    db: DbSession,
    current_user: CurrentUser,
) -> PostDatedChequeOut:
    return post_dated_cheque_service.create_post_dated_cheque(
        db,
        payload,
        created_by=current_user.id,
    )


@router.put("/{cheque_id}", response_model=PostDatedChequeOut)
def update_post_dated_cheque(
    cheque_id: int,
    payload: PostDatedChequeCreate,
    db: DbSession,
    _: CurrentUser,
) -> PostDatedChequeOut:
    return post_dated_cheque_service.update_post_dated_cheque(db, cheque_id, payload)


@router.patch("/{cheque_id}/status", response_model=PostDatedChequeOut)
def update_post_dated_cheque_status(
    cheque_id: int,
    payload: PostDatedChequeStatusUpdate,
    db: DbSession,
    _: CurrentUser,
) -> PostDatedChequeOut:
    return post_dated_cheque_service.update_post_dated_cheque_status(
        db,
        cheque_id,
        new_status=payload.status,
    )


@router.delete("/{cheque_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_post_dated_cheque(
    cheque_id: int,
    db: DbSession,
    _: CurrentUser,
) -> Response:
    post_dated_cheque_service.delete_post_dated_cheque(db, cheque_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
