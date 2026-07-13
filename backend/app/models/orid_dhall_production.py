from __future__ import annotations

from datetime import date, datetime
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import Date, DateTime, Float, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.user import User


class OridDhallProduction(Base):
    __tablename__ = "yoradm_orid_dhall_production"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    production_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    lot_no: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="Open", index=True)
    wet_flour_yield: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    split_pct: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    opening_bags: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    opening_rate: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    previous_batch_bags: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    previous_batch_rate: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    delivery_bags: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    delivery_rate: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    closing_bags: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    closing_rate: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    split_bags: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    split_rate: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    sortex_bags: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    sortex_rate: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    husk_bags: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    husk_rate: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
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

    lines: Mapped[List["OridDhallProductionLine"]] = relationship(
        back_populates="production",
        cascade="all, delete-orphan",
        order_by="OridDhallProductionLine.id",
    )
    creator: Mapped[Optional["User"]] = relationship()


class OridDhallProductionLine(Base):
    __tablename__ = "yoradm_orid_dhall_production_line"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    production_id: Mapped[int] = mapped_column(
        ForeignKey("yoradm_orid_dhall_production.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    line_kind: Mapped[str] = mapped_column(String(16), nullable=False, index=True)
    purchase_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    voucher_no: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    voucher_date: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    ledger_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    broker: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    stock_item: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    brand: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    packing: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    qty: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    weight: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    rate: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    amount: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    line_no: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    production: Mapped["OridDhallProduction"] = relationship(back_populates="lines")
