/** Standard 50 kg bag unit for qty × packing_kg → bag count (not a packing fallback). */
export const STANDARD_BAG_KG = 50

/** Pass through Tally sale packing when present; backend resolves the rest. */
export function tallyPackingOrNull(packing) {
  if (packing == null) return null
  const value = Number(packing)
  return Number.isFinite(value) ? value : null
}

export function bags50FromQty(qty, packingKg) {
  const q = Number(qty)
  const p = Number(packingKg)
  if (!Number.isFinite(q) || !Number.isFinite(p)) return 0
  return (q * p) / STANDARD_BAG_KG
}
