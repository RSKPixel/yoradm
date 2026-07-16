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

export async function fetchPendingDeliveriesByStockGroup() {
  const { data } = await api.get('/delivery-challans/pending-by-stock-group')
  return data
}

export async function fetchTodayDeliveriesByStockGroup({
  onDate,
  dateFrom,
  dateTo,
} = {}) {
  const { data } = await api.get('/delivery-challans/today-by-stock-group', {
    params: {
      on_date: onDate || undefined,
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
    },
  })
  return data
}

export async function fetchDeliveryQtyByBatch({
  batchNo,
  stockGroup = 'Orid Dhall',
} = {}) {
  const { data } = await api.get('/delivery-challans/qty-by-batch', {
    params: {
      batch_no: batchNo,
      stock_group: stockGroup || undefined,
    },
  })
  return data
}

export async function fetchDeliveryQtyByBatchDates({
  batchNo,
  stockGroup = 'Orid Dhall',
} = {}) {
  const { data } = await api.get('/delivery-challans/qty-by-batch-dates', {
    params: {
      batch_no: batchNo,
      stock_group: stockGroup || undefined,
    },
  })
  return data
}

export async function searchDeliveryChallans({
  dateFrom,
  dateTo,
  batchNo,
  page = 1,
  pageSize = 50,
} = {}) {
  const { data } = await api.get('/delivery-challans', {
    params: {
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
      batch_no: batchNo || undefined,
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
