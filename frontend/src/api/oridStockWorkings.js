import api from './client'

export async function fetchOridStockWorkings() {
  const { data } = await api.get('/orid-stock-workings')
  return data
}

export async function saveOridStockWorkings(payload) {
  const { data } = await api.put('/orid-stock-workings', payload)
  return data
}
