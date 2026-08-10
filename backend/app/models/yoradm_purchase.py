"""Application-owned purchase lines synced from tallydata_purchases."""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, Float, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class YoradmPurchase(Base):
    __tablename__ = "yoradm_purchase"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    sync_key: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    voucher_no: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    voucher_date: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    ledger_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    broker: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    item_count: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    itemno: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    stock_item: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    brand: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    packing: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    qty: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    weight: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    rate: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    amount: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    synced_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
