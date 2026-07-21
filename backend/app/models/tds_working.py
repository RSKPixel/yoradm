from __future__ import annotations

from datetime import date, datetime
from typing import Optional

from sqlalchemy import BigInteger, Date, DateTime, Float, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class TdsWorking(Base):
    """Denormalized TDS workings snapshot (no FKs to Tally tables)."""

    __tablename__ = "yoradm_tds_workings"
    __table_args__ = (
        UniqueConstraint("source_id", name="uq_yoradm_tds_workings_source_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    source_id: Mapped[int] = mapped_column(BigInteger, nullable=False, index=True)
    voucher_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True, index=True)
    voucher_no: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    party: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    pan: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    tds_head: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    amount: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    narration: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    bill_no: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    bill_type: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    expenses_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    expenses_amount: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
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
