"""Mobile app: phones authorised in person by an admin. The phone's stored secret is the credential."""

from __future__ import annotations

import hmac
import secrets
from datetime import datetime, timedelta, timezone
from hashlib import sha256
from typing import List, Optional

from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import create_mobile_access_token
from app.models.mobile import (
    DEVICE_ACTIVE,
    DEVICE_PENDING,
    DEVICE_REVOKED,
    MobileAudit,
    MobileDevice,
    MobileDeviceRep,
)
from app.models.tally import TallySyncAccount, TallySyncReceivable
from app.models.user import User
from app.schemas.mobile import (
    ActivateOut,
    ActivateRequest,
    DeviceActivationOut,
    DeviceCreate,
    DeviceUpdate,
    MobileAuditOut,
    MobileDeviceOut,
    SessionOut,
    SessionRequest,
)

# No 0/O/1/I so codes read cleanly.
CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
CODE_LENGTH = 8


def _sha(value: str) -> str:
    return sha256(value.encode("utf-8")).hexdigest()


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _aware(value: Optional[datetime]) -> Optional[datetime]:
    # MySQL returns naive datetimes; everything is stored as UTC.
    if value is None or value.tzinfo is not None:
        return value
    return value.replace(tzinfo=timezone.utc)


def _error(code: int, message: str, error_code: str) -> HTTPException:
    return HTTPException(status_code=code, detail={"detail": message, "code": error_code})


def audit(
    db: Session,
    event: str,
    *,
    ip: Optional[str] = None,
    device_id: Optional[int] = None,
    path: Optional[str] = None,
    detail: Optional[str] = None,
) -> None:
    db.add(
        MobileAudit(
            event=event,
            ip=ip,
            device_id=device_id,
            path=path[:255] if path else None,
            detail=detail[:255] if detail else None,
        )
    )


# --- Called by the app ---------------------------------------------------------------


def activate(db: Session, payload: ActivateRequest, ip: str) -> ActivateOut:
    device = (
        db.query(MobileDevice)
        .filter(
            MobileDevice.activation_code_hash == _sha(payload.code),
            MobileDevice.status == DEVICE_PENDING,
        )
        .first()
    )
    if not device or (_aware(device.activation_expires_at) or _now()) < _now():
        audit(db, "activate_failed", ip=ip, device_id=device.id if device else None)
        db.commit()
        raise _error(status.HTTP_400_BAD_REQUEST, "Invalid or expired activation code", "invalid_code")
    if db.query(MobileDevice.id).filter(MobileDevice.device_uid == payload.device_uid).first():
        raise _error(status.HTTP_409_CONFLICT, "Device already registered. Reinstall the app.", "device_conflict")

    now = _now()
    device.status = DEVICE_ACTIVE
    device.device_uid = payload.device_uid
    device.secret_hash = _sha(payload.device_secret)
    device.activation_code_hash = None
    device.activation_expires_at = None
    device.android_id = payload.android_id
    device.model = payload.model
    device.os_version = payload.os_version
    device.app_version = payload.app_version
    device.activated_at = now
    device.last_seen_at = now
    device.last_ip = ip
    audit(db, "activated", ip=ip, device_id=device.id, detail=payload.model)
    db.commit()
    return ActivateOut(name=device.name)


def start_session(db: Session, payload: SessionRequest, ip: str) -> SessionOut:
    """Trade the phone's credentials for a short-lived access token."""
    device = db.query(MobileDevice).filter(MobileDevice.device_uid == payload.device_uid).first()
    if not device or not device.secret_hash or not hmac.compare_digest(
        device.secret_hash, _sha(payload.device_secret)
    ):
        audit(db, "session_failed", ip=ip, device_id=device.id if device else None)
        db.commit()
        raise _error(status.HTTP_401_UNAUTHORIZED, "This phone is not authorised", "device_unknown")
    if device.status == DEVICE_REVOKED:
        raise _error(status.HTTP_401_UNAUTHORIZED, "This phone has been revoked", "device_revoked")
    if device.status != DEVICE_ACTIVE:
        raise _error(status.HTTP_401_UNAUTHORIZED, "This phone is not authorised", "device_unknown")

    device.last_seen_at = _now()
    device.last_ip = ip
    if payload.app_version:
        device.app_version = payload.app_version
    audit(db, "session", ip=ip, device_id=device.id)
    db.commit()
    return SessionOut(access_token=create_mobile_access_token(device.id))


# --- Admin ---------------------------------------------------------------------------


def list_devices(db: Session) -> List[MobileDeviceOut]:
    devices = db.query(MobileDevice).order_by(MobileDevice.name.asc(), MobileDevice.id.desc()).all()
    return [MobileDeviceOut.model_validate(d) for d in devices]


