import api from './client'

export async function fetchDaybookAvailability() {
  const { data } = await api.get('/tally/daybook/availability')
  return data
}

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

export async function fetchRepresentatives() {
  const { data } = await api.get('/tally/representatives')
  return data
}

export async function fetchVendors() {
  const { data } = await api.get('/tally/vendors')
  return data
}

export async function fetchReceivableParties() {
  const { data } = await api.get('/tally/receivables/parties')
  return data
}

export async function fetchPartyPendingBills(party, { excludeChequeId } = {}) {
  const { data } = await api.get('/tally/receivables/pending-bills', {
    params: {
      party,
      exclude_cheque_id: excludeChequeId || undefined,
    },
  })
  return data
}

export async function fetchVendorTdsStatus({ ledgerName, invoiceValue, asOf } = {}) {
  const { data } = await api.get('/tally/vendors/tds-status', {
    params: {
      ledger_name: ledgerName,
      invoice_value: invoiceValue ?? 0,
      as_of: asOf || undefined,
    },
  })
  return data
}

export async function fetchTdsWorkings({ dateFrom, dateTo, q } = {}) {
  const { data } = await api.get('/tally/tds-workings', {
    params: {
      date_from: dateFrom,
      date_to: dateTo,
      q: q || undefined,
    },
  })
  return data
}

export async function saveTdsWorkings({ dateFrom, dateTo } = {}) {
  const { data } = await api.post('/tally/tds-workings/save', null, {
    params: {
      date_from: dateFrom,
      date_to: dateTo,
    },
  })
  return data
}

export async function updateTdsWorkings({ dateFrom, dateTo } = {}) {
  const { data } = await api.post('/tally/tds-workings/update', null, {
    params: {
      date_from: dateFrom,
      date_to: dateTo,
    },
  })
  return data
}

export async function fetchTdsExpenseMatch(sourceId) {
  const { data } = await api.get('/tally/tds-workings/expense-match', {
    params: { source_id: sourceId },
  })
  return data
}

export async function applyTdsExpenseMatch({
  sourceId,
  expensesDate,
  expensesAmount,
  expenseSourceId,
  dateFrom,
  dateTo,
}) {
  const { data } = await api.post('/tally/tds-workings/expense-match/apply', {
    source_id: sourceId,
    expenses_date: expensesDate ?? undefined,
    expenses_amount: expensesAmount ?? undefined,
    expense_source_id: expenseSourceId ?? undefined,
    date_from: dateFrom ?? undefined,
    date_to: dateTo ?? undefined,
  })
  return data
}

export async function fetchTdsHeadPayments({ fyStart, month } = {}) {
  const { data } = await api.get('/tally/tds-workings/payments', {
    params: {
      fy_start: fyStart,
      month,
    },
  })
  return data
}

export async function updateTdsHeadPaymentDate({ fyStart, month, tdsHead, paymentDate } = {}) {
  const { data } = await api.patch('/tally/tds-workings/payments/payment-date', {
    fy_start: fyStart,
    month,
    tds_head: tdsHead,
    payment_date: paymentDate || null,
  })
  return data
}

export async function uploadTdsHeadPaymentPdf({ fyStart, month, tdsHead, file } = {}) {
  const form = new FormData()
  form.append('fy_start', String(fyStart))
  form.append('month', String(month))
  form.append('tds_head', tdsHead)
  form.append('file', file)
  const { data } = await api.post('/tally/tds-workings/payments/pdf', form)
  return data
}

export async function fetchTdsHeadPaymentPdfBlob({ fyStart, month, tdsHead } = {}) {
  const { data } = await api.get('/tally/tds-workings/payments/pdf', {
    params: {
      fy_start: fyStart,
      month,
      tds_head: tdsHead,
    },
    responseType: 'blob',
  })
  return data
}

export async function deleteTdsHeadPaymentPdf({ fyStart, month, tdsHead } = {}) {
  const { data } = await api.delete('/tally/tds-workings/payments/pdf', {
    params: {
      fy_start: fyStart,
      month,
      tds_head: tdsHead,
    },
  })
  return data
}

export async function fetchInventoryItems() {
  const { data } = await api.get('/tally/inventory-items')
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

export async function fetchSaleRepresentatives() {
  const { data } = await api.get('/tally/sales/representatives')
  return data
}

export async function fetchReceivablesAnalysis({ representative, asOf } = {}) {
  const params = {}
  if (representative) params.representative = representative
  if (asOf) params.as_of = asOf
  const { data } = await api.get('/tally/receivables/analysis', { params })
  return data
}

export async function fetchSalesPurchaseTrend({ dateFrom, dateTo } = {}) {
  const { data } = await api.get('/tally/daybook/sales-purchase', {
    params: {
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
    },
  })
  return data
}

export async function fetchCollectionPerformance({
  dateFrom,
  dateTo,
  representative,
} = {}) {
  const { data } = await api.get('/tally/daybook/collection-performance', {
    params: {
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
      representative: representative || undefined,
    },
  })
  return data
}

export async function fetchStockAnalysisSales({ asOf, convertOridRaw } = {}) {
  const { data } = await api.get('/tally/stock-analysis/sales', {
    params: {
      as_of: asOf || undefined,
      convert_orid_raw: convertOridRaw ? true : undefined,
    },
  })
  return data
}

export async function fetchCollectionAnalysis({
  asOf,
  period,
  representative,
  days,
} = {}) {
  const { data } = await api.get('/tally/collection-analysis', {
    params: {
      as_of: asOf || undefined,
      period: period || undefined,
      representative: representative || undefined,
      days: days || undefined,
    },
  })
  return data
}

export async function updateCollectionPerformance({ dateFrom, dateTo } = {}) {
  const { data } = await api.post('/tally/collection-analysis/update-performance', null, {
    params: {
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
    },
  })
  return data
}
