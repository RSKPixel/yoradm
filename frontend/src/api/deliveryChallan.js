import api from './client'

export async function createDeliveryChallan(payload) {
  const { data } = await api.post('/delivery-challans', payload)
  return data
}

export async function updateDeliveryChallan(challanId, payload) {
  const { data } = await api.put(`/delivery-challans/${challanId}`, payload)
  return data
}

export async function deleteDeliveryChallan(challanId) {
  await api.delete(`/delivery-challans/${challanId}`)
}

export async function fetchUsedInvoiceNos(excludeChallanId) {
  const { data } = await api.get('/delivery-challans/used-invoices', {
    params: excludeChallanId ? { exclude_challan_id: excludeChallanId } : undefined,
  })
  return data
}

export async function searchDeliveryChallans({
  dateFrom,
  dateTo,
  page = 1,
  pageSize = 50,
} = {}) {
  const { data } = await api.get('/delivery-challans', {
    params: {
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
      page,
      page_size: pageSize,
    },
  })
  return data
}

export async function fetchDeliveryChallan(challanId) {
  const { data } = await api.get(`/delivery-challans/${challanId}`)
  return data
}
