from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, Float, ForeignKey, Integer, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class OridMonthlyOpening(Base):
    """Manual Orid Dhall opening stock for the Monthly Summary P&L (50kg bags, rate per quintal)."""

    __tablename__ = "yoradm_orid_monthly_opening"
    __table_args__ = (
        UniqueConstraint("year", "month", name="uq_yoradm_orid_monthly_opening_year_month"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    year: Mapped[int] = mapped_column(Integer, nullable=False)
    month: Mapped[int] = mapped_column(Integer, nullable=False)
    opening_qty: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    opening_rate: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    updated_by: Mapped[Optional[int]] = mapped_column(
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
