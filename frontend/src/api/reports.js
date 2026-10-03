import api from './client'

export async function fetchMonthlySummary({ year, month }) {
  const { data } = await api.get('/reports/monthly-summary', {
    params: { year, month },
  })
  return data
}
