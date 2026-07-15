/**
 * Purchase vouchers still free from the legacy/old system (allowable for new picks).
 * Do NOT put vouchers already used in Yoradm here — present-system usage is
 * tracked live from production lines and stays off this allowlist.
 */
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
  return !ORID_LEGACY_PURCHASE_VOUCHER_ALLOWLIST.has(no)
}
