import { formatValue } from './formatNumber'

/** Ageing columns for receivables summary. */
export const AGEING_BUCKETS = [
  { key: 'b0_30', label: '0–30', matches: (days) => days != null && days <= 30 },
  { key: 'b31_60', label: '31–60', matches: (days) => days != null && days >= 31 && days <= 60 },
  { key: 'b61_90', label: '61–90', matches: (days) => days != null && days >= 61 && days <= 90 },
  { key: 'bAbove90', label: '>90', matches: (days) => days != null && days > 90 },
]

function emptyBuckets() {
  const buckets = { total: 0 }
  for (const col of AGEING_BUCKETS) buckets[col.key] = 0
  return buckets
}

function addInvoice(target, invoice) {
  const amount = Number(invoice?.amount) || 0
  const days = invoice?.days
  target.total += amount
  for (const col of AGEING_BUCKETS) {
    if (col.matches(days)) {
      target[col.key] += amount
      break
    }
  }
}

/** One row per party with ageing bucket amounts (+ total). */
export function buildPartyAgeingSummary(partyGroups = []) {
  return partyGroups.map((group) => {
    const row = {
      ledgerName: group.ledgerName,
      ...emptyBuckets(),
    }
    for (const inv of group.invoices ?? []) addInvoice(row, inv)
    return row
  })
}

export function sumAgeingRows(rows = []) {
  const totals = emptyBuckets()
  for (const row of rows) {
    totals.total += Number(row.total) || 0
    for (const col of AGEING_BUCKETS) {
      totals[col.key] += Number(row[col.key]) || 0
    }
  }
  return totals
}

export function formatAgeingAmount(value) {
  const num = Number(value)
  if (!Number.isFinite(num) || num === 0) return ''
  return formatValue(num)
}
