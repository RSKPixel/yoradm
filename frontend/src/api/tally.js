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
