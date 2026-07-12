from fastapi import APIRouter, File, UploadFile, status

from app.core.deps import CurrentUser, DbSession
from app.schemas import (
    ChangePasswordRequest,
    LoginRequest,
    ProfileUpdate,
    RefreshRequest,
    TokenPair,
    UserOut,
)
from app.services import auth_service, user_service

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenPair)
def login(payload: LoginRequest, db: DbSession) -> TokenPair:
    return auth_service.login(db, payload.username, payload.password)


@router.post("/refresh", response_model=TokenPair)
def refresh(payload: RefreshRequest, db: DbSession) -> TokenPair:
    return auth_service.refresh(db, payload.refresh_token)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(payload: RefreshRequest, db: DbSession) -> None:
    auth_service.logout(db, payload.refresh_token)


@router.get("/me", response_model=UserOut)
def me(current_user: CurrentUser) -> UserOut:
    return current_user


@router.patch("/me", response_model=UserOut)
def update_me(current_user: CurrentUser, db: DbSession, payload: ProfileUpdate) -> UserOut:
    return user_service.update_profile(db, current_user.id, payload)


@router.post("/me/password", status_code=status.HTTP_204_NO_CONTENT)
def change_my_password(
    current_user: CurrentUser,
    db: DbSession,
    payload: ChangePasswordRequest,
) -> None:
    user_service.change_password(db, current_user.id, payload)


@router.post("/me/photo", response_model=UserOut)
def upload_my_photo(
    current_user: CurrentUser,
    db: DbSession,
    file: UploadFile = File(...),
) -> UserOut:
    return user_service.upload_profile_photo(db, current_user.id, file)
