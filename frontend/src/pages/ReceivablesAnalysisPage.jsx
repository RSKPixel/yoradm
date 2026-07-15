import { Fragment, useEffect, useMemo, useState } from 'react'
import { ClipboardDocumentIcon } from '@heroicons/react/24/outline'
import { PdfIcon } from '../components/icons/PdfIcon'
import {
  fetchReceivableRepresentatives,
  fetchReceivablesAnalysis,
} from '../api/tally'
import { fetchCompany } from '../api/company'
import { PdfPreviewModal } from '../components/common/PdfPreviewModal'
import { FormField, FormInput, FormSelect } from '../components/form/FormPanel'
import { useFormMessage } from '../components/form/FormMessage'
import { PrimaryContentLayout } from '../components/layout/PrimaryContentLayout'
import {
  buildReceivablesImageBlob,
  copyImageBlobToClipboard,
} from '../utils/copyReceivablesImage'
import { createReceivablesAnalysisPdfBlob } from '../utils/receivablesAnalysisPdf'
import {
  AGEING_BUCKETS,
  buildPartyAgeingSummary,
  formatAgeingAmount,
  sumAgeingRows,
} from '../utils/receivablesAgeingSummary'
import { formatDate } from '../utils/formatDate'
import { formatValue } from '../utils/formatNumber'
import { getApiErrorMessage } from '../utils/formValidation'

const REP_BLANK = '__blank__'
const COL_COUNT = 4
const VIEW_PARTY = 'party'
const VIEW_AGEING = 'ageing'

function repLabel(name) {
  if (!name || name === REP_BLANK) return '(Blank)'
  return name
}

function partyKey(invoice) {
  return (invoice.ledger_name || '').trim() || '(No party)'
}

/** Group invoices by party; parties ordered by total desc, invoices by date asc. */
function groupInvoicesByParty(invoices) {
  const map = new Map()

  for (const inv of invoices) {
    const key = partyKey(inv)
    let group = map.get(key)
    if (!group) {
      group = { ledgerName: key, invoices: [], total: 0 }
      map.set(key, group)
    }
    group.invoices.push(inv)
    group.total += Number(inv.amount) || 0
  }

  const groups = Array.from(map.values())
  for (const group of groups) {
    group.invoices.sort((a, b) => {
      const da = a.invoice_date ? String(a.invoice_date) : ''
      const db = b.invoice_date ? String(b.invoice_date) : ''
      if (da !== db) return da.localeCompare(db)
      return String(a.invoice_no ?? '').localeCompare(String(b.invoice_no ?? ''))
    })
  }
  groups.sort((a, b) => a.ledgerName.localeCompare(b.ledgerName, undefined, { sensitivity: 'base' }))
  return groups
}

/** Case-insensitive match: every query token must appear in the party name. */
function partyMatchesSearch(ledgerName, query) {
  const q = String(query ?? '').trim().toLowerCase()
  if (!q) return true
  const haystack = String(ledgerName ?? '').toLowerCase()
  return q.split(/\s+/).every((token) => haystack.includes(token))
}

const recvColGroup = (
  <colgroup>
    <col className="recv-col-invoice" />
    <col className="recv-col-date" />
    <col className="recv-col-amount" />
    <col className="recv-col-age" />
  </colgroup>
)

const recvAgeingColGroup = (
  <colgroup>
    <col className="recv-ageing-col-party" />
    {AGEING_BUCKETS.map((col) => (
      <col key={col.key} className="recv-ageing-col-bucket" />
    ))}
    <col className="recv-ageing-col-total" />
  </colgroup>
)

