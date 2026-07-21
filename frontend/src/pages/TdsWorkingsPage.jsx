import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { fetchCompany } from '../api/company'
import { fetchTdsWorkings, saveTdsWorkings, updateTdsWorkings } from '../api/tally'
import { ExcelPreviewModal } from '../components/common/ExcelPreviewModal'
import { PdfPreviewModal } from '../components/common/PdfPreviewModal'
import { FormDropdown } from '../components/form/FormDropdown'
import { FormField } from '../components/form/FormPanel'
import { useFormMessage } from '../components/form/FormMessage'
import { PrimaryContentLayout } from '../components/layout/PrimaryContentLayout'
import {
  FY_MONTHS,
  FY_QUARTERS,
  currentFinancialYearStart,
  dateRangeForFinancialYear,
  dateRangeForFinancialYearQuarter,
  financialYearOptions,
  formatFinancialYearLabel,
} from '../utils/financialYear'
import { formatDate } from '../utils/formatDate'
import { formatValue } from '../utils/formatNumber'
import { getApiErrorMessage } from '../utils/formValidation'
import {
  createTdsWorkingsExcelBlob,
  createTdsWorkingsPdfBlob,
} from '../utils/tdsWorkingsExport'

const MONTH_ALL = 'all'
const HEAD_ALL = 'all'
const HEAD_BLANK = '__blank__'
const STATUS_NEW = 'new'
const STATUS_DELETED = 'deleted'

function currentMonthValue() {
  return String(new Date().getMonth() + 1)
}

function headKey(value) {
  const trimmed = String(value ?? '').trim()
  return trimmed || HEAD_BLANK
}

function headLabel(key) {
  return key === HEAD_BLANK ? '(Blank)' : key
}

function isActiveRow(row) {
  return row?.status !== STATUS_DELETED
}

function groupByTdsHead(rows) {
  const map = new Map()
  for (const row of rows) {
    if (!isActiveRow(row)) continue
    const key = headKey(row.tds_head)
    let group = map.get(key)
    if (!group) {
      group = {
        key,
        tdsHead: headLabel(key),
        lineCount: 0,
        amount: 0,
      }
      map.set(key, group)
    }
    group.lineCount += 1
    group.amount += Number(row.amount) || 0
  }
  return Array.from(map.values()).sort((a, b) =>
    a.tdsHead.localeCompare(b.tdsHead, undefined, { sensitivity: 'base' }),
  )
}

function rowStatusClass(status) {
  if (status === STATUS_NEW) return 'tds-workings__row--new'
  if (status === STATUS_DELETED) return 'tds-workings__row--deleted'
  return ''
}

const summaryColGroup = (
  <colgroup>
    <col className="tds-workings__col-head" />
    <col className="tds-workings__col-lines" />
    <col className="tds-workings__col-amount" />
  </colgroup>
)

const detailColGroup = (
  <colgroup>
    <col className="tds-workings__col-date" />
    <col className="tds-workings__col-party" />
    <col className="tds-workings__col-pan" />
    <col className="tds-workings__col-exp-date" />
    <col className="tds-workings__col-exp-amount" />
    <col className="tds-workings__col-amount" />
  </colgroup>
)

function SummaryHeaderRow() {
  return (
    <tr>
      <th className="tds-workings__col-head">TDS Head</th>
      <th className="tds-workings__col-lines win-form__table-num">Lines</th>
      <th className="tds-workings__col-amount win-form__table-num">Amount</th>
    </tr>
  )
}

function DetailHeaderRow() {
  return (
    <tr>
      <th className="tds-workings__col-date">Date</th>
      <th className="tds-workings__col-party">Party</th>
      <th className="tds-workings__col-pan">PAN</th>
      <th className="tds-workings__col-exp-date">Expenses Date</th>
      <th className="tds-workings__col-exp-amount win-form__table-num">Expenses Amount</th>
      <th className="tds-workings__col-amount win-form__table-num">Amount</th>
    </tr>
  )
}

