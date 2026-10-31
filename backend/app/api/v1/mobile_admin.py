from typing import List, Optional

from fastapi import APIRouter, Query, status

from app.core.deps import AdminUser, DbSession
from app.schemas.mobile import (
    DeviceActivationOut,
    DeviceCreate,
    DeviceUpdate,
    MobileAuditOut,
    MobileDeviceOut,
)
from app.services import mobile_service

router = APIRouter(prefix="/mobile-admin", tags=["mobile-admin"])


@router.get("/devices", response_model=List[MobileDeviceOut])
def list_devices(_: AdminUser, db: DbSession) -> List[MobileDeviceOut]:
    return mobile_service.list_devices(db)


@router.get("/representatives", response_model=List[str])
def list_representatives(_: AdminUser, db: DbSession) -> List[str]:
    return mobile_service.list_rep_options(db)


@router.post("/devices", response_model=DeviceActivationOut, status_code=status.HTTP_201_CREATED)
def create_device(admin: AdminUser, db: DbSession, payload: DeviceCreate) -> DeviceActivationOut:
    return mobile_service.create_device(db, payload, admin)


@router.patch("/devices/{device_id}", response_model=MobileDeviceOut)
def update_device(admin: AdminUser, db: DbSession, device_id: int, payload: DeviceUpdate) -> MobileDeviceOut:
    return mobile_service.update_device(db, device_id, payload, admin)


@router.post("/devices/{device_id}/code", response_model=DeviceActivationOut)
def new_activation_code(admin: AdminUser, db: DbSession, device_id: int) -> DeviceActivationOut:
    return mobile_service.new_activation_code(db, device_id, admin)


@router.post("/devices/{device_id}/revoke", response_model=MobileDeviceOut)
def revoke_device(admin: AdminUser, db: DbSession, device_id: int) -> MobileDeviceOut:
    return mobile_service.revoke_device(db, device_id, admin)


@router.delete("/devices/{device_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_device(admin: AdminUser, db: DbSession, device_id: int) -> None:
    mobile_service.delete_device(db, device_id, admin)


@router.get("/audit", response_model=List[MobileAuditOut])
def list_audit(
    _: AdminUser,
    db: DbSession,
    device_id: Optional[int] = Query(None),
    limit: int = Query(200, ge=1, le=1000),
) -> List[MobileAuditOut]:
    return mobile_service.list_audit(db, device_id=device_id, limit=limit)
