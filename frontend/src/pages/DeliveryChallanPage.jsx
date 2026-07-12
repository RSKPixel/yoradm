import { TrashIcon } from '@heroicons/react/24/outline'
import { useEffect, useMemo, useRef, useState } from 'react'
import { fetchCompany } from '../api/company'
import {
  createDeliveryChallan,
  deleteDeliveryChallan,
  fetchDeliveryChallan,
  fetchUsedInvoiceNos,
  updateDeliveryChallan,
} from '../api/deliveryChallan'
import { fetchLocations, fetchSaleInvoiceLines, fetchSaleInvoices } from '../api/tally'
import { PdfPreviewModal } from '../components/common/PdfPreviewModal'
import { ConfirmDeleteModal } from '../components/delivery-challan/ConfirmDeleteModal'
import { DeliveryChallanSearchModal } from '../components/delivery-challan/DeliveryChallanSearchModal'
import { DeliveryChallanSummaryModal } from '../components/delivery-challan/DeliveryChallanSummaryModal'
import { FormAutocomplete } from '../components/form/FormAutocomplete'
import { FormField, FormInput, FormPanel, FormSelect } from '../components/form/FormPanel'
import { useFormMessage } from '../components/form/FormMessage'
import { createDeliveryChallanPdfBlob } from '../utils/deliveryChallanPdf'
import { formatDate, toIsoDateInput, todayIsoDate } from '../utils/formatDate'
import { getApiErrorMessage, validateDeliveryChallanForm } from '../utils/formValidation'

function invoiceOptionLabel(inv) {
  return `${inv.voucher_no} — ${inv.ledger_name ?? ''} — ${formatDate(inv.voucher_date)}`
}

function renderInvoiceOption(inv) {
  return (
    <div className="win-form__autocomplete-option-body">
      <span className="win-form__autocomplete-v">{inv.voucher_no}</span>
      <span className="win-form__autocomplete-v win-form__autocomplete-v--muted">
        {formatDate(inv.voucher_date)}
      </span>
      <span className="win-form__autocomplete-v">{inv.ledger_name ?? ''}</span>
    </div>
  )
}

