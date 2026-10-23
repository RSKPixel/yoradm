from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, Float, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class OridStockCosting(Base):
    """Saved Orid stock analysis costing inputs (yield %, expenses %, byproduct rates)."""

    __tablename__ = "yoradm_orid_stock_costing"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    raw_qty_source: Mapped[Optional[str]] = mapped_column(
        String(32),
        nullable=True,
        default="both",
    )
    manual_raw_qty: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    manual_raw_rate: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    orid_dhall_pct: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    orid_dhall_split_pct: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    orid_rejection_pct: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    orid_husk_pct: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    expenses_pct: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    split_rate: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    rejection_rate: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    husk_rate: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
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
