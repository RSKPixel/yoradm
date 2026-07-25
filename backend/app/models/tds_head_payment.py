from __future__ import annotations

from datetime import date, datetime
from typing import Optional

from sqlalchemy import Date, DateTime, Integer, LargeBinary, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class TdsHeadPayment(Base):
    """Per FY-month TDS head payment date and challan PDF."""

    __tablename__ = "yoradm_tds_head_payment"
    __table_args__ = (
        UniqueConstraint(
            "fy_start",
            "month",
            "tds_head",
            name="uq_yoradm_tds_head_payment_fy_month_head",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    fy_start: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    month: Mapped[int] = mapped_column(Integer, nullable=False)
    tds_head: Mapped[str] = mapped_column(String(255), nullable=False)
    payment_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    pdf_data: Mapped[Optional[bytes]] = mapped_column(LargeBinary(length=(16 * 1024 * 1024) - 1), nullable=True)
    pdf_filename: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    pdf_content_type: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    pdf_size: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
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
