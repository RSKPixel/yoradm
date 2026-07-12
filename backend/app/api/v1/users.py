from math import ceil

from fastapi import APIRouter, Query, status

from app.core.deps import AdminUser, DbSession
from app.schemas import PaginatedResponse, UserCreate, UserOut, UserUpdate
from app.services import user_service

router = APIRouter(prefix="/users", tags=["users"])


@router.get("", response_model=PaginatedResponse[UserOut])
def list_users(
    _: AdminUser,
    db: DbSession,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
) -> PaginatedResponse[UserOut]:
    items, total = user_service.list_users(db, page, page_size)
    return PaginatedResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        pages=ceil(total / page_size) if page_size else 0,
    )


@router.post("", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def create_user(_: AdminUser, db: DbSession, payload: UserCreate) -> UserOut:
    return user_service.create_user(db, payload)


@router.get("/{user_id}", response_model=UserOut)
def get_user(_: AdminUser, db: DbSession, user_id: int) -> UserOut:
    user = user_service.get_user_by_id(db, user_id)
    if not user:
        from fastapi import HTTPException

        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user


@router.patch("/{user_id}", response_model=UserOut)
def update_user(_: AdminUser, db: DbSession, user_id: int, payload: UserUpdate) -> UserOut:
    return user_service.update_user(db, user_id, payload)


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(_: AdminUser, db: DbSession, user_id: int) -> None:
    user_service.delete_user(db, user_id)