export function TdsWorkingsPage() {
  const { showError, showSuccess } = useFormMessage()
  const fyOptions = useMemo(
    () =>
      financialYearOptions(5).map((opt) => ({
        value: String(opt.value),
        label: opt.label,
      })),
    [],
  )
  const [fyStart, setFyStart] = useState(() => String(currentFinancialYearStart()))
  const [month, setMonth] = useState(currentMonthValue)
  const [quarter, setQuarter] = useState('')
  const [tdsHead, setTdsHead] = useState(HEAD_ALL)
  const [rows, setRows] = useState([])
  const [saved, setSaved] = useState(false)
  const [newCount, setNewCount] = useState(0)
  const [deletedCount, setDeletedCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [printing, setPrinting] = useState(false)
  const [excelLoading, setExcelLoading] = useState(false)
  const [pdfPreview, setPdfPreview] = useState(null)
  const [excelPreview, setExcelPreview] = useState(null)

  const headRef = useRef(null)
  const bodyRef = useRef(null)
  const footRef = useRef(null)
  const syncing = useRef(false)

  const { dateFrom, dateTo } = useMemo(() => {
    if (quarter) {
      return dateRangeForFinancialYearQuarter(fyStart, quarter)
    }
    return dateRangeForFinancialYear(fyStart, month === MONTH_ALL ? null : month)
  }, [fyStart, month, quarter])

  const isSummary = tdsHead === HEAD_ALL
  const busy = loading || saving || updating || printing || excelLoading
  const hasDiff = newCount > 0 || deletedCount > 0
  const quarterSelected = Boolean(quarter)
  const exportRows = useMemo(() => rows.filter(isActiveRow), [rows])

  const exportTitle = useMemo(() => {
    if (!quarterSelected) return 'TDS Return'
    return `TDS Return — Q${quarter} FY ${formatFinancialYearLabel(fyStart)}`
  }, [quarterSelected, quarter, fyStart])

  const monthOptions = useMemo(
    () => [
      { value: MONTH_ALL, label: 'All' },
      ...FY_MONTHS.map((m) => ({ value: String(m.value), label: m.label })),
    ],
    [],
  )

  function onMonthChange(value) {
    setQuarter('')
    setMonth(value)
  }

  function onQuarterChange(value) {
    const next = String(value) === String(quarter) ? '' : String(value)
    setQuarter(next)
    if (next) setMonth(MONTH_ALL)
  }

  function applyData(data) {
    setRows(Array.isArray(data?.rows) ? data.rows : [])
    setSaved(Boolean(data?.saved))
    setNewCount(Number(data?.new_count) || 0)
    setDeletedCount(Number(data?.deleted_count) || 0)
  }

  const load = useCallback(async () => {
    if (!dateFrom || !dateTo) return
    setLoading(true)
    try {
      const data = await fetchTdsWorkings({ dateFrom, dateTo })
      applyData(data)
    } catch (err) {
      applyData(null)
      showError(getApiErrorMessage(err, 'Unable to load TDS workings'))
    } finally {
      setLoading(false)
    }
  }, [dateFrom, dateTo, showError])

  useEffect(() => {
    void load()
  }, [load])

  const headOptions = useMemo(() => {
    const keys = new Set()
    for (const row of rows) keys.add(headKey(row.tds_head))
    const opts = Array.from(keys)
      .map((key) => ({ value: key, label: headLabel(key) }))
      .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }))
    return [{ value: HEAD_ALL, label: 'All (group by head)' }, ...opts]
  }, [rows])

  useEffect(() => {
    if (tdsHead === HEAD_ALL) return
    if (!headOptions.some((opt) => opt.value === tdsHead)) {
      setTdsHead(HEAD_ALL)
    }
  }, [headOptions, tdsHead])

  const headSelectStyle = useMemo(() => {
    const maxLen = headOptions.reduce(
      (max, opt) => Math.max(max, String(opt.label).length),
      8,
    )
    return { width: `min(100%, ${maxLen + 4}ch)` }
  }, [headOptions])

  const filteredRows = useMemo(() => {
    if (tdsHead === HEAD_ALL) return rows
    return rows.filter((row) => headKey(row.tds_head) === tdsHead)
  }, [rows, tdsHead])

  const activeFilteredRows = useMemo(
    () => filteredRows.filter(isActiveRow),
    [filteredRows],
  )

  const summaryRows = useMemo(
    () => (isSummary ? groupByTdsHead(filteredRows) : []),
    [isSummary, filteredRows],
  )

  const totalAmount = useMemo(
    () => activeFilteredRows.reduce((sum, row) => sum + (Number(row.amount) || 0), 0),
    [activeFilteredRows],
  )

  const totalExpensesAmount = useMemo(
    () =>
      activeFilteredRows.reduce((sum, row) => {
        const value = Number(row.expenses_amount)
        return Number.isFinite(value) ? sum + value : sum
      }, 0),
    [activeFilteredRows],
  )

  const showFooter = !loading && filteredRows.length > 0

  const countLabel = loading
    ? 'Loading…'
    : isSummary
      ? `${summaryRows.length} head${summaryRows.length === 1 ? '' : 's'}`
      : `${filteredRows.length} line${filteredRows.length === 1 ? '' : 's'}`

  async function onSave() {
    if (!dateFrom || !dateTo || busy) return
    setSaving(true)
    try {
      const data = await saveTdsWorkings({ dateFrom, dateTo })
      applyData(data)
      showSuccess('TDS workings saved for this period.')
    } catch (err) {
      showError(getApiErrorMessage(err, 'Unable to save TDS workings'))
    } finally {
      setSaving(false)
    }
  }

  async function onUpdate() {
    if (!dateFrom || !dateTo || busy || !hasDiff) return
    setUpdating(true)
    try {
      const data = await updateTdsWorkings({ dateFrom, dateTo })
      applyData(data)
      showSuccess('TDS workings updated.')
    } catch (err) {
      showError(getApiErrorMessage(err, 'Unable to update TDS workings'))
    } finally {
      setUpdating(false)
    }
  }

  function closePdfPreview() {
    if (pdfPreview?.url) URL.revokeObjectURL(pdfPreview.url)
    setPdfPreview(null)
  }

  function closeExcelPreview() {
    setExcelPreview(null)
  }

  async function onPdf() {
    if (!quarterSelected) return
    if (!exportRows.length) {
      showError('Nothing to export for this quarter.')
      return
    }
    closePdfPreview()
    setPrinting(true)
    setPdfPreview({ url: '', fileName: '' })
    try {
      const company = await fetchCompany()
      const { blob, fileName } = await createTdsWorkingsPdfBlob({
        company,
        rows: exportRows,
        fyStart,
        quarter,
        dateFrom,
        dateTo,
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

  async function onExcel() {
    if (!quarterSelected) return
    if (!exportRows.length) {
      showError('Nothing to export for this quarter.')
      return
    }
    closeExcelPreview()
    setExcelLoading(true)
    setExcelPreview({ html: '', fileName: '' })
    try {
      const company = await fetchCompany()
      const { html, fileName, blob } = createTdsWorkingsExcelBlob({
        company,
        rows: exportRows,
        fyStart,
        quarter,
        dateFrom,
        dateTo,
      })
      setExcelPreview({ html, fileName, blob })
    } catch (err) {
      closeExcelPreview()
      showError(getApiErrorMessage(err, 'Could not generate Excel'))
    } finally {
      setExcelLoading(false)
    }
  }

  function onDownloadExcel() {
    if (!excelPreview?.blob || !excelPreview?.fileName) return
    const url = URL.createObjectURL(excelPreview.blob)
    const link = document.createElement('a')
    link.href = url
    link.download = excelPreview.fileName
    link.click()
    URL.revokeObjectURL(url)
  }

  function syncHorizontalScroll(source) {
    if (syncing.current) return
    syncing.current = true
    const left = source.scrollLeft
    if (headRef.current && headRef.current !== source) headRef.current.scrollLeft = left
    if (bodyRef.current && bodyRef.current !== source) bodyRef.current.scrollLeft = left
    if (footRef.current && footRef.current !== source) footRef.current.scrollLeft = left
    syncing.current = false
  }

  const tableClass = `win-form__table tds-workings__table${
    isSummary ? ' tds-workings__table--summary' : ''
  }`

  return (
    <>
      <PdfPreviewModal
        open={printing || Boolean(pdfPreview)}
        title={exportTitle}
        fileName={pdfPreview?.fileName}
        pdfUrl={pdfPreview?.url}
        loading={printing}
        onClose={() => {
          if (!printing) closePdfPreview()
        }}
        onDownload={onDownloadPdf}
      />
      <ExcelPreviewModal
        open={excelLoading || Boolean(excelPreview)}
        title={exportTitle}
        fileName={excelPreview?.fileName}
        html={excelPreview?.html}
        loading={excelLoading}
        onClose={() => {
          if (!excelLoading) closeExcelPreview()
        }}
        onDownload={onDownloadExcel}
      />
      <PrimaryContentLayout
      title="TDS Workings"
      breadcrumb={[{ label: 'Reports' }, { label: 'TDS Workings' }]}
      footer={
        <>
          <button
            type="button"
            className="win-form__button"
            disabled={busy}
            onClick={() => void load()}
          >
            Reload
          </button>
          {saved ? (
            <button
              type="button"
              className="win-form__button win-form__button--primary"
              disabled={busy || !hasDiff}
              title={
                hasDiff
                  ? 'Apply new and deleted lines to saved data'
                  : 'No changes to apply'
              }
              onClick={() => void onUpdate()}
            >
              {updating ? 'Updating…' : 'Update'}
            </button>
          ) : (
            <button
              type="button"
              className="win-form__button win-form__button--primary"
              disabled={busy || !dateFrom || !dateTo}
              onClick={() => void onSave()}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          )}
        </>
      }
    >
      <div className="tds-workings">
        <div className="tds-workings__toolbar shrink-0">
          <div className="tds-workings__filters">
            <FormField label="Financial Year" className="tds-workings__field tds-workings__field--fy">
              <FormDropdown
                options={fyOptions}
                value={fyStart}
                onChange={setFyStart}
                disabled={busy}
                placeholder="FY"
              />
            </FormField>
            <FormField label="Month" className="tds-workings__field tds-workings__field--month">
              <FormDropdown
                options={monthOptions}
                value={month}
                onChange={onMonthChange}
                disabled={busy}
                placeholder="Month"
              />
            </FormField>
            <FormField label="TDS Head" className="tds-workings__field tds-workings__field--head">
              <FormDropdown
                className="tds-workings__head-dropdown"
                listClassName="tds-workings__head-list"
                options={headOptions}
                value={tdsHead}
                onChange={setTdsHead}
                disabled={busy}
                placeholder="TDS Head"
                emptyMessage="No TDS heads"
                style={headSelectStyle}
              />
            </FormField>
            <FormField label="TDS Return" className="tds-workings__field tds-workings__field--return">
              <div className="tds-workings__return-row">
                <div className="tds-workings__quarters" role="group" aria-label="TDS Return quarter">
                  {FY_QUARTERS.map((q) => (
                    <button
                      key={q.value}
                      type="button"
                      className={`tds-workings__quarter${
                        String(quarter) === String(q.value) ? ' is-active' : ''
                      }`}
                      disabled={busy}
                      onClick={() => onQuarterChange(q.value)}
                    >
                      {q.label}
                    </button>
                  ))}
                </div>
                <div className="tds-workings__export" role="group" aria-label="Export TDS return">
                  <button
                    type="button"
                    className="tds-workings__export-btn"
                    disabled={busy || !quarterSelected}
                    title={
                      quarterSelected
                        ? 'Open Excel preview'
                        : 'Select a quarter to export'
                    }
                    onClick={() => void onExcel()}
                  >
                    {excelLoading ? '…' : 'Excel'}
                  </button>
                  <button
                    type="button"
                    className="tds-workings__export-btn"
                    disabled={busy || !quarterSelected}
                    title={
                      quarterSelected ? 'Open PDF preview' : 'Select a quarter to export'
                    }
                    onClick={() => void onPdf()}
                  >
                    {printing ? '…' : 'PDF'}
                  </button>
                </div>
              </div>
            </FormField>
          </div>
          <p className="tds-workings__count">{countLabel}</p>
        </div>

        <div className="tds-workings__table-wrap">
          <div
            className="tds-workings__table-head"
            ref={headRef}
            onScroll={(event) => syncHorizontalScroll(event.currentTarget)}
          >
            <table className={tableClass}>
              {isSummary ? summaryColGroup : detailColGroup}
              <thead>{isSummary ? <SummaryHeaderRow /> : <DetailHeaderRow />}</thead>
            </table>
          </div>

          <div
            className="tds-workings__table-scroll"
            ref={bodyRef}
            onScroll={(event) => syncHorizontalScroll(event.currentTarget)}
          >
            <table className={tableClass}>
              {isSummary ? summaryColGroup : detailColGroup}
              <thead aria-hidden="true" className="tds-workings__table-spacer">
                {isSummary ? <SummaryHeaderRow /> : <DetailHeaderRow />}
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={isSummary ? 3 : 6} className="win-form__table-empty">
                      Loading…
                    </td>
                  </tr>
                ) : isSummary ? (
                  summaryRows.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="win-form__table-empty">
                        No TDS Payable journal lines for this period.
                      </td>
                    </tr>
                  ) : (
                    summaryRows.map((group) => (
                      <tr
                        key={group.key}
                        className="tds-workings__row-click"
                        tabIndex={0}
                        onClick={() => setTdsHead(group.key)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            setTdsHead(group.key)
                          }
                        }}
                        title="Click to view breakup"
                      >
                        <td className="tds-workings__col-head" title={group.tdsHead}>
                          {group.tdsHead}
                        </td>
                        <td className="tds-workings__col-lines win-form__table-num">
                          {group.lineCount}
                        </td>
                        <td className="tds-workings__col-amount win-form__table-num">
                          {formatValue(group.amount)}
                        </td>
                      </tr>
                    ))
                  )
                ) : filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="win-form__table-empty">
                      No lines for this TDS head.
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((row, index) => (
                    <tr
                      key={`${row.source_id ?? ''}-${row.voucher_date || ''}-${index}`}
                      className={rowStatusClass(row.status)}
                      title={
                        row.status === STATUS_NEW
                          ? 'New in Tally — not saved yet'
                          : row.status === STATUS_DELETED
                            ? 'Deleted from Tally — still in saved data'
                            : undefined
                      }
                    >
                      <td className="tds-workings__col-date">
                        {row.voucher_date ? formatDate(row.voucher_date) : '—'}
                      </td>
                      <td className="tds-workings__col-party" title={row.party || ''}>
                        {row.party || '—'}
                      </td>
                      <td className="tds-workings__col-pan" title={row.pan || ''}>
                        {row.pan || '—'}
                      </td>
                      <td className="tds-workings__col-exp-date">
                        {row.expenses_date ? formatDate(row.expenses_date) : '—'}
                      </td>
                      <td className="tds-workings__col-exp-amount win-form__table-num">
                        {row.expenses_amount != null && Number.isFinite(Number(row.expenses_amount))
                          ? formatValue(row.expenses_amount)
                          : '—'}
                      </td>
                      <td className="tds-workings__col-amount win-form__table-num">
                        {formatValue(row.amount)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {showFooter ? (
            <div
              className="tds-workings__table-foot"
              ref={footRef}
              onScroll={(event) => syncHorizontalScroll(event.currentTarget)}
            >
              <table className={tableClass}>
                {isSummary ? summaryColGroup : detailColGroup}
                <thead aria-hidden="true" className="tds-workings__table-spacer">
                  {isSummary ? <SummaryHeaderRow /> : <DetailHeaderRow />}
                </thead>
                <tbody>
                  {isSummary ? (
                    <tr>
                      <td className="tds-workings__total-label">
                        <span className="win-form__table-total-label">Total</span>
                      </td>
                      <td className="tds-workings__col-lines win-form__table-num">
                        {activeFilteredRows.length}
                      </td>
                      <td className="tds-workings__col-amount win-form__table-num">
                        {formatValue(totalAmount)}
                      </td>
                    </tr>
                  ) : (
                    <tr>
                      <td className="tds-workings__col-date" />
                      <td className="tds-workings__col-party tds-workings__total-label">
                        <span className="win-form__table-total-label">Total</span>
                      </td>
                      <td className="tds-workings__col-pan" />
                      <td className="tds-workings__col-exp-date" />
                      <td className="tds-workings__col-exp-amount win-form__table-num">
                        {formatValue(totalExpensesAmount)}
                      </td>
                      <td className="tds-workings__col-amount win-form__table-num">
                        {formatValue(totalAmount)}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      </div>
    </PrimaryContentLayout>
    </>
  )
}
