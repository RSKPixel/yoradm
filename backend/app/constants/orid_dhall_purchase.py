"""Orid Dhall purchase voucher rules shared by API validation."""

from __future__ import annotations

# Vouchers still free from the legacy/old system (still allowable for new picks).
# Do NOT put vouchers already consumed in Yoradm here — present-system usage is
# tracked live from production lines and must stay out of this allowlist.
LEGACY_PURCHASE_VOUCHER_ALLOWLIST = frozenset(
    {
        "1699",
        "1707",
        "1712",
        "1713",
        "1714",
        "1715",
        "1716",
        "1710",
        "1702",
        "1720",
    }
)

# Back-compat alias
LEGACY_PURCHASE_VOUCHER_EXCLUDE_FROM_USED = LEGACY_PURCHASE_VOUCHER_ALLOWLIST


def is_legacy_blocked_purchase_voucher(voucher_no: str | None) -> bool:
    stripped = str(voucher_no or "").strip()
    if not stripped:
        return False
    return stripped not in LEGACY_PURCHASE_VOUCHER_ALLOWLIST
