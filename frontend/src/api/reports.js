import api from './client'

export async function fetchMonthlySummary({ year, month }) {
  const { data } = await api.get('/reports/monthly-summary', {
    params: { year, month },
  })
  return data
}

export async function fetchMonthlyRateGroups({ year, month, kind, stockGroups }) {
  const params = new URLSearchParams({ year: String(year), month: String(month), kind })
  for (const group of stockGroups) params.append('stock_group', group)
  const { data } = await api.get(`/reports/monthly-summary/rate-groups?${params}`)
  return data
}

export async function saveMonthlyOpening({ year, month, openingQty, openingRate }) {
  const { data } = await api.put('/reports/monthly-summary/opening', {
    year,
    month,
    opening_qty: openingQty,
    opening_rate: openingRate,
  })
  return data
}