function filterInvoiceOption(inv, query) {
  const haystack = [
    inv.voucher_no,
    inv.ledger_name,
    formatDate(inv.voucher_date),
    String(inv.voucher_date ?? '').slice(0, 10),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  return haystack.includes(query)
}

function lineKey(line) {
  return `${line.voucher_no}::${line.stock_item}::${line.brand}`
}

function invoiceGroupSpan(lines, startIndex) {
  const voucherNo = lines[startIndex].voucher_no
  let span = 1
  while (
    startIndex + span < lines.length &&
    lines[startIndex + span].voucher_no === voucherNo
  ) {
    span += 1
  }
  return span
}

let lineIdSeq = 0
function nextLineId() {
  lineIdSeq += 1
  return `dc-line-${lineIdSeq}`
}

export function DeliveryChallanPage() {
  const { showErrors, showSuccess, showError } = useFormMessage()
  const invoiceInputRef = useRef(null)
  const highlightTimerRef = useRef(null)
  const tableWrapRef = useRef(null)

  const [invoiceOptions, setInvoiceOptions] = useState([])
  const [usedInvoiceNos, setUsedInvoiceNos] = useState([])
  const [locations, setLocations] = useState([])
  const [loadingLookups, setLoadingLookups] = useState(true)
  const [addingInvoice, setAddingInvoice] = useState(false)
  const [focusInvoiceAfterAdd, setFocusInvoiceAfterAdd] = useState(false)

  const [date, setDate] = useState(todayIsoDate)
  const [vehicleNo, setVehicleNo] = useState('')
  const [driverName, setDriverName] = useState('')
  const [batchNo, setBatchNo] = useState('')
  const [selectedInvoice, setSelectedInvoice] = useState('')
  const [lines, setLines] = useState([])
  const [highlightedLineIds, setHighlightedLineIds] = useState(() => new Set())
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [printing, setPrinting] = useState(false)
  const [loadingChallan, setLoadingChallan] = useState(false)
  const [pdfPreview, setPdfPreview] = useState(null)
  const [savedChallanId, setSavedChallanId] = useState(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [summaryOpen, setSummaryOpen] = useState(false)

  const defaultLocation = locations[0] ?? ''
  const isModifyMode = savedChallanId != null
  const challanNo = savedChallanId != null ? String(savedChallanId) : ''
  const availableInvoiceOptions = useMemo(() => {
    const blocked = new Set(usedInvoiceNos)
    for (const line of lines) {
      if (line.voucher_no) blocked.add(line.voucher_no)
    }
    return invoiceOptions.filter((inv) => !blocked.has(inv.voucher_no))
  }, [invoiceOptions, usedInvoiceNos, lines])

  async function loadUsedInvoices(excludeChallanId = savedChallanId) {
    const used = await fetchUsedInvoiceNos(excludeChallanId || undefined)
    setUsedInvoiceNos(used)
    return used
  }

  useEffect(() => {
    let cancelled = false

    async function loadLookups() {
      setLoadingLookups(true)
      try {
        const [invoices, locationRows, used] = await Promise.all([
          fetchSaleInvoices(),
          fetchLocations(),
          fetchUsedInvoiceNos(),
        ])
        if (cancelled) return
        setInvoiceOptions(invoices)
        setLocations(locationRows.map((row) => row.name).filter(Boolean))
        setUsedInvoiceNos(used)
      } catch (error) {
        if (!cancelled) {
          showError(getApiErrorMessage(error, 'Failed to load invoice and location data'))
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
    let cancelled = false
    async function refreshUsed() {
      try {
        const used = await fetchUsedInvoiceNos(savedChallanId || undefined)
        if (!cancelled) setUsedInvoiceNos(used)
      } catch {
        // Keep previous used list if refresh fails.
      }
    }
    void refreshUsed()
    return () => {
      cancelled = true
    }
  }, [savedChallanId])

  useEffect(() => {
    if (!focusInvoiceAfterAdd || addingInvoice || loadingLookups) return
    setFocusInvoiceAfterAdd(false)
    invoiceInputRef.current?.focus()
  }, [focusInvoiceAfterAdd, addingInvoice, loadingLookups])

  useEffect(() => {
    return () => {
      if (highlightTimerRef.current) window.clearTimeout(highlightTimerRef.current)
    }
  }, [])

  function resetForm() {
    setDate(todayIsoDate())
    setVehicleNo('')
    setDriverName('')
    setBatchNo('')
    setSelectedInvoice('')
    setLines([])
    setHighlightedLineIds(new Set())
    setSavedChallanId(null)
    setFocusInvoiceAfterAdd(true)
  }

  function buildPayload() {
    return {
      challan_date: date,
      vehicle_no: vehicleNo.trim(),
      driver_name: driverName.trim(),
      batch_no: batchNo.trim() || null,
      lines: lines.map((line) => ({
        voucher_no: line.voucher_no,
        voucher_date: line.voucher_date || null,
        ledger_name: line.ledger_name || null,
        stock_item: line.stock_item || null,
        brand: line.brand || null,
        packing: line.packing ?? null,
        qty: line.qty ?? null,
        delivery_location: line.deliveryLocation,
      })),
    }
  }

  async function onAddInvoice(voucherNo = selectedInvoice) {
    if (!voucherNo) {
      showError('Select an invoice no. first.')
      return
    }
    if (!defaultLocation) {
      showError('No delivery locations available.')
      return
    }
    if (addingInvoice) return

    if (usedInvoiceNos.includes(voucherNo) || lines.some((line) => line.voucher_no === voucherNo)) {
      showError('This invoice is already on a delivery challan.')
      return
    }

    setAddingInvoice(true)
    let didAdd = false
    try {
      const invoiceLines = await fetchSaleInvoiceLines(voucherNo)
      if (!invoiceLines.length) {
        showError('No stock items found for that invoice.')
        return
      }

      const existing = new Set(lines.map(lineKey))
      const toAdd = invoiceLines
        .filter((line) => !existing.has(lineKey(line)))
        .map((line) => ({
          id: nextLineId(),
          voucher_no: line.voucher_no,
          voucher_date: formatDate(line.voucher_date),
          ledger_name: line.ledger_name,
          stock_item: line.stock_item,
          brand: line.brand,
          packing: line.packing ?? null,
          qty: line.qty,
          deliveryLocation: defaultLocation,
        }))

      if (!toAdd.length) {
        showError('Those invoice items are already on the list.')
        return
      }

      setLines((prev) => [...toAdd, ...prev])
      setSelectedInvoice('')
      didAdd = true

      const addedIds = new Set(toAdd.map((line) => line.id))
      setHighlightedLineIds(addedIds)
      if (highlightTimerRef.current) window.clearTimeout(highlightTimerRef.current)
      highlightTimerRef.current = window.setTimeout(() => {
        setHighlightedLineIds(new Set())
        highlightTimerRef.current = null
      }, 1000)
      if (tableWrapRef.current) tableWrapRef.current.scrollTop = 0

      showSuccess(
        `Added ${toAdd.length} item${toAdd.length === 1 ? '' : 's'} from ${voucherNo}.`,
      )
    } catch (error) {
      showError(getApiErrorMessage(error, 'Could not load invoice items'))
    } finally {
      setAddingInvoice(false)
      if (didAdd) setFocusInvoiceAfterAdd(true)
    }
  }

  function onFormKeyDown(e) {
    if (e.key !== 'Enter') return
    // Save is click-only; Enter is reserved for invoice autocomplete confirm.
    e.preventDefault()
  }

  function onLocationChange(lineId, value) {
    setLines((prev) =>
      prev.map((line) => (line.id === lineId ? { ...line, deliveryLocation: value } : line)),
    )
  }

  function onRemoveInvoice(voucherNo) {
    setLines((prev) => prev.filter((line) => line.voucher_no !== voucherNo))
  }

  async function onSave(e) {
    e.preventDefault()

    const validationErrors = validateDeliveryChallanForm({
      date,
      vehicleNo,
      driverName,
      lines,
    })
    if (validationErrors.length) {
      showErrors(validationErrors)
      return
    }

    setSaving(true)
    try {
      const payload = buildPayload()
      if (isModifyMode) {
        await updateDeliveryChallan(savedChallanId, payload)
        await loadUsedInvoices(savedChallanId)
        showSuccess('Delivery challan updated.')
      } else {
        const saved = await createDeliveryChallan(payload)
        setSavedChallanId(saved.id)
        await loadUsedInvoices(saved.id)
        showSuccess('Delivery challan saved.')
      }
    } catch (error) {
      showError(getApiErrorMessage(error, 'Could not save delivery challan'))
    } finally {
      setSaving(false)
    }
  }

  async function onDelete() {
    if (!isModifyMode) return
    setDeleteConfirmOpen(true)
  }

  async function confirmDelete() {
    if (!isModifyMode) return

    setDeleting(true)
    try {
      await deleteDeliveryChallan(savedChallanId)
      showSuccess('Delivery challan deleted.')
      setDeleteConfirmOpen(false)
      resetForm()
      await loadUsedInvoices(null)
    } catch (error) {
      showError(getApiErrorMessage(error, 'Could not delete delivery challan'))
    } finally {
      setDeleting(false)
    }
  }

  function applyChallan(challan) {
    setSavedChallanId(challan.id)
    setDate(toIsoDateInput(challan.challan_date) || todayIsoDate())
    setVehicleNo(challan.vehicle_no ?? '')
    setDriverName(challan.driver_name ?? '')
    setBatchNo(challan.batch_no ?? '')
    setSelectedInvoice('')
    setLines(
      (challan.details ?? []).map((line) => ({
        id: nextLineId(),
        voucher_no: line.voucher_no,
        voucher_date: formatDate(line.voucher_date) || line.voucher_date || '',
        ledger_name: line.ledger_name,
        stock_item: line.stock_item,
        brand: line.brand,
        packing: line.packing ?? null,
        qty: line.qty,
        deliveryLocation: line.delivery_location,
      })),
    )
    setHighlightedLineIds(new Set())
  }

  async function onSelectChallan(challanId) {
    setSearchOpen(false)
    setLoadingChallan(true)
    try {
      const challan = await fetchDeliveryChallan(challanId)
      applyChallan(challan)
      await loadUsedInvoices(challan.id)
      showSuccess(`Loaded delivery challan ${challan.id}.`)
    } catch (error) {
      showError(getApiErrorMessage(error, 'Could not load delivery challan'))
    } finally {
      setLoadingChallan(false)
    }
  }

  function closePdfPreview() {
    setPdfPreview((current) => {
      if (current?.url) URL.revokeObjectURL(current.url)
      return null
    })
  }

  async function onPrint() {
    if (!isModifyMode) return
    closePdfPreview()
    setPrinting(true)
    setPdfPreview({ url: '', fileName: '' })
    try {
      const company = await fetchCompany()
      const { blob, fileName } = await createDeliveryChallanPdfBlob({
        company,
        challanNo,
        date,
        vehicleNo,
        driverName,
        batchNo,
        lines,
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

  return (
    <div className="flex h-full min-h-0 max-w-full flex-col">
      {searchOpen ? (
        <DeliveryChallanSearchModal
          onClose={() => setSearchOpen(false)}
          onSelect={(id) => void onSelectChallan(id)}
        />
      ) : null}
      {deleteConfirmOpen ? (
        <ConfirmDeleteModal
          confirming={deleting}
          onCancel={() => {
            if (!deleting) setDeleteConfirmOpen(false)
          }}
          onConfirm={() => void confirmDelete()}
        />
      ) : null}
      {summaryOpen ? (
        <DeliveryChallanSummaryModal lines={lines} onClose={() => setSummaryOpen(false)} />
      ) : null}
      <PdfPreviewModal
        open={printing || Boolean(pdfPreview)}
        title="Delivery Challan"
        fileName={pdfPreview?.fileName}
        pdfUrl={pdfPreview?.url}
        loading={printing}
        onClose={() => {
          if (!printing) closePdfPreview()
        }}
        onDownload={onDownloadPdf}
      />
      <FormPanel
        title={isModifyMode ? 'Delivery Challan — Modify' : 'Delivery Challan'}
        wide
        fill
        onSubmit={onSave}
        onKeyDown={onFormKeyDown}
        footer={
          <div className="win-form__footer-bar">
            <div className="win-form__footer-left">
              <button
                type="button"
                className="win-form__button win-form__button--danger"
                onClick={() => void onDelete()}
                disabled={!isModifyMode || saving || deleting || loadingChallan}
              >
                Delete
              </button>
              <button
                type="button"
                className="win-form__button"
                onClick={() => void onPrint()}
                disabled={!isModifyMode || saving || deleting || loadingChallan || printing}
              >
                {printing ? 'Preparing…' : 'Print'}
              </button>
              <button
                type="button"
                className="win-form__button"
                onClick={() => setSummaryOpen(true)}
                disabled={saving || deleting || loadingChallan || lines.length === 0}
              >
                Summary
              </button>
            </div>
            <div className="win-form__footer-right">
              <button
                type="button"
                className="win-form__button"
                onClick={() => setSearchOpen(true)}
                disabled={saving || deleting || loadingChallan}
              >
                Search
              </button>
              <button
                type="button"
                className="win-form__button"
                onClick={resetForm}
                disabled={saving || deleting || loadingChallan}
              >
                New
              </button>
              <button
                type="submit"
                className="win-form__button win-form__button--primary"
                disabled={saving || deleting || loadingChallan}
              >
                {saving ? 'Saving…' : isModifyMode ? 'Update' : 'Save'}
              </button>
            </div>
          </div>
        }
      >
        <div className="shrink-0">
          <div className="grid grid-cols-2 gap-x-3 lg:grid-cols-4">
            <FormField label="Delivery Challan No.">
              <FormInput readOnly value={challanNo} title={challanNo} />
            </FormField>
            <FormField label="Delivery Date">
              <FormInput
                required
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </FormField>
            <FormField label="Vehicle No.">
              <FormInput
                required
                value={vehicleNo}
                onChange={(e) => setVehicleNo(e.target.value)}
              />
            </FormField>
            <FormField label="Driver Name">
              <FormInput
                required
                value={driverName}
                onChange={(e) => setDriverName(e.target.value)}
              />
            </FormField>
          </div>

          <div className="mt-2 grid grid-cols-1 gap-x-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <FormField label="Invoice No.">
              <FormAutocomplete
                ref={invoiceInputRef}
                options={availableInvoiceOptions}
                value={selectedInvoice}
                onChange={setSelectedInvoice}
                onConfirm={(voucherNo) => {
                  if (!addingInvoice) void onAddInvoice(voucherNo)
                }}
                getOptionValue={(inv) => inv.voucher_no}
                getOptionLabel={invoiceOptionLabel}
                getInputLabel={(inv) => inv.voucher_no}
                renderOption={renderInvoiceOption}
                filterOption={filterInvoiceOption}
                disabled={loadingLookups}
                emptyMessage={loadingLookups ? 'Loading invoices…' : 'No matching invoices'}
              />
            </FormField>
            <FormField label="Batch No.">
              <FormInput
                required
                value={batchNo}
                onChange={(e) => setBatchNo(e.target.value)}
              />
            </FormField>
          </div>

          <div className="win-form__section-label mt-4">Delivery Items</div>
        </div>

        <div className="win-form__table-wrap" ref={tableWrapRef}>
          <table className="win-form__table w-full text-left text-sm">
            <thead>
              <tr>
                <th>Invoice No.</th>
                <th>Invoice Date</th>
                <th>Party</th>
                <th>Stock Item</th>
                <th>Brand</th>
                <th>Qty</th>
                <th>Delivery Location</th>
                <th aria-label="Actions" className="win-form__table-action" />
              </tr>
            </thead>
            <tbody>
              {lines.length === 0 ? (
                <tr>
                  <td colSpan={8} className="win-form__table-empty">
                    Search an invoice and press Enter to include stock items.
                  </td>
                </tr>
              ) : (
                lines.map((line, index) => {
                  const showInvoiceMeta =
                    index === 0 || lines[index - 1].voucher_no !== line.voucher_no
                  const rowSpan = showInvoiceMeta ? invoiceGroupSpan(lines, index) : 0
                  const rowClass = [
                    showInvoiceMeta && index > 0 ? 'win-form__table-row--invoice-start' : '',
                    highlightedLineIds.has(line.id) ? 'win-form__table-row--flash' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')
                  return (
                    <tr key={line.id} className={rowClass || undefined}>
                      <td>{showInvoiceMeta ? line.voucher_no : ''}</td>
                      <td>{showInvoiceMeta ? line.voucher_date : ''}</td>
                      <td>{showInvoiceMeta ? line.ledger_name : ''}</td>
                      <td>{line.stock_item}</td>
                      <td>{line.brand}</td>
                      <td>{line.qty ?? ''}</td>
                      <td>
                        <FormSelect
                          className="win-form__table-select"
                          value={line.deliveryLocation}
                          onChange={(e) => onLocationChange(line.id, e.target.value)}
                        >
                          {locations.map((name) => (
                            <option key={name} value={name}>
                              {name}
                            </option>
                          ))}
                        </FormSelect>
                      </td>
                      {showInvoiceMeta ? (
                        <td rowSpan={rowSpan} className="win-form__table-action">
                          <button
                            type="button"
                            className="win-form__icon-button"
                            aria-label={`Remove invoice ${line.voucher_no}`}
                            onClick={() => onRemoveInvoice(line.voucher_no)}
                          >
                            <TrashIcon />
                          </button>
                        </td>
                      ) : null}
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </FormPanel>
    </div>
  )
}
