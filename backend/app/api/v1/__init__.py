from fastapi import APIRouter

from app.api.v1 import (
    auth,
    company,
    delivery_challans,
    orid_dhall_productions,
    packing_material,
    tally,
    users,
)

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(company.router)
api_router.include_router(tally.router)
api_router.include_router(delivery_challans.router)
api_router.include_router(orid_dhall_productions.router)
api_router.include_router(packing_material.router)


@api_router.get("/health", tags=["health"])
def health() -> dict[str, str]:
    return {"status": "ok"}
