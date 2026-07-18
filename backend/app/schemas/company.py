from datetime import datetime, timezone
from typing import Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_serializer, field_validator


def _as_utc_iso(value: Optional[datetime]) -> Optional[str]:
    if value is None:
        return None
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def _strip_optional(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    trimmed = value.strip()
    return trimmed or None


def _strip_required(value: str) -> str:
    trimmed = value.strip()
    if not trimmed:
        raise ValueError("must not be empty")
    return trimmed


class CompanyUpdate(BaseModel):
    company_name: str = Field(min_length=1, max_length=255)
    address: str = Field(min_length=1, max_length=512)
    area: Optional[str] = Field(default=None, max_length=128)
    city: str = Field(min_length=1, max_length=128)
    state: str = Field(min_length=1, max_length=128)
    pincode: Optional[str] = Field(default=None, max_length=16)
    country: str = Field(default="India", min_length=1, max_length=64)
    email: Optional[EmailStr] = None
    mobile: Optional[str] = Field(default=None, max_length=32)
    gstin: Optional[str] = Field(default=None, max_length=20)
    pan: Optional[str] = Field(default=None, max_length=20)

    @field_validator("company_name", "address", "city", "state", "country")
    @classmethod
    def strip_required(cls, value: str) -> str:
        return _strip_required(value)

    @field_validator("area", "pincode", "mobile", "gstin", "pan")
    @classmethod
    def strip_optional(cls, value: Optional[str]) -> Optional[str]:
        return _strip_optional(value)

    @field_validator("gstin", "pan")
    @classmethod
    def normalize_tax_ids(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        return value.upper()


class CompanyPublicOut(BaseModel):
    """Minimal company branding available without authentication (e.g. sign-in)."""

    company_name: str = ""


class CompanyOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: Optional[int] = None
    company_name: str = ""
    address: str = ""
    area: Optional[str] = None
    city: str = ""
    state: str = ""
    pincode: Optional[str] = None
    country: str = "India"
    email: Optional[EmailStr] = None
    mobile: Optional[str] = None
    gstin: Optional[str] = None
    pan: Optional[str] = None
    tds_purchase_pct: Optional[float] = None
    tds_threshold: Optional[float] = None
    is_active: bool = True
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    @field_serializer("created_at", "updated_at")
    def serialize_datetimes(self, value: Optional[datetime]) -> Optional[str]:
        return _as_utc_iso(value)


class GeneralSettingsUpdate(BaseModel):
    tds_purchase_pct: Optional[float] = Field(default=None, ge=0, le=100)
    tds_threshold: Optional[float] = Field(default=None, ge=0)
