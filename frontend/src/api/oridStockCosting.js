import api from './client'

export async function fetchOridStockCosting() {
  const { data } = await api.get('/orid-stock-costing')
  return data
}

export async function saveOridStockCosting(payload) {
  const { data } = await api.put('/orid-stock-costing', payload)
  return data
}
