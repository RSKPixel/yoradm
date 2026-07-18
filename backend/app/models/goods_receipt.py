from __future__ import annotations

from datetime import date, datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import Boolean, Date, DateTime, Float, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.user import User


class GoodsReceipt(Base):
    __tablename__ = "yoradm_goods_receipt"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    receipt_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    vendor: Mapped[str] = mapped_column(String(255), nullable=False)
    stock_item: Mapped[str] = mapped_column(String(255), nullable=False)
    qty: Mapped[float] = mapped_column(Float, nullable=False)
    weight: Mapped[float] = mapped_column(Float, nullable=False)
    invoice_no: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    invoice_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    invoice_value: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    invoiced_weight: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    tds_applicable: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    tds_value: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    unloaded_at: Mapped[str] = mapped_column(String(128), nullable=False)
    broker: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    received_by: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    vehicle_no: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    place: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    remarks: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
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

    creator: Mapped[Optional["User"]] = relationship()