def list_rep_options(db: Session) -> List[str]:
    names = set()
    for column in (TallySyncReceivable.representative, TallySyncAccount.representative):
        for (name,) in db.query(func.trim(column)).distinct().all():
            if name:
                names.add(name)
    return sorted(names, key=str.lower)


def _new_code(db: Session) -> str:
    while True:
        code = "".join(secrets.choice(CODE_ALPHABET) for _ in range(CODE_LENGTH))
        if not db.query(MobileDevice.id).filter(MobileDevice.activation_code_hash == _sha(code)).first():
            return code


def create_device(db: Session, payload: DeviceCreate, admin: User) -> DeviceActivationOut:
    settings = get_settings()
    code = _new_code(db)
    device = MobileDevice(
        name=payload.name,
        label=(payload.label or "").strip() or None,
        status=DEVICE_PENDING,
        activation_code_hash=_sha(code),
        activation_expires_at=_now() + timedelta(minutes=settings.mobile_activation_minutes),
        reps=[MobileDeviceRep(rep_name=name) for name in payload.reps],
    )
    db.add(device)
    db.flush()
    audit(db, "device_created", device_id=device.id, detail=f"by {admin.username}: {', '.join(payload.reps)}")
    db.commit()
    db.refresh(device)
    return DeviceActivationOut(
        device=MobileDeviceOut.model_validate(device),
        activation_code=f"{code[:4]}-{code[4:]}",
    )


def _get_device(db: Session, device_id: int) -> MobileDevice:
    device = db.query(MobileDevice).filter(MobileDevice.id == device_id).first()
    if not device:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Device not found")
    return device


def update_device(db: Session, device_id: int, payload: DeviceUpdate, admin: User) -> MobileDeviceOut:
    device = _get_device(db, device_id)
    changes = []
    if payload.name is not None and payload.name.strip():
        device.name = payload.name.strip()
        changes.append(f"name={device.name}")
    if payload.label is not None:
        device.label = payload.label.strip() or None
    if payload.reps is not None:
        # Delete before insert: a rep kept in the new list would otherwise hit the unique key.
        device.reps.clear()
        db.flush()
        device.reps.extend(MobileDeviceRep(rep_name=name) for name in payload.reps)
        changes.append(f"reps={', '.join(payload.reps) or 'none'}")
    audit(db, "device_updated", device_id=device.id, detail=f"by {admin.username}: {'; '.join(changes)}")
    db.commit()
    db.refresh(device)
    return MobileDeviceOut.model_validate(device)


def new_activation_code(db: Session, device_id: int, admin: User) -> DeviceActivationOut:
    """Re-issue a code for a pending phone whose code expired before it was entered."""
    device = _get_device(db, device_id)
    if device.status != DEVICE_PENDING:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only pending phones get a new code")
    code = _new_code(db)
    device.activation_code_hash = _sha(code)
    device.activation_expires_at = _now() + timedelta(minutes=get_settings().mobile_activation_minutes)
    audit(db, "code_reissued", device_id=device.id, detail=f"by {admin.username}")
    db.commit()
    db.refresh(device)
    return DeviceActivationOut(
        device=MobileDeviceOut.model_validate(device),
        activation_code=f"{code[:4]}-{code[4:]}",
    )


def revoke_device(db: Session, device_id: int, admin: User) -> MobileDeviceOut:
    device = _get_device(db, device_id)
    device.status = DEVICE_REVOKED
    device.revoked_at = _now()
    device.activation_code_hash = None
    device.activation_expires_at = None
    audit(db, "revoked", device_id=device.id, detail=f"by {admin.username}")
    db.commit()
    db.refresh(device)
    return MobileDeviceOut.model_validate(device)


def delete_device(db: Session, device_id: int, admin: User) -> None:
    device = _get_device(db, device_id)
    if device.status == DEVICE_ACTIVE:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Revoke the phone before deleting it")
    audit(db, "device_deleted", detail=f"{device.name} (#{device.id}) by {admin.username}")
    db.delete(device)
    db.commit()


def list_audit(db: Session, *, device_id: Optional[int], limit: int) -> List[MobileAuditOut]:
    query = db.query(MobileAudit, MobileDevice.name).outerjoin(
        MobileDevice, MobileDevice.id == MobileAudit.device_id
    )
    if device_id is not None:
        query = query.filter(MobileAudit.device_id == device_id)
    rows = query.order_by(MobileAudit.id.desc()).limit(limit).all()
    return [
        MobileAuditOut.model_validate(entry).model_copy(update={"device_name": name})
        for entry, name in rows
    ]
