/**
 * Purchase vouchers still free from the legacy/old system (≤ 1720).
 * Do NOT put vouchers already used in Yoradm here — present-system usage is
 * tracked live from production lines and stays off this allowlist.
 *
 * Any voucher number after 1720 is treated as present-system (not legacy).
 */
export const ORID_LEGACY_PURCHASE_VOUCHER_CUTOFF = 1720

export const ORID_LEGACY_PURCHASE_VOUCHER_ALLOWLIST = new Set([
  '1699',
  '1707',
  '1712',
  '1713',
  '1714',
  '1715',
  '1716',
  '1710',
  '1702',
  '1720',
])

/** @deprecated Use ORID_LEGACY_PURCHASE_VOUCHER_ALLOWLIST */
export const ORID_LEGACY_PURCHASE_VOUCHER_EXCLUDE_FROM_USED =
  ORID_LEGACY_PURCHASE_VOUCHER_ALLOWLIST

export function isLegacyBlockedPurchaseVoucher(voucherNo) {
  const no = String(voucherNo ?? '').trim()
  if (!no) return false
  const n = Number(no)
  if (Number.isFinite(n) && n > ORID_LEGACY_PURCHASE_VOUCHER_CUTOFF) return false
  return !ORID_LEGACY_PURCHASE_VOUCHER_ALLOWLIST.has(no)
}
