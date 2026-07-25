from __future__ import annotations

from datetime import date, datetime
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import BigInteger, Date, DateTime, Float, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.user import User


class PostDatedCheque(Base):
    __tablename__ = "yoradm_post_dated_cheque"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    party: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    cheque_no: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    cheque_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    cheque_present_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    cheque_amount: Mapped[float] = mapped_column(Float, nullable=False)
    status: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        default="Postdated",
        server_default="Postdated",
        index=True,
    )
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

    creator: Mapped[Optional["User"]] = relationship()
    allocations: Mapped[List["PostDatedChequeAllocation"]] = relationship(
        back_populates="cheque",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )


class PostDatedChequeAllocation(Base):
    """How much of a cheque is applied to a receivable bill (partial / multi / discount OK)."""

    __tablename__ = "yoradm_post_dated_cheque_allocation"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    cheque_id: Mapped[int] = mapped_column(
        ForeignKey("yoradm_post_dated_cheque.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    party: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    receivable_id: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True, index=True)
    invoice_no: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    allocated_amount: Mapped[float] = mapped_column(Float, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    cheque: Mapped["PostDatedCheque"] = relationship(back_populates="allocations")
