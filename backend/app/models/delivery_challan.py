from __future__ import annotations

from datetime import date, datetime
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import Date, DateTime, Float, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.user import User


class DeliveryChallan(Base):
    __tablename__ = "yoradm_delivery_challan"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    challan_date: Mapped[date] = mapped_column(Date, nullable=False)
    vehicle_no: Mapped[str] = mapped_column(String(64), nullable=False)
    driver_name: Mapped[str] = mapped_column(String(128), nullable=False)
    batch_no: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    created_by: Mapped[Optional[int]] = mapped_column(
        ForeignKey("yoradm_users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    details: Mapped[List["DeliveryChallanDetail"]] = relationship(
        back_populates="challan",
        cascade="all, delete-orphan",
        order_by="DeliveryChallanDetail.id",
    )
    creator: Mapped[Optional["User"]] = relationship()


class DeliveryChallanDetail(Base):
    __tablename__ = "yoradm_delivery_challan_detail"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    challan_id: Mapped[int] = mapped_column(
        ForeignKey("yoradm_delivery_challan.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    voucher_no: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    voucher_date: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    ledger_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    stock_item: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    brand: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    packing: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    qty: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    amount: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    discount: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    delivery_location: Mapped[str] = mapped_column(String(128), nullable=False)
    line_no: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    challan: Mapped["DeliveryChallan"] = relationship(back_populates="details")
