import api from './client'

export async function createOridDhallProduction(payload) {
  const { data } = await api.post('/orid-dhall-productions', payload)
  return data
}

export async function updateOridDhallProduction(productionId, payload) {
  const { data } = await api.put(`/orid-dhall-productions/${productionId}`, payload)
  return data
}

export async function updateOridDhallProductionStatus(productionId, status) {
  const { data } = await api.patch(`/orid-dhall-productions/${productionId}/status`, {
    status,
  })
  return data
}

export async function deleteOridDhallProduction(productionId) {
  await api.delete(`/orid-dhall-productions/${productionId}`)
}

export async function fetchOridDhallProduction(productionId) {
  const { data } = await api.get(`/orid-dhall-productions/${productionId}`)
  return data
}

export async function fetchOpenOridDhallBatches() {
  const { data } = await api.get('/orid-dhall-productions/open-batches')
  return data
}

export async function fetchOridDhallPeriodOptions() {
  const { data } = await api.get('/orid-dhall-productions/period-options')
  return data
}

export async function fetchUsedProductionVouchers({
  lineKind,
  excludeProductionId,
} = {}) {
  const { data } = await api.get('/orid-dhall-productions/used-vouchers', {
    params: {
      line_kind: lineKind || undefined,
      exclude_production_id: excludeProductionId || undefined,
    },
  })
  return data
}

export async function searchOridDhallProductions({
  dateFrom,
  dateTo,
  page = 1,
  pageSize = 50,
} = {}) {
  const { data } = await api.get('/orid-dhall-productions', {
    params: {
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
      page,
      page_size: pageSize,
    },
  })
  return data
}
