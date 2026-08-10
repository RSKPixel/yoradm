"""Application-owned daybook2 lines synced from tallydata_daybook2."""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, Float, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class YoradmDaybook2(Base):
    __tablename__ = "yoradm_daybook2"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    sync_key: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    vtype: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    vno: Mapped[Optional[str]] = mapped_column(String(64), nullable=True, index=True)
    vdt: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True, index=True)
    narration: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    debit_credit: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    ledger_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    costcentre_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    costcentre_amt: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    ledger_amount: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    bill_no: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    bill_type: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    synced_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
