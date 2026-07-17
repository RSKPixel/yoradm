from __future__ import annotations

from datetime import date, datetime
from typing import List, Optional

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Float,
    ForeignKey,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class PackingSku(Base):
    __tablename__ = "yoradm_packing_sku"
    __table_args__ = (
        UniqueConstraint("stock_item", "brand", name="uq_yoradm_packing_sku_item_brand"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    stock_item: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    brand: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    stock_group: Mapped[Optional[str]] = mapped_column(String(128), nullable=True, index=True)
    unit: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, index=True)
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

    fy_rows: Mapped[List["PackingStockFy"]] = relationship(
        back_populates="sku",
        cascade="all, delete-orphan",
    )
    purchases: Mapped[List["PackingPurchase"]] = relationship(
        back_populates="sku",
        cascade="all, delete-orphan",
    )


class PackingStockFy(Base):
    __tablename__ = "yoradm_packing_stock_fy"
    __table_args__ = (
        UniqueConstraint("sku_id", "fy", name="uq_yoradm_packing_stock_fy_sku_fy"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    sku_id: Mapped[int] = mapped_column(
        ForeignKey("yoradm_packing_sku.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    # FY label, e.g. "2026-2027".
    fy: Mapped[str] = mapped_column(String(9), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="Open", index=True)
    opening_qty: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    purchase_qty: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    sales_qty: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    adjust_qty: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    closing_qty: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
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

    sku: Mapped["PackingSku"] = relationship(back_populates="fy_rows")


class PackingPurchase(Base):
    __tablename__ = "yoradm_packing_purchase"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    sku_id: Mapped[int] = mapped_column(
        ForeignKey("yoradm_packing_sku.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    purchase_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    qty: Mapped[float] = mapped_column(Float, nullable=False)
    rate: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    supplier: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, index=True)
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

    sku: Mapped["PackingSku"] = relationship(back_populates="purchases")
