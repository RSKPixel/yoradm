from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from sqlalchemy import DateTime, ForeignKey, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

DEVICE_PENDING = "pending"
DEVICE_ACTIVE = "active"
DEVICE_REVOKED = "revoked"


class MobileDevice(Base):
    """A salesman's phone, authorised in person by an admin. The phone itself is the credential."""

    __tablename__ = "yoradm_mobile_devices"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    label: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default=DEVICE_PENDING, index=True)
    # Random ID + secret generated on the phone; only the secret's hash is stored.
    device_uid: Mapped[Optional[str]] = mapped_column(String(64), nullable=True, unique=True)
    secret_hash: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    activation_code_hash: Mapped[Optional[str]] = mapped_column(String(64), nullable=True, unique=True)
    activation_expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    android_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    model: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    os_version: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    app_version: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    activated_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    last_seen_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    last_ip: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    revoked_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    reps: Mapped[List["MobileDeviceRep"]] = relationship(
        "MobileDeviceRep",
        cascade="all, delete-orphan",
        order_by="MobileDeviceRep.rep_name",
    )

    @property
    def rep_names(self) -> List[str]:
        return [r.rep_name for r in self.reps]


class MobileDeviceRep(Base):
    """Tally representative names a phone may see."""

    __tablename__ = "yoradm_mobile_device_reps"
    __table_args__ = (UniqueConstraint("device_id", "rep_name", name="uq_yoradm_mobile_device_reps"),)

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    device_id: Mapped[int] = mapped_column(
        ForeignKey("yoradm_mobile_devices.id", ondelete="CASCADE"), nullable=False, index=True
    )
    rep_name: Mapped[str] = mapped_column(String(255), nullable=False)


class MobileAudit(Base):
    __tablename__ = "yoradm_mobile_audit"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    device_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("yoradm_mobile_devices.id", ondelete="SET NULL"), nullable=True, index=True
    )
    event: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    path: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    detail: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    ip: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )
