export function formatSummaryQty(value) {
  const num = Number(value)
  if (!Number.isFinite(num) || num === 0) return '—'
  return Number.isInteger(num) ? String(num) : num.toLocaleString(undefined, { maximumFractionDigits: 3 })
}

export function formatPackingHeader(value) {
  if (value === '') return '—'
  const num = Number(value)
  if (!Number.isFinite(num)) return `${value} kgs`
  const label = Number.isInteger(num)
    ? String(num)
    : num.toLocaleString(undefined, { maximumFractionDigits: 3 })
  return `${label} kgs`
}

function packingSortKey(value) {
  if (value === '') return Number.POSITIVE_INFINITY
  const num = Number(value)
  return Number.isFinite(num) ? num : Number.POSITIVE_INFINITY
}

export function buildDeliverySummary(lines) {
  const packingKeys = new Set()
  const map = new Map()

  for (const line of lines) {
    const stockItem = line.stock_item?.trim() || '—'
    const brand = line.brand?.trim() || '—'
    const packingKey = line.packing == null || line.packing === '' ? '' : String(line.packing)
    packingKeys.add(packingKey)

    const key = `${stockItem}::${brand}`
    const qty = Number(line.qty)
    const add = Number.isFinite(qty) ? qty : 0
    let row = map.get(key)
    if (!row) {
      row = { stockItem, brand, byPacking: {}, total: 0 }
      map.set(key, row)
    }
    row.byPacking[packingKey] = (row.byPacking[packingKey] || 0) + add
    row.total += add
  }

  const packings = [...packingKeys].sort((a, b) => packingSortKey(a) - packingSortKey(b))
  const rows = [...map.values()].sort((a, b) => {
    const byItem = a.stockItem.localeCompare(b.stockItem)
    if (byItem !== 0) return byItem
    return a.brand.localeCompare(b.brand)
  })

  const columnTotals = Object.fromEntries(packings.map((p) => [p, 0]))
  let grandTotal = 0
  for (const row of rows) {
    for (const p of packings) {
      columnTotals[p] += row.byPacking[p] || 0
    }
    grandTotal += row.total
  }

  return { packings, rows, columnTotals, grandTotal }
}
