from typing import Optional

from sqlalchemy.orm import Session

from app.models.company import Company
from app.schemas.company import CompanyOut, CompanyUpdate


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
