from fastapi import APIRouter, HTTPException, Query, status

from app.core.deps import CurrentUser, DbSession
from app.schemas.brokerage import (
    BrokerageBrokersOut,
    BrokerageBuyersOut,
    BrokerageRatesSaveIn,
    BrokerageWorkingsOut,
)
from app.services import brokerage_service

router = APIRouter(prefix="/brokerage", tags=["brokerage"])


@router.get("/brokers", response_model=BrokerageBrokersOut)
def list_brokers(
    _: CurrentUser,
    db: DbSession,
    fy_start: int = Query(..., ge=2000, le=2100),
    month: int = Query(..., ge=1, le=12),
) -> BrokerageBrokersOut:
    try:
        return brokerage_service.list_brokers(db, fy_start=fy_start, month=month)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.get("/buyers", response_model=BrokerageBuyersOut)
def list_brokerage_buyers(
    _: CurrentUser,
    db: DbSession,
    fy_start: int = Query(..., ge=2000, le=2100),
    month: int = Query(..., ge=1, le=12),
    broker: str = Query(..., min_length=1),
) -> BrokerageBuyersOut:
    try:
        return brokerage_service.list_brokerage_buyers(
            db,
            fy_start=fy_start,
            month=month,
            broker=broker,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.get("", response_model=BrokerageWorkingsOut)
def list_brokerage(
    _: CurrentUser,
    db: DbSession,
    fy_start: int = Query(..., ge=2000, le=2100),
    month: int = Query(..., ge=1, le=12),
    broker: str = Query(..., min_length=1),
    reload: bool = Query(False),
) -> BrokerageWorkingsOut:
    try:
        return brokerage_service.list_brokerage(
            db,
            fy_start=fy_start,
            month=month,
            broker=broker,
            reload=reload,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.post("/rates", response_model=BrokerageWorkingsOut)
@router.post("/save", response_model=BrokerageWorkingsOut)
def save_brokerage(
    payload: BrokerageRatesSaveIn,
    _: CurrentUser,
    db: DbSession,
) -> BrokerageWorkingsOut:
    try:
        return brokerage_service.save_brokerage(db, payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
