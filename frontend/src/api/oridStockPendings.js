import api from './client'

export async function fetchOridStockPendings({ stockGroup } = {}) {
  const { data } = await api.get('/orid-stock-pendings', {
    params: {
      stock_group: stockGroup || undefined,
    },
  })
  return data
}

export async function createOridStockPending(payload) {
  const { data } = await api.post('/orid-stock-pendings', payload)
  return data
}

export async function updateOridStockPending(pendingId, payload) {
  const { data } = await api.patch(`/orid-stock-pendings/${pendingId}`, payload)
  return data
}

export async function deleteOridStockPending(pendingId) {
  await api.delete(`/orid-stock-pendings/${pendingId}`)
}