export function ReceivablesAnalysisPage() {
  const { showError, showSuccess } = useFormMessage()
  const [representative, setRepresentative] = useState('')
  const [partySearch, setPartySearch] = useState('')
  const [viewMode, setViewMode] = useState(VIEW_PARTY)
  const [reps, setReps] = useState([])
  const [analysis, setAnalysis] = useState(null)
  const [companyName, setCompanyName] = useState('')
  const [loading, setLoading] = useState(true)
  const [copyingParty, setCopyingParty] = useState('')
  const [printing, setPrinting] = useState(false)
  const [pdfPreview, setPdfPreview] = useState(null)

  useEffect(() => {
    let cancelled = false
    void fetchReceivableRepresentatives()
      .then((data) => {
        if (!cancelled) setReps(Array.isArray(data) ? data : [])
      })
      .catch(() => {
        if (!cancelled) setReps([])
      })
    void fetchCompany()
      .then((company) => {
        if (!cancelled) setCompanyName(String(company?.company_name || '').trim())
      })
      .catch(() => {
        if (!cancelled) setCompanyName('')
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      try {
        const data = await fetchReceivablesAnalysis({
          representative: representative || undefined,
        })
        if (!cancelled) setAnalysis(data)
      } catch (err) {
        if (!cancelled) {
          setAnalysis(null)
          showError(getApiErrorMessage(err, 'Failed to load receivables analysis'))
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [representative])

  const partyGroups = useMemo(() => {
    const groups = groupInvoicesByParty(analysis?.invoices ?? [])
    return groups.filter((group) => partyMatchesSearch(group.ledgerName, partySearch))
  }, [analysis?.invoices, partySearch])

  const filteredTotals = useMemo(() => {
    let total = 0
    let invoiceCount = 0
    for (const group of partyGroups) {
      total += group.total
      invoiceCount += group.invoices.length
    }
    return { total, invoiceCount }
  }, [partyGroups])

  const ageingSummary = useMemo(() => buildPartyAgeingSummary(partyGroups), [partyGroups])
  const ageingTotals = useMemo(() => sumAgeingRows(ageingSummary), [ageingSummary])

  const showFooterTotal = !loading && partyGroups.length > 0

  function closePdfPreview() {
    setPdfPreview((current) => {
      if (current?.url) URL.revokeObjectURL(current.url)
      return null
    })
  }

  async function onPdf() {
    if (!partyGroups.length) {
      showError('Nothing to print for this filter.')
      return
    }
    closePdfPreview()
    setPrinting(true)
    setPdfPreview({ url: '', fileName: '' })
    try {
      const company = await fetchCompany()
      const { blob, fileName } = await createReceivablesAnalysisPdfBlob({
        company,
        partyGroups,
        asOfDate: new Date(),
        representativeLabel: representative ? repLabel(representative) : '',
        viewMode,
      })
      const url = URL.createObjectURL(blob)
      setPdfPreview({ url, fileName })
    } catch (err) {
      closePdfPreview()
      showError(getApiErrorMessage(err, 'Could not generate PDF'))
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

  async function onCopyParty(group) {
    if (!group?.invoices?.length) {
      showError('Nothing to copy for this party.')
      return
    }
    setCopyingParty(group.ledgerName)
    try {
      const blob = await buildReceivablesImageBlob([group], { companyName })
      await copyImageBlobToClipboard(blob)
      showSuccess(`Copied ${group.ledgerName}. Paste into WhatsApp.`)
    } catch (err) {
      showError(getApiErrorMessage(err, 'Could not copy image to clipboard'))
    } finally {
      setCopyingParty('')
    }
  }

  const copyBusy = Boolean(copyingParty)

  return (
    <div className="flex h-full min-h-0 max-w-full flex-col">
      <PdfPreviewModal
        open={printing || Boolean(pdfPreview)}
        title="Debitors Receivable"
        fileName={pdfPreview?.fileName}
        pdfUrl={pdfPreview?.url}
        loading={printing}
        onClose={() => {
          if (!printing) closePdfPreview()
        }}
        onDownload={onDownloadPdf}
      />
      <PrimaryContentLayout
        breadcrumb={[{ label: 'Reports' }, { label: 'Receivables Analysis' }]}
        title="Receivables Analysis"
        footer={
          <button
            type="button"
            className="win-form__button win-form__button--primary win-form__button--icon"
            onClick={() => void onPdf()}
            disabled={loading || printing || copyBusy || partyGroups.length === 0}
            title="PDF"
            aria-label={printing ? 'Preparing PDF' : 'PDF'}
          >
            {printing ? (
              '…'
            ) : (
              <PdfIcon className="recv-pdf-btn__icon" />
            )}
          </button>
        }
      >
        <div className="shrink-0">
          <div className="recv-toolbar">
            <div className="grid min-w-0 flex-1 grid-cols-2 gap-x-3 lg:grid-cols-5">
              <FormField label="Representative">
                <FormSelect
                  value={representative}
                  onChange={(e) => setRepresentative(e.target.value)}
                  disabled={loading}
                >
                  <option value="">All representatives</option>
                  {reps.map((rep) => (
                    <option key={rep.name} value={rep.name}>
                      {repLabel(rep.name)}
                    </option>
                  ))}
                </FormSelect>
              </FormField>
              <FormField label="Search Party" className="col-span-2 lg:col-span-2">
                <FormInput
                  type="text"
                  value={partySearch}
                  onChange={(e) => setPartySearch(e.target.value)}
                  placeholder="Type party name…"
                  disabled={loading}
                />
              </FormField>
            </div>
            <div
              className="pending-deliveries-segments recv-view-segments"
              role="group"
              aria-label="Report view"
            >
              <button
                type="button"
                className={`pending-deliveries-segment${viewMode === VIEW_PARTY ? ' is-active' : ''}`}
                aria-pressed={viewMode === VIEW_PARTY}
                onClick={() => setViewMode(VIEW_PARTY)}
              >
                Party wise
              </button>
              <button
                type="button"
                className={`pending-deliveries-segment${viewMode === VIEW_AGEING ? ' is-active' : ''}`}
                aria-pressed={viewMode === VIEW_AGEING}
                onClick={() => setViewMode(VIEW_AGEING)}
              >
                Summary ageing
              </button>
            </div>
          </div>
        </div>

        {viewMode === VIEW_PARTY ? (
        <div className="win-form__table-wrap win-form__table-shell mt-3">
          <div className="win-form__table-scroll">
            <table className="win-form__table win-form__table--bordered win-form__table--recv w-full text-sm">
              {recvColGroup}
              <thead>
                <tr>
                  <th className="recv-cell-invoice">Invoice No</th>
                  <th className="recv-cell-date">Invoice Date</th>
                  <th className="win-form__table-num">Amount</th>
                  <th className="win-form__table-num">Age</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={COL_COUNT} className="win-form__table-empty">
                      Loading…
                    </td>
                  </tr>
                ) : null}
                {!loading && partyGroups.length === 0 ? (
                  <tr>
                    <td colSpan={COL_COUNT} className="win-form__table-empty">
                      No receivables for this filter.
                    </td>
                  </tr>
                ) : null}
                {partyGroups.map((group) => (
                  <Fragment key={group.ledgerName}>
                    <tr className="win-form__table-row--group">
                      <td colSpan={COL_COUNT}>
                        <div className="recv-party-head">
                          <span className="recv-party-head__name">{group.ledgerName}</span>
                          <button
                            type="button"
                            className="win-form__icon-button recv-party-copy"
                            title={`Copy ${group.ledgerName}`}
                            aria-label={`Copy ${group.ledgerName}`}
                            disabled={copyBusy || printing}
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              void onCopyParty(group)
                            }}
                          >
                            <ClipboardDocumentIcon
                              className={`recv-party-copy__icon${
                                copyingParty === group.ledgerName ? ' is-busy' : ''
                              }`}
                              aria-hidden="true"
                            />
                          </button>
                        </div>
                      </td>
                    </tr>
                    {group.invoices.map((row) => (
                      <tr key={row.id}>
                        <td className="recv-cell-invoice">{row.invoice_no ?? '—'}</td>
                        <td className="recv-cell-date">{formatDate(row.invoice_date) || '—'}</td>
                        <td className="win-form__table-num">
                          <span className="win-form__table-readonly">
                            {formatValue(row.amount)}
                          </span>
                        </td>
                        <td className="win-form__table-num">
                          <span className="win-form__table-readonly">
                            {row.days == null ? '—' : row.days}
                          </span>
                        </td>
                      </tr>
                    ))}
                    <tr className="recv-party-subtotal">
                      <td colSpan={2}>
                        <span className="win-form__table-total-label">Sub total</span>
                      </td>
                      <td className="win-form__table-num">
                        <span className="win-form__table-readonly">
                          {formatValue(group.total)}
                        </span>
                      </td>
                      <td className="win-form__table-num" />
                    </tr>
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
          <div className="win-form__table-foot">
            <table className="win-form__table win-form__table--recv w-full text-sm">
              {recvColGroup}
              <tbody>
                <tr>
                  <td colSpan={2}>
                    {showFooterTotal ? (
                      <span className="win-form__table-total-label">
                        Total ({filteredTotals.invoiceCount} invoices)
                      </span>
                    ) : null}
                  </td>
                  <td className="win-form__table-num">
                    {showFooterTotal ? (
                      <span className="win-form__table-readonly">
                        {formatValue(filteredTotals.total)}
                      </span>
                    ) : null}
                  </td>
                  <td className="win-form__table-num" />
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        ) : (
          <div className="win-form__table-wrap win-form__table-shell mt-3">
            <div className="win-form__table-scroll">
              <table className="win-form__table win-form__table--bordered win-form__table--recv-ageing w-full text-sm">
                {recvAgeingColGroup}
                <thead>
                  <tr>
                    <th className="recv-ageing-party">Party</th>
                    {AGEING_BUCKETS.map((col) => (
                      <th key={col.key} className="win-form__table-num">
                        {col.label}
                      </th>
                    ))}
                    <th className="win-form__table-num">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td
                        colSpan={AGEING_BUCKETS.length + 2}
                        className="win-form__table-empty"
                      >
                        Loading…
                      </td>
                    </tr>
                  ) : null}
                  {!loading && ageingSummary.length === 0 ? (
                    <tr>
                      <td
                        colSpan={AGEING_BUCKETS.length + 2}
                        className="win-form__table-empty"
                      >
                        No receivables for this filter.
                      </td>
                    </tr>
                  ) : null}
                  {ageingSummary.map((row) => (
                    <tr key={row.ledgerName}>
                      <td className="recv-ageing-party">{row.ledgerName}</td>
                      {AGEING_BUCKETS.map((col) => (
                        <td key={col.key} className="win-form__table-num">
                          <span className="win-form__table-readonly">
                            {formatAgeingAmount(row[col.key])}
                          </span>
                        </td>
                      ))}
                      <td className="win-form__table-num">
                        <span className="win-form__table-readonly">
                          {formatValue(row.total)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {showFooterTotal ? (
              <div className="win-form__table-foot">
                <table className="win-form__table win-form__table--recv-ageing w-full text-sm">
                  {recvAgeingColGroup}
                  <tbody>
                    <tr>
                      <td className="recv-ageing-party">
                        <span className="win-form__table-total-label">Total</span>
                      </td>
                      {AGEING_BUCKETS.map((col) => (
                        <td key={col.key} className="win-form__table-num">
                          <span className="win-form__table-readonly">
                            {formatAgeingAmount(ageingTotals[col.key])}
                          </span>
                        </td>
                      ))}
                      <td className="win-form__table-num">
                        <span className="win-form__table-readonly">
                          {formatValue(ageingTotals.total)}
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>
        )}
      </PrimaryContentLayout>
    </div>
  )
}
