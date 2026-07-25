from __future__ import annotations

from datetime import date, datetime

from sqlalchemy import Date, DateTime, Float, Integer, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class PartyCollectionPerformance(Base):
    """Cached avg payment days per party (survives Tally sync)."""

    __tablename__ = "yoradm_party_collection_performance"
    __table_args__ = (
        UniqueConstraint("ledger_name", name="uq_yoradm_party_collection_perf_ledger"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    ledger_name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    avg_days: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    matched_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    matched_amount: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    date_from: Mapped[date] = mapped_column(Date, nullable=False)
    date_to: Mapped[date] = mapped_column(Date, nullable=False)
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
