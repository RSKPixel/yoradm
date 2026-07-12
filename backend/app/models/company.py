from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Company(Base):
    __tablename__ = "yoradm_company"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    company_name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    legal_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    address: Mapped[str] = mapped_column(String(512), nullable=False)
    area: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    city: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    state: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    pincode: Mapped[Optional[str]] = mapped_column(String(16), nullable=True)
    country: Mapped[str] = mapped_column(String(64), nullable=False, default="India")
    email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, index=True)
    phone: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    mobile: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    website: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    gstin: Mapped[Optional[str]] = mapped_column(String(20), nullable=True, unique=True, index=True)
    pan: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    cin: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    contact_person: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    logo_url: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
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
