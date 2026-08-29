"""Standard Orid Raw milling yield splits for stock analysis."""

from __future__ import annotations

ORID_RAW_STOCK_GROUP = "Orid Raw"

# stock_group -> share of raw input (quintals)
ORID_RAW_YIELD_SPLITS: tuple[tuple[str, float], ...] = (
    ("Orid Dhall", 0.66),
    ("Orid Dhall Split", 0.13),
    ("Orid Dhall Rejection", 0.01),
    ("Orid Husk", 0.16),
)

ORID_RAW_YIELD_BY_GROUP: dict[str, float] = dict(ORID_RAW_YIELD_SPLITS)
