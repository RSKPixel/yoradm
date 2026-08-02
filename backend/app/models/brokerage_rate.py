from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, Float, Integer, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class BrokerageRate(Base):
    """Manual per-quintal brokerage rate for FY + month + broker + side + stock item."""

    __tablename__ = "yoradm_brokerage_rate"
    __table_args__ = (
        UniqueConstraint(
            "fy_start",
            "month",
            "broker",
            "side",
            "stock_item",
            name="uq_yoradm_brokerage_rate_key",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    fy_start: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    month: Mapped[int] = mapped_column(Integer, nullable=False)
    broker: Mapped[str] = mapped_column(String(255), nullable=False)
    side: Mapped[str] = mapped_column(String(16), nullable=False)  # sale | purchase
    stock_item: Mapped[str] = mapped_column(String(255), nullable=False)
    rate_per_quintal: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    qty_adjust: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
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
