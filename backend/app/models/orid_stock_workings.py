from __future__ import annotations

from datetime import date, datetime
from typing import Any, Optional

from sqlalchemy import Date, DateTime, Float, ForeignKey, JSON, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class OridStockWorkings(Base):
    """Snapshot of Orid stock analysis Workings tab (auto-saved)."""

    __tablename__ = "yoradm_orid_stock_workings"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    as_of: Mapped[Optional[date]] = mapped_column(Date, nullable=True, index=True)
    estimated_sales_mode: Mapped[Optional[str]] = mapped_column(
        String(32),
        nullable=True,
        default="manual",
    )
    estimated_sales_50kg: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    qty_in_50kg: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    estimated_days: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    rows_json: Mapped[Optional[Any]] = mapped_column(JSON, nullable=True)
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
