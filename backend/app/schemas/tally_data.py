"""Tally data sync request and response schemas."""

from __future__ import annotations

from datetime import datetime, timezone

from pydantic import BaseModel, Field, field_serializer


class TallySyncStepResult(BaseModel):
    source_table: str
    target_table: str
    source_count: int
    target_count_before: int
    target_count_after: int
    added: int
    updated: int
    unchanged: int
    removed: int


class TallySyncSessionResponse(BaseModel):
    started_at: datetime
    completed_at: datetime
    steps: list[TallySyncStepResult] = Field(default_factory=list)
    message: str

    @field_serializer("started_at", "completed_at")
    def serialize_datetime(self, value: datetime) -> str:
        if value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        return value.isoformat()
