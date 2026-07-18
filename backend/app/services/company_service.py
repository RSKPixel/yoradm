from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.company import Company
from app.schemas.company import CompanyOut, CompanyUpdate, GeneralSettingsUpdate


def get_company(db: Session) -> Optional[Company]:
    return db.query(Company).order_by(Company.id.asc()).first()


def get_company_profile(db: Session) -> CompanyOut:
    company = get_company(db)
    if company is None:
        return CompanyOut()
    return CompanyOut.model_validate(company)


def upsert_company(db: Session, payload: CompanyUpdate) -> Company:
    company = get_company(db)
    data = payload.model_dump()
    if company is None:
        company = Company(**data)
        db.add(company)
    else:
        for key, value in data.items():
            setattr(company, key, value)
    db.commit()
    db.refresh(company)
    return company


def update_general_settings(db: Session, payload: GeneralSettingsUpdate) -> Company:
    company = get_company(db)
    if company is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Save company profile first before updating general settings",
        )
    company.tds_purchase_pct = payload.tds_purchase_pct
    company.tds_threshold = payload.tds_threshold
    db.commit()
    db.refresh(company)
    return company
