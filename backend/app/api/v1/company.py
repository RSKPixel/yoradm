from fastapi import APIRouter

from app.core.deps import AdminUser, CurrentUser, DbSession
from app.schemas.company import CompanyOut, CompanyPublicOut, CompanyUpdate
from app.services import company_service

router = APIRouter(prefix="/company", tags=["company"])


@router.get("/public", response_model=CompanyPublicOut)
def get_company_public(db: DbSession) -> CompanyPublicOut:
    profile = company_service.get_company_profile(db)
    return CompanyPublicOut(company_name=profile.company_name or "")


@router.get("", response_model=CompanyOut)
def get_company(_: CurrentUser, db: DbSession) -> CompanyOut:
    return company_service.get_company_profile(db)


@router.put("", response_model=CompanyOut)
def update_company(_: AdminUser, db: DbSession, payload: CompanyUpdate) -> CompanyOut:
    company = company_service.upsert_company(db, payload)
    return CompanyOut.model_validate(company)
