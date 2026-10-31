from datetime import datetime
from typing import Annotated, List, Optional

from pydantic import BaseModel, BeforeValidator, ConfigDict, Field, field_serializer, field_validator

from app.schemas import _as_utc_iso
from app.schemas.tally import ReceivableAgeingBuckets


def _clean_reps(value: List[str]) -> List[str]:
    seen: List[str] = []
    for name in value:
        name = name.strip()
        if name and name not in seen:
            seen.append(name)
    return seen


# --- App-side: activation and session ----------------------------------------------


def _clip(limit: int):
    # Phone details are informational and vary by maker / Expo Go: trim, never reject.
    def clip(value: object) -> Optional[str]:
        if value is None:
            return None
        text = str(value).strip()
        return text[:limit] or None

    return BeforeValidator(clip)


DeviceDetail64 = Annotated[Optional[str], _clip(64)]
DeviceDetail128 = Annotated[Optional[str], _clip(128)]


class DeviceCredentials(BaseModel):
    device_uid: str = Field(min_length=16, max_length=64, pattern=r"^[A-Za-z0-9-]+$")
    device_secret: str = Field(min_length=32, max_length=128)


class ActivateRequest(DeviceCredentials):
    code: str = Field(min_length=6, max_length=16)
    android_id: DeviceDetail64 = None
    model: DeviceDetail128 = None
    os_version: DeviceDetail64 = None
    app_version: Annotated[Optional[str], _clip(32)] = None

    @field_validator("code")
    @classmethod
    def normalize_code(cls, value: str) -> str:
        return value.replace("-", "").replace(" ", "").upper()


class ActivateOut(BaseModel):
    name: str


class SessionRequest(DeviceCredentials):
    app_version: Annotated[Optional[str], _clip(32)] = None


class SessionOut(BaseModel):
    access_token: str
    token_type: str = "bearer"


class MobileMeOut(BaseModel):
    name: str
    company_name: str = ""
    reps: List[str]
    device_model: Optional[str] = None
    activated_at: Optional[datetime] = None

    @field_serializer("activated_at")
    def serialize_dt(self, value: Optional[datetime]) -> Optional[str]:
        return _as_utc_iso(value)


# --- App-side: receivables ---------------------------------------------------------


class PartyShareEvent(BaseModel):
    ledger: str = Field(min_length=1, max_length=255)
    action: str = Field(pattern=r"^(copied|shared)$")
    rep: Optional[str] = Field(default=None, max_length=255)


class MobileRepTotal(BaseModel):
    name: str
    total: float
    invoice_count: int


class MobileReceivableSummary(BaseModel):
    as_of: str
    synced_at: Optional[datetime] = None
    totals: ReceivableAgeingBuckets
    reps: List[MobileRepTotal]


class MobilePartyRow(ReceivableAgeingBuckets):
    ledger_name: str
    oldest_days: Optional[int] = None


class MobileBill(BaseModel):
    invoice_no: Optional[str] = None
    invoice_date: Optional[datetime] = None
    due_date: Optional[datetime] = None
    representative: Optional[str] = None
    amount: float
    days: Optional[int] = None
    age_bucket: str


class MobileInvoiceLine(BaseModel):
    stock_item: Optional[str] = None
    brand: Optional[str] = None
    packing: Optional[float] = None
    qty: Optional[float] = None
    qty_alt: Optional[float] = None
    alternate_unit: Optional[str] = None
    rate: Optional[float] = None
    amount: Optional[float] = None
    discount: Optional[float] = None
    cartage: Optional[float] = None


class MobileInvoiceDetail(BaseModel):
    invoice_no: str
    ledger_name: str
    invoice_date: Optional[datetime] = None
    representative: Optional[str] = None
    outstanding: float
    days: Optional[int] = None
    # False when the bill isn't in the synced sales data (older year, credit note, etc.).
    found: bool
    broker: Optional[str] = None
    lines: List[MobileInvoiceLine] = []
    total_qty: float = 0.0
    total_amount: float = 0.0


class MobilePartyDetail(BaseModel):
    ledger_name: str
    phone: Optional[str] = None
    mobile: Optional[str] = None
    totals: ReceivableAgeingBuckets
    bills: List[MobileBill]


# --- Admin-side --------------------------------------------------------------------


class MobileDeviceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    label: Optional[str] = None
    status: str
    reps: List[str] = Field(validation_alias="rep_names")
    model: Optional[str] = None
    os_version: Optional[str] = None
    app_version: Optional[str] = None
    android_id: Optional[str] = None
    activation_expires_at: Optional[datetime] = None
    activated_at: Optional[datetime] = None
    last_seen_at: Optional[datetime] = None
    last_ip: Optional[str] = None
    revoked_at: Optional[datetime] = None
    created_at: datetime

    @field_serializer(
        "activation_expires_at",
        "activated_at",
        "last_seen_at",
        "revoked_at",
        "created_at",
    )
    def serialize_dt(self, value: Optional[datetime]) -> Optional[str]:
        return _as_utc_iso(value)


class DeviceCreate(BaseModel):
    name: str = Field(min_length=1, max_length=128)
    label: Optional[str] = Field(default=None, max_length=128)
    reps: List[str] = Field(min_length=1, max_length=50)

    @field_validator("name")
    @classmethod
    def strip_name(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Name is required")
        return value

    @field_validator("reps")
    @classmethod
    def clean(cls, value: List[str]) -> List[str]:
        value = _clean_reps(value)
        if not value:
            raise ValueError("Select at least one representative")
        return value


class DeviceUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=128)
    label: Optional[str] = Field(default=None, max_length=128)
    reps: Optional[List[str]] = Field(default=None, max_length=50)

    @field_validator("reps")
    @classmethod
    def clean(cls, value: Optional[List[str]]) -> Optional[List[str]]:
        return None if value is None else _clean_reps(value)


class DeviceActivationOut(BaseModel):
    device: MobileDeviceOut
    activation_code: str


class MobileAuditOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    device_id: Optional[int] = None
    device_name: Optional[str] = None
    event: str
    path: Optional[str] = None
    detail: Optional[str] = None
    ip: Optional[str] = None
    created_at: datetime

    @field_serializer("created_at")
    def serialize_dt(self, value: datetime) -> str:
        return _as_utc_iso(value) or ""
