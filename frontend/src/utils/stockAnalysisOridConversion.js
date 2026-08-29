import {
  DEFAULT_ORID_YIELD_PCTS,
  ORID_RAW_STOCK_GROUP,
  ORID_YIELD_GROUPS,
} from '../constants/oridRawYield'

function metricQuintals(metric) {
  return Number(metric?.quintals) || 0
}

function metricsFromQuintals(quintals) {
  return { quintals: Number(quintals) || 0 }
}

function rowMetrics(row) {
  return {
    stock_group: row.stock_group,
    closing: metricQuintals(row.closing),
    closing_4w_ma: metricQuintals(row.closing_4w_ma),
    last_30_days: metricQuintals(row.last_30_days),
    avg_3_months: metricQuintals(row.avg_3_months),
  }
}

function metricsToRow(row) {
  return {
    stock_group: row.stock_group,
    closing: metricsFromQuintals(row.closing),
    closing_4w_ma: metricsFromQuintals(row.closing_4w_ma),
    last_30_days: metricsFromQuintals(row.last_30_days),
    avg_3_months: metricsFromQuintals(row.avg_3_months),
  }
}

/** Allocate Orid Raw quintals into output groups using the given yield percentages. */
export function applyOridRawConversion(rows, yieldPctByGroup = DEFAULT_ORID_YIELD_PCTS) {
  const rawRow = rows.find((row) => row.stock_group === ORID_RAW_STOCK_GROUP)
  if (!rawRow) return rows

  const rawClosing = metricQuintals(rawRow.closing)
  const rawClosing4w = metricQuintals(rawRow.closing_4w_ma)
  const rawLast30 = metricQuintals(rawRow.last_30_days)
  const rawAvg3 = metricQuintals(rawRow.avg_3_months)

  if (rawClosing === 0 && rawClosing4w === 0 && rawLast30 === 0 && rawAvg3 === 0) {
    return rows.filter((row) => row.stock_group !== ORID_RAW_STOCK_GROUP)
  }

  const byGroup = new Map()
  for (const row of rows) {
    if (row.stock_group === ORID_RAW_STOCK_GROUP) continue
    byGroup.set(row.stock_group, rowMetrics(row))
  }

  for (const group of ORID_YIELD_GROUPS) {
    const fraction = (Number(yieldPctByGroup[group]) || 0) / 100
    if (fraction === 0) continue

    const existing = byGroup.get(group) || {
      stock_group: group,
      closing: 0,
      closing_4w_ma: 0,
      last_30_days: 0,
      avg_3_months: 0,
    }

    byGroup.set(group, {
      stock_group: group,
      closing: existing.closing + rawClosing * fraction,
      closing_4w_ma: existing.closing_4w_ma + rawClosing4w * fraction,
      last_30_days: existing.last_30_days + rawLast30 * fraction,
      avg_3_months: existing.avg_3_months + rawAvg3 * fraction,
    })
  }

  return Array.from(byGroup.values())
    .map(metricsToRow)
    .sort((a, b) => {
      const closingDiff = metricQuintals(b.closing) - metricQuintals(a.closing)
      if (closingDiff !== 0) return closingDiff
      const last30Diff = metricQuintals(b.last_30_days) - metricQuintals(a.last_30_days)
      if (last30Diff !== 0) return last30Diff
      return String(a.stock_group).localeCompare(String(b.stock_group), undefined, {
        sensitivity: 'base',
      })
    })
}

export function isOridYieldGroup(stockGroup) {
  return ORID_YIELD_GROUPS.includes(stockGroup)
}
