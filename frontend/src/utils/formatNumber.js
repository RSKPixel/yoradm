/** Comma-separated number for tables (Indian grouping). */
export function formatCommaNumber(value, fractionDigits = 0) {
  const num = Number(value)
  if (!Number.isFinite(num)) return ''
  return num.toLocaleString('en-IN', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })
}

export function formatQty(value) {
  return formatCommaNumber(value, 0)
}

export function formatWeight(value) {
  return formatCommaNumber(value, 0)
}

export function formatRate(value) {
  return formatCommaNumber(value, 2)
}

export function formatValue(value) {
  return formatCommaNumber(value, 2)
}

/** Rate = (value / weight) * 100 */
export function rateFromValueWeight(line) {
  const value = Number(line?.amount)
  const weight = Number(line?.weight)
  const qty = Number(line?.qty)
  const denom = Number.isFinite(weight) && weight !== 0 ? weight : qty
  if (!Number.isFinite(value) || !Number.isFinite(denom) || denom === 0) return null
  return (value / denom) * 100
}

export function lineWeightKg(line) {
  const w = Number(line?.weight)
  if (Number.isFinite(w)) return w
  const q = Number(line?.qty)
  return Number.isFinite(q) ? q : 0
}

/** Totals for selected purchase lines. */
export function aggregatePurchaseLines(lines = []) {
  let totalWeight = 0
  let totalValue = 0
  let totalQty = 0
  for (const line of lines) {
    totalWeight += lineWeightKg(line)
    const amount = Number(line?.amount)
    if (Number.isFinite(amount)) totalValue += amount
    const qty = Number(line?.qty)
    if (Number.isFinite(qty)) totalQty += qty
  }
  const quintal = totalWeight / 100
  const rate = totalWeight === 0 ? null : (totalValue / totalWeight) * 100
  return { totalWeight, totalValue, totalQty, quintal, rate }
}
