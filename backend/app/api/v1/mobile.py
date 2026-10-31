"""Mobile app API. Only tokens issued to an authorised phone work here; web tokens are rejected."""

from typing import List, Optional

from fastapi import APIRouter, HTTPException, Query, Request, status

from app.core.deps import DbSession
from app.core.mobile_deps import Mobile
from app.core.rate_limit import check_rate_limit, client_ip
from app.schemas.mobile import (
    ActivateOut,
    ActivateRequest,
    MobileInvoiceDetail,
    MobileMeOut,
    MobilePartyDetail,
    MobilePartyRow,
    MobileReceivableSummary,
    PartyShareEvent,
    SessionOut,
    SessionRequest,
)
from app.services import company_service, mobile_receivables_service, mobile_service

router = APIRouter(prefix="/m", tags=["mobile"])


def _rep(value: Optional[str]) -> Optional[str]:
    value = (value or "").strip()
    return value or None


@router.post("/activate", response_model=ActivateOut)
def activate(payload: ActivateRequest, request: Request, db: DbSession) -> ActivateOut:
    ip = client_ip(request)
    check_rate_limit(f"activate:{ip}", limit=10, window_seconds=900)
    return mobile_service.activate(db, payload, ip)


@router.post("/session", response_model=SessionOut)
def start_session(payload: SessionRequest, request: Request, db: DbSession) -> SessionOut:
    ip = client_ip(request)
    check_rate_limit(f"session:{ip}", limit=60, window_seconds=900)
    return mobile_service.start_session(db, payload, ip)


@router.get("/me", response_model=MobileMeOut)
def me(ctx: Mobile, db: DbSession) -> MobileMeOut:
    company = company_service.get_company(db)
    return MobileMeOut(
        name=ctx.device.name,
        company_name=(company.company_name if company else "") or "",
        reps=ctx.reps,
        device_model=ctx.device.model,
        activated_at=ctx.device.activated_at,
    )


@router.get("/receivables/summary", response_model=MobileReceivableSummary)
def receivables_summary(
    ctx: Mobile,
    db: DbSession,
    rep: Optional[str] = Query(None, max_length=255),
) -> MobileReceivableSummary:
    return mobile_receivables_service.summary(db, ctx.reps, _rep(rep))


@router.get("/receivables/parties", response_model=List[MobilePartyRow])
def receivables_parties(
    ctx: Mobile,
    db: DbSession,
    rep: Optional[str] = Query(None, max_length=255),
) -> List[MobilePartyRow]:
    return mobile_receivables_service.parties(db, ctx.reps, _rep(rep))


@router.get("/receivables/party", response_model=MobilePartyDetail)
def receivables_party(
    ctx: Mobile,
    db: DbSession,
    ledger: str = Query(..., min_length=1, max_length=255),
    rep: Optional[str] = Query(None, max_length=255),
) -> MobilePartyDetail:
    return mobile_receivables_service.party_detail(db, ctx.reps, ledger, _rep(rep))


@router.get("/receivables/invoice", response_model=MobileInvoiceDetail)
def receivables_invoice(
    ctx: Mobile,
    db: DbSession,
    ledger: str = Query(..., min_length=1, max_length=255),
    invoice_no: str = Query(..., min_length=1, max_length=64),
    rep: Optional[str] = Query(None, max_length=255),
) -> MobileInvoiceDetail:
    return mobile_receivables_service.invoice_detail(db, ctx.reps, ledger, invoice_no, _rep(rep))


@router.post("/receivables/party/shared", status_code=status.HTTP_204_NO_CONTENT)
def party_shared(ctx: Mobile, db: DbSession, payload: PartyShareEvent) -> None:
    """The app reports each copy/share of a party statement, so data leaving the phone is on record."""
    if not mobile_receivables_service.has_party(db, ctx.reps, payload.ledger):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Party not found")
    detail = payload.ledger + (f" [{payload.rep}]" if payload.rep else "")
    mobile_service.audit(db, f"party_{payload.action}", ip=ctx.ip, device_id=ctx.device.id, detail=detail)
    db.commit()
