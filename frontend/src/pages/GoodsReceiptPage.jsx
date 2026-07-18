import { useEffect, useMemo, useState } from 'react'
import { fetchCompany } from '../api/company'
import {
  createGoodsReceipt,
  deleteGoodsReceipt,
  fetchGoodsReceipt,
  fetchGoodsReceiptReceivedBy,
  updateGoodsReceipt,
} from '../api/goodsReceipt'
import {
  fetchInventoryItems,
  fetchLocations,
  fetchRepresentatives,
  fetchVendorTdsStatus,
  fetchVendors,
} from '../api/tally'
import { PdfPreviewModal } from '../components/common/PdfPreviewModal'
import { ConfirmDeleteModal } from '../components/delivery-challan/ConfirmDeleteModal'
import { FormAutocomplete } from '../components/form/FormAutocomplete'
import { FormattedNumberInput } from '../components/form/FormattedNumberInput'
import { FormField, FormInput, FormSelect } from '../components/form/FormPanel'
import { useFormMessage } from '../components/form/FormMessage'
import { GoodsReceiptSearchModal } from '../components/goods-receipt/GoodsReceiptSearchModal'
import { PrimaryContentLayout } from '../components/layout/PrimaryContentLayout'
import { todayIsoDate } from '../utils/formatDate'
import { getApiErrorMessage, validateGoodsReceiptForm } from '../utils/formValidation'
import { createGoodsReceiptPdfBlob } from '../utils/goodsReceiptPdf'

function parseNum(value) {
  const n = Number.parseFloat(String(value ?? '').replace(/,/g, ''))
  return Number.isFinite(n) ? n : null
}

/** Match all query words anywhere in text (order-independent).
 * Ignores punctuation so "bvk" matches "B.V.K". */
