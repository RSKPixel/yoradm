from __future__ import annotations

from fastapi import APIRouter

from app.core.deps import CurrentUser, DbSession
from app.schemas.tally_data import TallySyncSessionResponse
from app.services import tally_data_sync_service

router = APIRouter(prefix="/tally-data", tags=["tally-data"])


@router.post("/sync", response_model=TallySyncSessionResponse)
def sync_tally_data(_: CurrentUser, db: DbSession) -> TallySyncSessionResponse:
    """Compare tallydata tables and sync into yoradm_* application tables."""
    return tally_data_sync_service.sync_tally_data(db)
