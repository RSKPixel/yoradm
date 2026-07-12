from datetime import datetime, timezone
from hashlib import sha256

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.security import (
    create_access_token,
    create_refresh_token,
    hash_password,
    safe_decode_token,
    verify_password,
)
from app.models.refresh_token import RefreshToken
from app.models.user import User
from app.schemas import TokenPair
from app.services import user_service


def _hash_token(token: str) -> str:
    return sha256(token.encode("utf-8")).hexdigest()


def _issue_tokens(db: Session, user: User) -> TokenPair:
    access = create_access_token(str(user.id), user.role.value)
    refresh, jti, expires_at = create_refresh_token(str(user.id))
    db.add(
        RefreshToken(
            user_id=user.id,
            jti=jti,
            token_hash=_hash_token(refresh),
            expires_at=expires_at,
        )
    )
    db.commit()
    return TokenPair(access_token=access, refresh_token=refresh)


def login(db: Session, username: str, password: str) -> TokenPair:
    user = user_service.get_user_by_username(db, username)
    if not user or not verify_password(password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid username or password")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User account is inactive")
    now = datetime.now(timezone.utc)
    user.last_login_at = user.current_login_at
    user.current_login_at = now
    db.commit()
    return _issue_tokens(db, user)


def refresh(db: Session, refresh_token: str) -> TokenPair:
    payload = safe_decode_token(refresh_token)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

    jti = payload.get("jti")
    user_id = payload.get("sub")
    if not jti or not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

    stored = (
        db.query(RefreshToken)
        .filter(RefreshToken.jti == jti, RefreshToken.user_id == int(user_id))
        .first()
    )
    now = datetime.now(timezone.utc)
    if (
        not stored
        or stored.revoked_at is not None
        or stored.expires_at.replace(tzinfo=timezone.utc) < now
        or stored.token_hash != _hash_token(refresh_token)
    ):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token revoked or expired")

    stored.revoked_at = now
    user = user_service.get_user_by_id(db, int(user_id))
    if not user or not user.is_active:
        db.commit()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User inactive or not found")

    tokens = _issue_tokens(db, user)
    return tokens


def logout(db: Session, refresh_token: str) -> None:
    payload = safe_decode_token(refresh_token)
    if not payload or payload.get("type") != "refresh":
        return
    jti = payload.get("jti")
    if not jti:
        return
    stored = db.query(RefreshToken).filter(RefreshToken.jti == jti).first()
    if stored and stored.revoked_at is None:
        stored.revoked_at = datetime.now(timezone.utc)
        db.commit()
