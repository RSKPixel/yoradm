import api from './client'

export async function fetchSaleInvoices() {
  const { data } = await api.get('/tally/sales/invoices')
  return data
}

export async function fetchSaleInvoiceLines(voucherNo) {
  const { data } = await api.get('/tally/sales/invoice-lines', {
    params: { voucher_no: voucherNo },
  })
  return data
}

export async function fetchLocations() {
  const { data } = await api.get('/tally/locations')
  return data
}

export async function fetchPurchaseLines({ stockItem, stockGroup } = {}) {
  const params = {}
  if (stockItem) params.stock_item = stockItem
  if (stockGroup) params.stock_group = stockGroup
  const { data } = await api.get('/tally/purchases/lines', { params })
  return data
}

export async function fetchReceivableRepresentatives() {
  const { data } = await api.get('/tally/receivables/representatives')
  return data
}

export async function fetchReceivablesAnalysis({ representative, asOf } = {}) {
  const params = {}
  if (representative) params.representative = representative
  if (asOf) params.as_of = asOf
  const { data } = await api.get('/tally/receivables/analysis', { params })
  return data
}
