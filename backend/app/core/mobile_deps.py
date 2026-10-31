from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Annotated, List, Optional

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials

from app.core.deps import DbSession, bearer_scheme
from app.core.rate_limit import client_ip
from app.core.security import safe_decode_token
from app.models.mobile import DEVICE_ACTIVE, DEVICE_REVOKED, MobileDevice
from app.services import mobile_service


@dataclass
class MobileContext:
    device: MobileDevice
    reps: List[str]
    ip: str


def _unauthorized(message: str, code: str) -> HTTPException:
    return HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail={"detail": message, "code": code})


def get_mobile_context(
    request: Request,
    db: DbSession,
    credentials: Annotated[Optional[HTTPAuthorizationCredentials], Depends(bearer_scheme)],
) -> MobileContext:
    """Every /m/* data request: valid mobile token, live phone, rep scope from DB."""
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise _unauthorized("Not authenticated", "not_authenticated")
    claims = safe_decode_token(credentials.credentials)
    if not claims or claims.get("type") != "mobile":
        raise _unauthorized("Invalid or expired token", "token_expired")

    device = db.query(MobileDevice).filter(MobileDevice.id == int(claims.get("sub") or 0)).first()
    if not device:
        raise _unauthorized("This phone is not authorised", "device_unknown")
    # Checked per request so a revoke takes effect immediately, not when the token expires.
    if device.status == DEVICE_REVOKED:
        raise _unauthorized("This phone has been revoked", "device_revoked")
    if device.status != DEVICE_ACTIVE:
        raise _unauthorized("This phone is not authorised", "device_unknown")

    ip = client_ip(request)
    now = datetime.now(timezone.utc)
    last_seen = device.last_seen_at
    if last_seen is not None and last_seen.tzinfo is None:
        last_seen = last_seen.replace(tzinfo=timezone.utc)
    if last_seen is None or now - last_seen > timedelta(minutes=1):
        device.last_seen_at = now
    device.last_ip = ip
    query = request.url.query
    mobile_service.audit(
        db,
        "access",
        ip=ip,
        device_id=device.id,
        path=request.url.path + (f"?{query}" if query else ""),
    )
    db.commit()
    return MobileContext(device=device, reps=device.rep_names, ip=ip)


Mobile = Annotated[MobileContext, Depends(get_mobile_context)]