function matchesFullText(text, query) {
  const normalize = (value) =>
    String(value ?? '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()

  const compact = (value) => String(value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')

  const haystack = normalize(text)
  const haystackCompact = compact(text)
  const rawQuery = String(query ?? '').toLowerCase().trim()
  if (!rawQuery) return true

  const tokens = normalize(rawQuery).split(' ').filter(Boolean)
  if (tokens.every((token) => haystack.includes(token))) return true

  // Also match compacted query (e.g. "bvk" → "B.V.K")
  const queryCompact = compact(rawQuery)
  return Boolean(queryCompact) && haystackCompact.includes(queryCompact)
}

function emptyFormState() {
  return {
    receiptDate: todayIsoDate(),
    vendor: '',
    stockItem: '',
    qty: '',
    weight: '',
    invoiceNo: '',
    invoiceDate: '',
    invoiceValue: '',
    invoicedWeight: '',
    tdsApplicable: false,
    tdsValue: '',
    unloadedAt: '',
    broker: '',
    receivedBy: '',
    vehicleNo: '',
    place: '',
    remarks: '',
  }
}

function toIsoDateOrEmpty(value) {
  if (!value) return ''
  return String(value).slice(0, 10)
}

function numToForm(value) {
  if (value == null || value === '') return ''
  return String(value)
}

function snapshotForm(state) {
  return JSON.stringify({
    receiptDate: String(state.receiptDate ?? ''),
    vendor: String(state.vendor ?? '').trim(),
    stockItem: String(state.stockItem ?? '').trim(),
    qty: String(state.qty ?? '').trim(),
    weight: String(state.weight ?? '').trim(),
    invoiceNo: String(state.invoiceNo ?? '').trim(),
    invoiceDate: String(state.invoiceDate ?? ''),
    invoiceValue: String(state.invoiceValue ?? '').trim(),
    invoicedWeight: String(state.invoicedWeight ?? '').trim(),
    tdsApplicable: Boolean(state.tdsApplicable),
    tdsValue: String(state.tdsValue ?? '').trim(),
    unloadedAt: String(state.unloadedAt ?? '').trim(),
    broker: String(state.broker ?? '').trim(),
    receivedBy: String(state.receivedBy ?? '').trim(),
    vehicleNo: String(state.vehicleNo ?? '').trim(),
    place: String(state.place ?? '').trim(),
    remarks: String(state.remarks ?? '').trim(),
  })
}

export function GoodsReceiptPage() {
  const { showErrors, showSuccess, showError } = useFormMessage()

  const [vendors, setVendors] = useState([])
  const [stockItems, setStockItems] = useState([])
  const [locations, setLocations] = useState([])
  const [brokers, setBrokers] = useState([])
  const [receivedByNames, setReceivedByNames] = useState([])
  const [loadingLookups, setLoadingLookups] = useState(true)

  const [form, setForm] = useState(emptyFormState)
  const [savedSnapshot, setSavedSnapshot] = useState(() => snapshotForm(emptyFormState()))
  const [savedReceiptId, setSavedReceiptId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [loadingReceipt, setLoadingReceipt] = useState(false)
  const [printing, setPrinting] = useState(false)
  const [pdfPreview, setPdfPreview] = useState(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [tdsChecking, setTdsChecking] = useState(false)

  const isModifyMode = savedReceiptId != null
  const receiptNo = savedReceiptId != null ? String(savedReceiptId) : ''
  const isDirty = useMemo(
    () => snapshotForm(form) !== savedSnapshot,
    [form, savedSnapshot],
  )

  const vendorOptions = useMemo(() => {
    const list = [...vendors]
    const current = form.vendor.trim()
    if (current && !list.some((row) => row.ledger_name === current)) {
      list.unshift({ ledger_name: current, primary_group: null })
    }
    return list
  }, [vendors, form.vendor])

  const stockItemOptions = useMemo(() => {
    const list = [...stockItems]
    const current = form.stockItem.trim()
    if (current && !list.some((row) => row.stock_item === current)) {
      list.unshift({ stock_item: current, stock_group: null, packing: null })
    }
    return list
  }, [stockItems, form.stockItem])

  const brokerOptions = useMemo(() => {
    const names = [...brokers]
    const current = form.broker.trim()
    if (current && !names.includes(current)) {
      names.unshift(current)
    }
    return names.map((name) => ({ name }))
  }, [brokers, form.broker])

  const receivedByOptions = useMemo(() => {
    const names = [...receivedByNames]
    const current = form.receivedBy.trim()
    if (current && !names.includes(current)) {
      names.unshift(current)
    }
    return names.map((name) => ({ name }))
  }, [receivedByNames, form.receivedBy])

  const locationOptions = useMemo(() => {
    const names = [...locations]
    const current = form.unloadedAt.trim()
    if (current && !names.includes(current)) {
      names.unshift(current)
    }
    return names
  }, [locations, form.unloadedAt])

  const weightDiff = useMemo(() => {
    const weight = parseNum(form.weight)
    const invoiced = parseNum(form.invoicedWeight)
    if (weight == null || invoiced == null) return null
    return weight - invoiced
  }, [form.weight, form.invoicedWeight])

  const weightDiffOk = weightDiff == null || weightDiff >= 0

  useEffect(() => {
    let cancelled = false

    async function loadLookups() {
      setLoadingLookups(true)
      try {
        const [vendorRows, itemRows, locationRows, brokerRows, receivedByRows] =
          await Promise.all([
            fetchVendors(),
            fetchInventoryItems(),
            fetchLocations(),
            fetchRepresentatives(),
            fetchGoodsReceiptReceivedBy(),
          ])
        if (cancelled) return
        setVendors(vendorRows.filter((row) => row.ledger_name))
        setStockItems(itemRows.filter((row) => row.stock_item))
        const locationNames = locationRows.map((row) => row.name).filter(Boolean)
        setLocations(locationNames)
        setBrokers(brokerRows.map((row) => row.name).filter(Boolean))
        setReceivedByNames(
          (Array.isArray(receivedByRows) ? receivedByRows : [])
            .map((name) => String(name || '').trim())
            .filter(Boolean),
        )
        setForm((prev) => ({
          ...prev,
          unloadedAt: prev.unloadedAt || locationNames[0] || '',
        }))
      } catch (error) {
        if (!cancelled) {
          showError(getApiErrorMessage(error, 'Failed to load lookup data'))
        }
      } finally {
        if (!cancelled) setLoadingLookups(false)
      }
    }

    void loadLookups()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once on mount
  }, [])

  useEffect(() => {
    const vendor = form.vendor.trim()
    const invoiceValue = parseNum(form.invoiceValue) ?? 0
    const asOf = form.receiptDate || todayIsoDate()

    if (!vendor || invoiceValue <= 0) {
      setForm((prev) =>
        prev.tdsApplicable || prev.tdsValue
          ? { ...prev, tdsApplicable: false, tdsValue: '' }
          : prev,
      )
      setTdsChecking(false)
      return undefined
    }

    let cancelled = false
    const timer = window.setTimeout(() => {
      setTdsChecking(true)
      void fetchVendorTdsStatus({
        ledgerName: vendor,
        invoiceValue,
        asOf,
      })
        .then((status) => {
          if (cancelled) return
          setForm((prev) => ({
            ...prev,
            tdsApplicable: Boolean(status.tds_applicable),
            tdsValue: status.tds_applicable ? numToForm(status.tds_value) : '',
          }))
        })
        .catch(() => {
          if (cancelled) return
          setForm((prev) => ({ ...prev, tdsApplicable: false, tdsValue: '' }))
        })
        .finally(() => {
          if (!cancelled) setTdsChecking(false)
        })
    }, 300)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [form.vendor, form.invoiceValue, form.receiptDate])

  function setField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function resetForm() {
    setSavedReceiptId(null)
    const next = {
      ...emptyFormState(),
      unloadedAt: locations[0] || '',
    }
    setForm(next)
    setSavedSnapshot(snapshotForm(next))
  }

  function onFormKeyDown(event) {
    if (event.key === 'Enter') {
      event.preventDefault()
    }
  }

  async function onSave(event) {
    event.preventDefault()
    const errors = validateGoodsReceiptForm(form)
    if (errors.length) {
      showErrors(errors)
      return
    }

    const payload = {
      receipt_date: form.receiptDate,
      vendor: form.vendor.trim(),
      stock_item: form.stockItem.trim(),
      qty: parseNum(form.qty),
      weight: parseNum(form.weight),
      invoice_no: form.invoiceNo.trim(),
      invoice_date: form.invoiceDate || null,
      invoice_value: parseNum(form.invoiceValue),
      invoiced_weight: parseNum(form.invoicedWeight),
      tds_applicable: Boolean(form.tdsApplicable),
      tds_value: form.tdsApplicable ? parseNum(form.tdsValue) : null,
      unloaded_at: form.unloadedAt.trim(),
      broker: form.broker.trim() || null,
      received_by: form.receivedBy.trim() || null,
      vehicle_no: form.vehicleNo.trim() || null,
      place: form.place.trim() || null,
      remarks: form.remarks.trim() || null,
    }

    setSaving(true)
    try {
      if (isModifyMode) {
        const updated = await updateGoodsReceipt(savedReceiptId, payload)
        setSavedReceiptId(updated.id)
        showSuccess(`Updated goods receipt ${updated.id}.`)
      } else {
        const created = await createGoodsReceipt(payload)
        setSavedReceiptId(created.id)
        showSuccess(`Saved goods receipt ${created.id}.`)
      }
      setSavedSnapshot(snapshotForm(form))
      const received = form.receivedBy.trim()
      if (received) {
        setReceivedByNames((prev) =>
          prev.includes(received) ? prev : [...prev, received].sort((a, b) => a.localeCompare(b)),
        )
      }
    } catch (error) {
      showError(getApiErrorMessage(error, 'Could not save goods receipt'))
    } finally {
      setSaving(false)
    }
  }

  async function onSelectReceipt(id) {
    setSearchOpen(false)
    setLoadingReceipt(true)
    try {
      const receipt = await fetchGoodsReceipt(id)
      setSavedReceiptId(receipt.id)
      const nextForm = {
        receiptDate: toIsoDateOrEmpty(receipt.receipt_date) || todayIsoDate(),
        vendor: receipt.vendor ?? '',
        stockItem: receipt.stock_item ?? '',
        qty: numToForm(receipt.qty),
        weight: numToForm(receipt.weight),
        invoiceNo: receipt.invoice_no ?? '',
        invoiceDate: toIsoDateOrEmpty(receipt.invoice_date),
        invoiceValue: numToForm(receipt.invoice_value),
        invoicedWeight: numToForm(receipt.invoiced_weight),
        tdsApplicable: Boolean(receipt.tds_applicable),
        tdsValue: numToForm(receipt.tds_value),
        unloadedAt: receipt.unloaded_at ?? locations[0] ?? '',
        broker: receipt.broker ?? '',
        receivedBy: receipt.received_by ?? '',
        vehicleNo: receipt.vehicle_no ?? '',
        place: receipt.place ?? '',
        remarks: receipt.remarks ?? '',
      }
      setForm(nextForm)
      setSavedSnapshot(snapshotForm(nextForm))
      showSuccess(`Loaded goods receipt ${receipt.id}.`)
    } catch (error) {
      showError(getApiErrorMessage(error, 'Could not load goods receipt'))
    } finally {
      setLoadingReceipt(false)
    }
  }

  function onDelete() {
    if (!isModifyMode) return
    setDeleteConfirmOpen(true)
  }

  async function confirmDelete() {
    if (!isModifyMode) return
    setDeleting(true)
    try {
      await deleteGoodsReceipt(savedReceiptId)
      setDeleteConfirmOpen(false)
      resetForm()
      showSuccess('Goods receipt deleted.')
    } catch (error) {
      showError(getApiErrorMessage(error, 'Could not delete goods receipt'))
    } finally {
      setDeleting(false)
    }
  }

  function closePdfPreview() {
    setPdfPreview((current) => {
      if (current?.url) URL.revokeObjectURL(current.url)
      return null
    })
  }

  async function onPrint() {
    if (!isModifyMode || printing) return
    closePdfPreview()
    setPrinting(true)
    try {
      const company = await fetchCompany()
      const { blob, fileName } = await createGoodsReceiptPdfBlob({
        company,
        receiptNo,
        receiptDate: form.receiptDate,
        vendor: form.vendor,
        stockItem: form.stockItem,
        qty: parseNum(form.qty),
        weight: parseNum(form.weight),
        invoiceNo: form.invoiceNo,
        invoiceDate: form.invoiceDate,
        invoiceValue: parseNum(form.invoiceValue),
        invoicedWeight: parseNum(form.invoicedWeight),
        weightDiff,
        tdsApplicable: form.tdsApplicable,
        tdsValue: parseNum(form.tdsValue),
        unloadedAt: form.unloadedAt,
        broker: form.broker,
        receivedBy: form.receivedBy,
        vehicleNo: form.vehicleNo,
        place: form.place,
        remarks: form.remarks,
      })
      const url = URL.createObjectURL(blob)
      setPdfPreview({ url, fileName })
    } catch (error) {
      closePdfPreview()
      showError(getApiErrorMessage(error, error?.message || 'Could not generate PDF'))
    } finally {
      setPrinting(false)
    }
  }

  function onDownloadPdf() {
    if (!pdfPreview?.url || !pdfPreview?.fileName) return
    const link = document.createElement('a')
    link.href = pdfPreview.url
    link.download = pdfPreview.fileName
    link.click()
  }

  const weightDiffDisplay =
    weightDiff == null
      ? ''
      : Math.round(weightDiff).toLocaleString(undefined, { maximumFractionDigits: 0 })

  return (
    <div className="flex h-full min-h-0 max-w-full flex-col">
      {searchOpen ? (
        <GoodsReceiptSearchModal
          onClose={() => setSearchOpen(false)}
          onSelect={(id) => void onSelectReceipt(id)}
        />
      ) : null}
      {deleteConfirmOpen ? (
        <ConfirmDeleteModal
          title="Delete goods receipt"
          message="Delete this goods receipt permanently? This cannot be undone."
          confirming={deleting}
          onCancel={() => {
            if (!deleting) setDeleteConfirmOpen(false)
          }}
          onConfirm={() => void confirmDelete()}
        />
      ) : null}
      <PdfPreviewModal
        open={Boolean(pdfPreview?.url)}
        title="Goods Receipt"
        fileName={pdfPreview?.fileName}
        pdfUrl={pdfPreview?.url}
        onClose={closePdfPreview}
        onDownload={onDownloadPdf}
      />

      <PrimaryContentLayout
        title={isModifyMode ? `Goods Receipt — ${receiptNo}` : 'Goods Receipt — New'}
        breadcrumb={[
          { label: 'Transactions' },
          { label: isModifyMode ? `Goods Receipt — ${receiptNo}` : 'Goods Receipt — New' },
        ]}
        onSubmit={onSave}
        onKeyDown={onFormKeyDown}
        footer={
          <>
            <button
              type="button"
              className="win-form__button"
              onClick={() => setSearchOpen(true)}
              disabled={saving || deleting || loadingReceipt || printing}
            >
              Search
            </button>
            <span className="win-form__footer-divider" aria-hidden="true" />
            <button
              type="button"
              className="win-form__button win-form__button--danger"
              onClick={() => void onDelete()}
              disabled={!isModifyMode || saving || deleting || loadingReceipt || printing}
            >
              Delete
            </button>
            <button
              type="button"
              className="win-form__button"
              onClick={() => void onPrint()}
              disabled={!isModifyMode || saving || deleting || loadingReceipt || printing}
            >
              Print
            </button>
            <button
              type="button"
              className="win-form__button"
              onClick={resetForm}
              disabled={saving || deleting || loadingReceipt || printing}
            >
              New
            </button>
            <button
              type="submit"
              className="win-form__button win-form__button--primary"
              disabled={
                saving ||
                deleting ||
                loadingReceipt ||
                printing ||
                (isModifyMode && !isDirty)
              }
            >
              {saving ? 'Saving…' : isModifyMode ? 'Update' : 'Save'}
            </button>
          </>
        }
      >
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          <div className="gr-form mx-auto w-full max-w-[60%] shrink-0">
            <div className="grid grid-cols-1 gap-x-4 gap-y-3.5 sm:grid-cols-2 lg:grid-cols-6">
            <FormField label="Receipt No." className="lg:col-span-2">
              <FormInput
                readOnly
                value={isModifyMode ? receiptNo : 'New'}
                title={isModifyMode ? receiptNo : 'New'}
              />
            </FormField>
            <FormField label="Receipt Date" className="lg:col-span-2">
              <FormInput
                required
                type="date"
                value={form.receiptDate}
                onChange={(e) => setField('receiptDate', e.target.value)}
              />
            </FormField>
            <FormField label="Unloaded At" className="lg:col-span-2">
              <FormSelect
                required
                value={form.unloadedAt}
                onChange={(e) => setField('unloadedAt', e.target.value)}
                disabled={loadingLookups}
              >
                {locationOptions.length === 0 ? <option value="">No locations</option> : null}
                {locationOptions.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </FormSelect>
            </FormField>
            <FormField label="Vendor" className="lg:col-span-3">
              <FormAutocomplete
                options={vendorOptions}
                value={form.vendor}
                onChange={(value) => setField('vendor', value)}
                getOptionValue={(row) => row.ledger_name}
                getOptionLabel={(row) => row.ledger_name}
                filterOption={(row, query) => matchesFullText(row.ledger_name, query)}
                disabled={loadingLookups}
                emptyMessage={loadingLookups ? 'Loading vendors…' : 'No matching vendors'}
              />
            </FormField>
            <FormField label="Stock Item" className="lg:col-span-3">
              <FormAutocomplete
                options={stockItemOptions}
                value={form.stockItem}
                onChange={(value) => setField('stockItem', value)}
                getOptionValue={(row) => row.stock_item}
                getOptionLabel={(row) => row.stock_item}
                filterOption={(row, query) => matchesFullText(row.stock_item, query)}
                disabled={loadingLookups}
                emptyMessage={loadingLookups ? 'Loading items…' : 'No matching stock items'}
              />
            </FormField>
            <FormField label="Qty" className="lg:col-span-2">
              <FormattedNumberInput
                required
                value={form.qty}
                onChange={(value) => setField('qty', value)}
                fractionDigits={0}
                selectOnFocus
              />
            </FormField>
            <FormField label="Weight" className="lg:col-span-2">
              <FormattedNumberInput
                required
                value={form.weight}
                onChange={(value) => setField('weight', value)}
                fractionDigits={0}
                selectOnFocus
              />
            </FormField>
            <FormField label="Invoiced Weight" className="lg:col-span-2">
              <FormattedNumberInput
                value={form.invoicedWeight}
                onChange={(value) => setField('invoicedWeight', value)}
                fractionDigits={0}
                selectOnFocus
              />
            </FormField>
            <FormField label="Invoice No." className="lg:col-span-2">
              <FormInput
                required
                value={form.invoiceNo}
                onChange={(e) => setField('invoiceNo', e.target.value)}
              />
            </FormField>
            <FormField label="Invoice Date" className="lg:col-span-2">
              <FormInput
                type="date"
                value={form.invoiceDate}
                onChange={(e) => setField('invoiceDate', e.target.value)}
              />
            </FormField>
            <FormField label="Invoice Value" className="lg:col-span-2">
              <FormattedNumberInput
                value={form.invoiceValue}
                onChange={(value) => setField('invoiceValue', value)}
                fractionDigits={2}
                selectOnFocus
              />
            </FormField>
            <FormField label="Weight Diff" className="lg:col-span-2">
              <FormInput
                readOnly
                value={weightDiffDisplay}
                className={`win-form__control--num${weightDiffOk ? '' : ' win-form__control--warn'}`}
                title={
                  weightDiff == null
                    ? ''
                    : weightDiffOk
                      ? 'Excess / equal — OK'
                      : 'Shortfall — received weight less than invoiced'
                }
              />
            </FormField>
            <FormField label="TDS Applicable?" className="lg:col-span-2">
              <FormInput
                readOnly
                value={tdsChecking ? 'Checking…' : form.tdsApplicable ? 'Yes' : 'No'}
                title={
                  form.tdsApplicable
                    ? 'Vendor FY purchases + invoice value meet the TDS threshold'
                    : 'Below TDS threshold (or TDS settings not configured)'
                }
              />
            </FormField>
            <FormField label="TDS Value" className="lg:col-span-2">
              <FormattedNumberInput
                value={form.tdsValue}
                onChange={() => {}}
                fractionDigits={2}
                readOnly
                disabled={!form.tdsApplicable}
              />
            </FormField>
            <FormField label="Broker" className="lg:col-span-2">
              <FormAutocomplete
                options={brokerOptions}
                value={form.broker}
                onChange={(value) => setField('broker', value)}
                getOptionValue={(row) => row.name}
                getOptionLabel={(row) => row.name}
                filterOption={(row, query) => matchesFullText(row.name, query)}
                disabled={loadingLookups}
                emptyMessage={loadingLookups ? 'Loading brokers…' : 'No matching brokers'}
              />
            </FormField>
            <FormField label="Received By" className="lg:col-span-2">
              <FormAutocomplete
                options={receivedByOptions}
                value={form.receivedBy}
                onChange={(value) => setField('receivedBy', value)}
                getOptionValue={(row) => row.name}
                getOptionLabel={(row) => row.name}
                filterOption={(row, query) => matchesFullText(row.name, query)}
                allowCustom
                disabled={loadingLookups}
                emptyMessage={
                  loadingLookups ? 'Loading…' : 'No matches — type a name and press Enter'
                }
              />
            </FormField>
            <FormField label="Vehicle No." className="lg:col-span-2">
              <FormInput
                value={form.vehicleNo}
                onChange={(e) => setField('vehicleNo', e.target.value)}
              />
            </FormField>
            <FormField label="Place" className="lg:col-span-2">
              <FormInput
                value={form.place}
                onChange={(e) => setField('place', e.target.value)}
              />
            </FormField>
            <FormField label="Remarks" className="lg:col-span-4">
              <FormInput
                value={form.remarks}
                onChange={(e) => setField('remarks', e.target.value)}
              />
            </FormField>
            </div>
          </div>
        </div>
      </PrimaryContentLayout>
    </div>
  )
}
