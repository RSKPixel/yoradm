import api from './client'

export async function createGoodsReceipt(payload) {
  const { data } = await api.post('/goods-receipts', payload)
  return data
}

export async function updateGoodsReceipt(receiptId, payload) {
  const { data } = await api.put(`/goods-receipts/${receiptId}`, payload)
  return data
}

export async function deleteGoodsReceipt(receiptId) {
  await api.delete(`/goods-receipts/${receiptId}`)
}

export async function searchGoodsReceipts({
  dateFrom,
  dateTo,
  vendor,
  invoiceNo,
  page = 1,
  pageSize = 50,
} = {}) {
  const { data } = await api.get('/goods-receipts', {
    params: {
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
      vendor: vendor || undefined,
      invoice_no: invoiceNo || undefined,
      page,
      page_size: pageSize,
    },
  })
  return data
}

export async function fetchGoodsReceipt(receiptId) {
  const { data } = await api.get(`/goods-receipts/${receiptId}`)
  return data
}

export async function fetchGoodsReceiptReceivedBy() {
  const { data } = await api.get('/goods-receipts/received-by')
  return data
}
