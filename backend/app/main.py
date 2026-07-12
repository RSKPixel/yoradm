from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1 import api_router
from app.core.config import get_settings
from app.core.logging import setup_logging
from app.middleware.errors import register_exception_handlers
from app.middleware.logging import RequestLoggingMiddleware

settings = get_settings()
setup_logging(settings.log_level)

app = FastAPI(
    title="Yoradm ERP API",
    version="1.0.0",
    description="Dhall mill ERP API with JWT auth and Tally data access",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(RequestLoggingMiddleware)
register_exception_handlers(app)
app.include_router(api_router)
