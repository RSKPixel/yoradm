from typing import Optional, Sequence, Tuple
import base64

from fastapi import HTTPException, UploadFile, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import hash_password, verify_password
from app.models.user import User, UserRole
from app.schemas import ChangePasswordRequest, ProfileUpdate, UserCreate, UserUpdate

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}


def get_user_by_id(db: Session, user_id: int) -> Optional[User]:
    return db.query(User).filter(User.id == user_id).first()


def get_user_by_email(db: Session, email: str) -> Optional[User]:
    return db.query(User).filter(User.email == email.lower()).first()


def get_user_by_username(db: Session, username: str) -> Optional[User]:
    return db.query(User).filter(User.username == username.lower()).first()


def list_users(db: Session, page: int, page_size: int) -> Tuple[Sequence[User], int]:
    query = db.query(User).order_by(User.id.asc())
    total = query.count()
    items = query.offset((page - 1) * page_size).limit(page_size).all()
    return items, total


def create_user(db: Session, payload: UserCreate) -> User:
    if get_user_by_username(db, payload.username):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Username already taken")
    if get_user_by_email(db, payload.email):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")
    user = User(
        username=payload.username.lower(),
        email=payload.email.lower(),
        full_name=payload.full_name,
        role=payload.role,
        is_active=payload.is_active,
        hashed_password=hash_password(payload.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def update_user(db: Session, user_id: int, payload: UserUpdate) -> User:
    user = get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    data = payload.model_dump(exclude_unset=True)
    if "username" in data:
        existing = get_user_by_username(db, data["username"])
        if existing and existing.id != user_id:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Username already taken")
        data["username"] = data["username"].lower()
    if "email" in data:
        existing = get_user_by_email(db, data["email"])
        if existing and existing.id != user_id:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")
        data["email"] = data["email"].lower()
    if "password" in data:
        data["hashed_password"] = hash_password(data.pop("password"))

    for key, value in data.items():
        setattr(user, key, value)

    db.commit()
    db.refresh(user)
    return user


def delete_user(db: Session, user_id: int) -> None:
    user = get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    db.delete(user)
    db.commit()


def update_profile(db: Session, user_id: int, payload: ProfileUpdate) -> User:
    return update_user(db, user_id, UserUpdate(**payload.model_dump(exclude_unset=True)))


def change_password(db: Session, user_id: int, payload: ChangePasswordRequest) -> None:
    user = get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if not verify_password(payload.current_password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current password is incorrect")
    if payload.current_password == payload.new_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must be different from the current password",
        )
    user.hashed_password = hash_password(payload.new_password)
    db.commit()


def upload_profile_photo(db: Session, user_id: int, file: UploadFile) -> User:
    user = get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    content_type = file.content_type or ""
    if content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please select a JPG, PNG, WEBP, or GIF image.",
        )

    contents = file.file.read()
    if not contents:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Selected file is empty.")

    max_bytes = get_settings().profile_photo_max_bytes
    if len(contents) > max_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Image must be 1 MB or smaller.",
        )

    encoded = base64.b64encode(contents).decode("ascii")
    user.profile_pic = f"data:{content_type};base64,{encoded}"
    db.commit()
    db.refresh(user)
    return user


def ensure_admin_exists(
    db: Session,
    email: str,
    password: str,
    full_name: str,
    username: str = "admin",
) -> User:
    existing = get_user_by_username(db, username) or get_user_by_email(db, email)
    if existing:
        if not existing.username:
            existing.username = username.lower()
            db.commit()
            db.refresh(existing)
        return existing
    user = User(
        username=username.lower(),
        email=email.lower(),
        full_name=full_name,
        role=UserRole.ADMIN,
        is_active=True,
        hashed_password=hash_password(password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def count_users(db: Session) -> int:
    return db.query(func.count(User.id)).scalar() or 0
