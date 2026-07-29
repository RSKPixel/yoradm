import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowPathIcon,
  ArrowUpTrayIcon,
  EyeIcon,
  LinkIcon,
  TrashIcon,
} from '@heroicons/react/24/outline'
import { fetchCompany } from '../api/company'
import {
  applyTdsExpenseMatch,
  deleteTdsHeadPaymentPdf,
  fetchTdsExpenseMatch,
  fetchTdsHeadPaymentPdfBlob,
  fetchTdsHeadPayments,
  fetchTdsWorkings,
  saveTdsWorkings,
  updateTdsHeadPaymentDate,
  updateTdsWorkings,
  uploadTdsHeadPaymentPdf,
} from '../api/tally'
import { ExcelPreviewModal } from '../components/common/ExcelPreviewModal'
import { PdfPreviewModal } from '../components/common/PdfPreviewModal'
import { TdsExpenseMatchModal } from '../components/tally/TdsExpenseMatchModal'
import { FormDropdown } from '../components/form/FormDropdown'
import { FormField, FormInput } from '../components/form/FormPanel'
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
const HEAD_COMMON = '__COMMON__'
const STATUS_NEW = 'new'
const STATUS_DELETED = 'deleted'
const STATUS_MISSING = 'missing'
const MAX_PAYMENT_PDF_BYTES = 1 * 1024 * 1024

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

function paymentDateIso(value) {
  return value ? String(value).slice(0, 10) : ''
}

function hasOwnPaymentDate(payment) {
  return Boolean(payment && payment.payment_date)
}

function hasOwnPaymentPdf(payment) {
  return Boolean(payment?.has_pdf)
}

function effectivePaymentDate(headKeyValue, paymentsByHead) {
  const own = paymentsByHead[headKeyValue]
  if (hasOwnPaymentDate(own)) return paymentDateIso(own.payment_date)
  return paymentDateIso(paymentsByHead[HEAD_COMMON]?.payment_date)
}

function effectivePdfSourceHead(headKeyValue, paymentsByHead) {
  if (hasOwnPaymentPdf(paymentsByHead[headKeyValue])) return headKeyValue
  if (hasOwnPaymentPdf(paymentsByHead[HEAD_COMMON])) return HEAD_COMMON
  return null
}

function isActiveRow(row) {
  return row?.status !== STATUS_DELETED && row?.status !== STATUS_MISSING
}

function isExpensesMissing(row) {
  if (!isActiveRow(row)) return false
  const hasDate = Boolean(String(row.expenses_date ?? '').trim())
  const amount = Number(row.expenses_amount)
  const hasAmount = row.expenses_amount != null && Number.isFinite(amount)
  return !hasDate || !hasAmount
}

function isPanMissing(row) {
  if (!isActiveRow(row)) return false
  return !String(row.pan ?? '').trim()
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
        panMissing: 0,
        expensesMissing: 0,
        amount: 0,
      }
      map.set(key, group)
    }
    group.lineCount += 1
    if (isPanMissing(row)) group.panMissing += 1
    if (isExpensesMissing(row)) group.expensesMissing += 1
    group.amount += Number(row.amount) || 0
  }
  return Array.from(map.values()).sort((a, b) =>
    a.tdsHead.localeCompare(b.tdsHead, undefined, { sensitivity: 'base' }),
  )
}

function rowStatusClass(status) {
  if (status === STATUS_NEW) return 'tds-workings__row--new'
  if (status === STATUS_MISSING) return 'tds-workings__row--missing'
  if (status === STATUS_DELETED) return 'tds-workings__row--deleted'
  return ''
}

function canMatchExpense(row) {
  if (!row?.source_id || row.in_daybook === false) return false
  return row.status !== STATUS_MISSING && row.status !== STATUS_DELETED
}

const summaryColGroup = (
  <colgroup>
    <col className="tds-workings__col-head" />
    <col className="tds-workings__col-lines" />
    <col className="tds-workings__col-pan-missing" />
    <col className="tds-workings__col-exp-missing" />
    <col className="tds-workings__col-amount" />
  </colgroup>
)

const summaryPaymentColGroup = (
  <colgroup>
    <col className="tds-workings__col-head" />
    <col className="tds-workings__col-lines" />
    <col className="tds-workings__col-pan-missing" />
    <col className="tds-workings__col-exp-missing" />
    <col className="tds-workings__col-amount" />
    <col className="tds-workings__col-pay-date" />
    <col className="tds-workings__col-pay-pdf" />
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
    <col className="tds-workings__col-action" />
  </colgroup>
)

function SummaryHeaderRow({ showPaymentCols = false }) {
  return (
    <tr>
      <th className="tds-workings__col-head">TDS Head</th>
      <th className="tds-workings__col-lines win-form__table-num">Lines</th>
      <th className="tds-workings__col-pan-missing win-form__table-num">PAN missing</th>
      <th className="tds-workings__col-exp-missing win-form__table-num">Missing exp.</th>
      <th className="tds-workings__col-amount win-form__table-num">Amount</th>
      {showPaymentCols ? (
        <>
          <th
            className="tds-workings__col-pay-date"
            title="Per head; Total row sets common for all"
          >
            Payment Date
          </th>
          <th
            className="tds-workings__col-pay-pdf"
            title="Per head; Total row sets common for all"
          >
            Payment PDF
          </th>
        </>
      ) : null}
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
      <th className="tds-workings__col-action">Action</th>
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
  const [expenseMatchOpen, setExpenseMatchOpen] = useState(false)
  const [expenseMatchLoading, setExpenseMatchLoading] = useState(false)
  const [expenseMatchApplying, setExpenseMatchApplying] = useState(false)
  const [expenseMatch, setExpenseMatch] = useState(null)
  const [expenseMatchSourceId, setExpenseMatchSourceId] = useState(null)
  const [paymentsByHead, setPaymentsByHead] = useState({})
  const [paymentDateDrafts, setPaymentDateDrafts] = useState({})
  const [paymentSavingKey, setPaymentSavingKey] = useState(null)
  const paymentFileRefs = useRef({})
  const commonPaymentFileRef = useRef(null)
  const paymentDateSavedRef = useRef({})

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
  const showPaymentCols = isSummary && !quarter && month !== MONTH_ALL
  const busy = loading || saving || updating || printing || excelLoading
  const hasDiff = newCount > 0 || deletedCount > 0
  const quarterSelected = Boolean(quarter)
  const exportRows = useMemo(() => rows.filter(isActiveRow), [rows])
  const paymentMonth = Number(month)
  const paymentFyStart = Number(fyStart)

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

  useEffect(() => {
    if (!showPaymentCols || !Number.isFinite(paymentFyStart) || !Number.isFinite(paymentMonth)) {
      setPaymentsByHead({})
      setPaymentDateDrafts({})
      paymentDateSavedRef.current = {}
      return undefined
    }

    let cancelled = false
    async function loadPayments() {
      try {
        const items = await fetchTdsHeadPayments({
          fyStart: paymentFyStart,
          month: paymentMonth,
        })
        if (cancelled) return
        const next = {}
        const drafts = {}
        const savedDates = {}
        for (const item of Array.isArray(items) ? items : []) {
          next[item.tds_head] = item
          const dateValue = paymentDateIso(item.payment_date)
          if (item.tds_head === HEAD_COMMON || hasOwnPaymentDate(item)) {
            drafts[item.tds_head] = dateValue
            savedDates[item.tds_head] = dateValue
          }
        }
        setPaymentsByHead(next)
        setPaymentDateDrafts(drafts)
        paymentDateSavedRef.current = savedDates
      } catch (err) {
        if (!cancelled) {
          setPaymentsByHead({})
          setPaymentDateDrafts({})
          paymentDateSavedRef.current = {}
          showError(getApiErrorMessage(err, 'Unable to load payment details'))
        }
      }
    }

    void loadPayments()
    return () => {
      cancelled = true
    }
  }, [showPaymentCols, paymentFyStart, paymentMonth, showError])

  function upsertPayment(item) {
    if (!item?.tds_head) return
    const dateValue = paymentDateIso(item.payment_date)
    setPaymentsByHead((prev) => ({ ...prev, [item.tds_head]: item }))
    setPaymentDateDrafts((prev) => {
      const next = { ...prev }
      if (item.tds_head === HEAD_COMMON || hasOwnPaymentDate(item)) {
        next[item.tds_head] = dateValue
      } else if (item.tds_head !== HEAD_COMMON) {
        delete next[item.tds_head]
      }
      return next
    })
    const savedDates = { ...paymentDateSavedRef.current }
    if (item.tds_head === HEAD_COMMON || hasOwnPaymentDate(item)) {
      savedDates[item.tds_head] = dateValue
    } else {
      delete savedDates[item.tds_head]
    }
    paymentDateSavedRef.current = savedDates
  }

  function displayPaymentDate(headKeyValue) {
    if (Object.prototype.hasOwnProperty.call(paymentDateDrafts, headKeyValue)) {
      return paymentDateDrafts[headKeyValue] ?? ''
    }
    return effectivePaymentDate(headKeyValue, paymentsByHead)
  }

  function onPaymentDateInput(headKeyValue, value) {
    setPaymentDateDrafts((prev) => ({
      ...prev,
      [headKeyValue]: String(value || '').trim(),
    }))
  }

  async function commitPaymentDate(headKeyValue, rawValue) {
    const paymentDate = String(
      rawValue != null ? rawValue : paymentDateDrafts[headKeyValue] ?? '',
    ).trim()
    const ownSaved = Object.prototype.hasOwnProperty.call(
      paymentDateSavedRef.current,
      headKeyValue,
    )
      ? String(paymentDateSavedRef.current[headKeyValue] ?? '').trim()
      : null
    const commonDate = paymentDateIso(paymentsByHead[HEAD_COMMON]?.payment_date)
    const previousDisplayed =
      ownSaved != null ? ownSaved : headKeyValue === HEAD_COMMON ? '' : commonDate

    if (paymentDate === previousDisplayed) {
      if (headKeyValue !== HEAD_COMMON && !ownSaved) {
        setPaymentDateDrafts((prev) => {
          const next = { ...prev }
          delete next[headKeyValue]
          return next
        })
      }
      return
    }

    // Matching common date again → clear individual override so common applies.
    const clearOverride =
      headKeyValue !== HEAD_COMMON &&
      ownSaved != null &&
      paymentDate === commonDate

    const toSave = clearOverride ? null : paymentDate || null
    setPaymentDateDrafts((prev) => ({ ...prev, [headKeyValue]: paymentDate }))

    const savingKey = `${headKeyValue}:date`
    setPaymentSavingKey(savingKey)
    try {
      const savedPayment = await updateTdsHeadPaymentDate({
        fyStart: paymentFyStart,
        month: paymentMonth,
        tdsHead: headKeyValue,
        paymentDate: toSave,
      })
      upsertPayment(savedPayment)
      if (headKeyValue !== HEAD_COMMON && clearOverride) {
        setPaymentDateDrafts((prev) => {
          const next = { ...prev }
          delete next[headKeyValue]
          return next
        })
      }
    } catch (err) {
      if (ownSaved != null) {
        setPaymentDateDrafts((prev) => ({ ...prev, [headKeyValue]: ownSaved }))
      } else {
        setPaymentDateDrafts((prev) => {
          const next = { ...prev }
          delete next[headKeyValue]
          return next
        })
      }
      showError(getApiErrorMessage(err, 'Could not update payment date'))
    } finally {
      setPaymentSavingKey((current) => (current === savingKey ? null : current))
    }
  }

  async function onPaymentPdfSelected(headKeyValue, file) {
    if (!file) return
    if (file.type && file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      showError('Please upload a PDF file.')
      return
    }
    if (file.size > MAX_PAYMENT_PDF_BYTES) {
      showError('PDF must be 1 MB or smaller.')
      return
    }

    const savingKey = `${headKeyValue}:pdf`
    setPaymentSavingKey(savingKey)
    try {
      const savedPayment = await uploadTdsHeadPaymentPdf({
        fyStart: paymentFyStart,
        month: paymentMonth,
        tdsHead: headKeyValue,
        file,
      })
      upsertPayment(savedPayment)
      showSuccess(
        headKeyValue === HEAD_COMMON
          ? 'Common payment PDF uploaded for this month.'
          : 'Payment PDF uploaded.',
      )
    } catch (err) {
      showError(getApiErrorMessage(err, 'Could not upload payment PDF'))
    } finally {
      setPaymentSavingKey(null)
    }
  }

  async function onViewPaymentPdf(headKeyValue) {
    const sourceHead = effectivePdfSourceHead(headKeyValue, paymentsByHead)
    if (!sourceHead) {
      showError('No payment PDF available.')
      return
    }
    setPaymentSavingKey(`${headKeyValue}:view`)
    try {
      const blob = await fetchTdsHeadPaymentPdfBlob({
        fyStart: paymentFyStart,
        month: paymentMonth,
        tdsHead: sourceHead,
      })
      const payment = paymentsByHead[sourceHead]
      closePdfPreview()
      const url = URL.createObjectURL(blob)
      setPdfPreview({
        url,
        fileName: payment?.pdf_filename || `tds-payment-${sourceHead}.pdf`,
        title:
          sourceHead === HEAD_COMMON
            ? 'Payment PDF — Common (this month)'
            : `Payment PDF — ${headLabel(headKeyValue)}`,
      })
    } catch (err) {
      showError(getApiErrorMessage(err, 'Could not open payment PDF'))
    } finally {
      setPaymentSavingKey(null)
    }
  }

  async function onDeletePaymentPdf(headKeyValue) {
    const savingKey = `${headKeyValue}:pdf-del`
    setPaymentSavingKey(savingKey)
    try {
      const savedPayment = await deleteTdsHeadPaymentPdf({
        fyStart: paymentFyStart,
        month: paymentMonth,
        tdsHead: headKeyValue,
      })
      upsertPayment(savedPayment)
      showSuccess(
        headKeyValue === HEAD_COMMON
          ? 'Common payment PDF removed.'
          : 'Payment PDF removed.',
      )
    } catch (err) {
      showError(getApiErrorMessage(err, 'Could not remove payment PDF'))
    } finally {
      setPaymentSavingKey(null)
    }
  }

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

  const totalExpensesMissing = useMemo(
    () => activeFilteredRows.filter(isExpensesMissing).length,
    [activeFilteredRows],
  )

  const totalPanMissing = useMemo(
    () => activeFilteredRows.filter(isPanMissing).length,
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

  function closeExpenseMatchModal() {
    if (expenseMatchApplying) return
    setExpenseMatchOpen(false)
    setExpenseMatch(null)
    setExpenseMatchSourceId(null)
    setExpenseMatchLoading(false)
  }

  function applyCandidateToMatch(prev, candidate) {
    if (!prev || !candidate) return prev
    return {
      ...prev,
      matched: true,
      expenses_date: candidate.voucher_date,
      expenses_amount: candidate.amount,
      candidates: (prev.candidates || []).map((c) => ({
        ...c,
        selected: c.source_id === candidate.source_id,
      })),
    }
  }

  async function onMatchExpense(row) {
    if (!canMatchExpense(row) || busy) return
    setExpenseMatchOpen(true)
    setExpenseMatchLoading(true)
    setExpenseMatch(null)
    setExpenseMatchSourceId(row.source_id)
    try {
      const data = await fetchTdsExpenseMatch(row.source_id)
      setExpenseMatch(data)
    } catch (err) {
      closeExpenseMatchModal()
      showError(getApiErrorMessage(err, 'Unable to match expenses'))
    } finally {
      setExpenseMatchLoading(false)
    }
  }

  function onSelectExpenseCandidate(candidate) {
    setExpenseMatch((prev) => applyCandidateToMatch(prev, candidate))
  }

  async function onApplyExpenseMatch() {
    if (!expenseMatch?.matched || !expenseMatchSourceId || expenseMatchApplying) return
    setExpenseMatchApplying(true)
    try {
      const selected =
        expenseMatch.candidates?.find((c) => c.selected) || expenseMatch.candidates?.[0]
      await applyTdsExpenseMatch({
        sourceId: expenseMatchSourceId,
        expensesDate: expenseMatch.expenses_date,
        expensesAmount: expenseMatch.expenses_amount,
        expenseSourceId: selected?.source_id,
        dateFrom,
        dateTo,
      })
      setRows((prev) =>
        prev.map((row) =>
          row.source_id === expenseMatchSourceId
            ? {
                ...row,
                expenses_date: expenseMatch.expenses_date,
                expenses_amount: expenseMatch.expenses_amount,
              }
            : row,
        ),
      )
      showSuccess(
        saved ? 'Expenses match applied and saved.' : 'Expenses match applied to this row.',
      )
      closeExpenseMatchModal()
    } catch (err) {
      showError(getApiErrorMessage(err, 'Unable to apply expenses match'))
    } finally {
      setExpenseMatchApplying(false)
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
  }${showPaymentCols ? ' tds-workings__table--payment' : ''}`
  const summaryCols = showPaymentCols ? summaryPaymentColGroup : summaryColGroup
  const summaryColSpan = showPaymentCols ? 7 : 5
  const summaryHeader = <SummaryHeaderRow showPaymentCols={showPaymentCols} />

  return (
    <>
      <PdfPreviewModal
        open={printing || Boolean(pdfPreview)}
        title={pdfPreview?.title || exportTitle}
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
      <TdsExpenseMatchModal
        open={expenseMatchOpen}
        loading={expenseMatchLoading}
        match={expenseMatch}
        applying={expenseMatchApplying}
        onClose={closeExpenseMatchModal}
        onApply={() => void onApplyExpenseMatch()}
        onSelectCandidate={onSelectExpenseCandidate}
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
                  ? 'Apply new and missing lines to saved data'
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
              {isSummary ? summaryCols : detailColGroup}
              <thead>{isSummary ? summaryHeader : <DetailHeaderRow />}</thead>
            </table>
          </div>

          <div
            className="tds-workings__table-scroll"
            ref={bodyRef}
            onScroll={(event) => syncHorizontalScroll(event.currentTarget)}
          >
            <table className={tableClass}>
              {isSummary ? summaryCols : detailColGroup}
              <thead aria-hidden="true" className="tds-workings__table-spacer">
                {isSummary ? summaryHeader : <DetailHeaderRow />}
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={isSummary ? summaryColSpan : 7} className="win-form__table-empty">
                      Loading…
                    </td>
                  </tr>
                ) : isSummary ? (
                  summaryRows.length === 0 ? (
                    <tr>
                      <td colSpan={summaryColSpan} className="win-form__table-empty">
                        No TDS Payable journal lines for this period.
                      </td>
                    </tr>
                  ) : (
                    summaryRows.map((group) => {
                      const payment = paymentsByHead[group.key]
                      const paymentDateValue = displayPaymentDate(group.key)
                      const pdfSource = effectivePdfSourceHead(group.key, paymentsByHead)
                      const hasEffectivePdf = Boolean(pdfSource)
                      const hasOwnPdf = hasOwnPaymentPdf(payment)
                      const pdfBusy =
                        paymentSavingKey === `${group.key}:pdf` ||
                        paymentSavingKey === `${group.key}:pdf-del` ||
                        paymentSavingKey === `${group.key}:view`
                      return (
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
                          <td className="tds-workings__col-pan-missing win-form__table-num">
                            {group.panMissing}
                          </td>
                          <td className="tds-workings__col-exp-missing win-form__table-num">
                            {group.expensesMissing}
                          </td>
                          <td className="tds-workings__col-amount win-form__table-num">
                            {formatValue(group.amount)}
                          </td>
                          {showPaymentCols ? (
                            <>
                              <td
                                className="tds-workings__col-pay-date"
                                onMouseDown={(e) => e.stopPropagation()}
                                onClick={(e) => e.stopPropagation()}
                                onKeyDown={(e) => e.stopPropagation()}
                              >
                                <FormInput
                                  type="date"
                                  value={paymentDateValue}
                                  disabled={busy}
                                  onChange={(e) =>
                                    onPaymentDateInput(group.key, e.target.value)
                                  }
                                  onBlur={(e) =>
                                    void commitPaymentDate(group.key, e.target.value)
                                  }
                                  aria-label={`Payment date for ${group.tdsHead}`}
                                  title={
                                    hasOwnPaymentDate(payment)
                                      ? 'Individual payment date'
                                      : 'Using common month payment date (edit to override)'
                                  }
                                />
                              </td>
                              <td
                                className="tds-workings__col-pay-pdf"
                                onClick={(e) => e.stopPropagation()}
                                onKeyDown={(e) => e.stopPropagation()}
                              >
                                <div className="tds-workings__pay-pdf">
                                  <input
                                    ref={(el) => {
                                      paymentFileRefs.current[group.key] = el
                                    }}
                                    type="file"
                                    accept="application/pdf,.pdf"
                                    className="sr-only"
                                    tabIndex={-1}
                                    onChange={(e) => {
                                      const file = e.target.files?.[0]
                                      e.target.value = ''
                                      void onPaymentPdfSelected(group.key, file)
                                    }}
                                  />
                                  <button
                                    type="button"
                                    className="tds-workings__pay-pdf-btn"
                                    disabled={busy || pdfBusy}
                                    aria-label={
                                      hasOwnPdf
                                        ? `Replace payment PDF for ${group.tdsHead}`
                                        : `Upload payment PDF for ${group.tdsHead}`
                                    }
                                    title={
                                      hasOwnPdf
                                        ? 'Replace individual PDF'
                                        : 'Upload individual PDF (overrides common)'
                                    }
                                    onClick={() =>
                                      paymentFileRefs.current[group.key]?.click()
                                    }
                                  >
                                    {pdfBusy && paymentSavingKey === `${group.key}:pdf`
                                      ? <ArrowPathIcon className="size-4 animate-spin" aria-hidden="true" />
                                      : hasOwnPdf
                                        ? <ArrowPathIcon className="size-4" aria-hidden="true" />
                                        : <ArrowUpTrayIcon className="size-4" aria-hidden="true" />}
                                  </button>
                                  {hasEffectivePdf ? (
                                    <button
                                      type="button"
                                      className="tds-workings__pay-pdf-btn"
                                      disabled={busy || pdfBusy}
                                      aria-label={`View payment PDF for ${group.tdsHead}`}
                                      title={
                                        hasOwnPdf
                                          ? payment.pdf_filename || 'View PDF'
                                          : 'View common month PDF'
                                      }
                                      onClick={() => void onViewPaymentPdf(group.key)}
                                    >
                                      <EyeIcon className="size-4" aria-hidden="true" />
                                    </button>
                                  ) : null}
                                  {hasOwnPdf ? (
                                    <button
                                      type="button"
                                      className="tds-workings__pay-pdf-btn tds-workings__pay-pdf-btn--danger"
                                      disabled={busy || pdfBusy}
                                      aria-label={`Remove payment PDF for ${group.tdsHead}`}
                                      title="Remove individual PDF (common will apply if set)"
                                      onClick={() => void onDeletePaymentPdf(group.key)}
                                    >
                                      <TrashIcon className="size-4" aria-hidden="true" />
                                    </button>
                                  ) : null}
                                </div>
                              </td>
                            </>
                          ) : null}
                        </tr>
                      )
                    })
                  )
                ) : filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="win-form__table-empty">
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
                          : row.status === STATUS_MISSING
                            ? 'Removed from Tally — expenses not matched'
                            : row.status === STATUS_DELETED
                              ? 'Deleted from Tally — still in saved data'
                              : row.in_daybook === false
                                ? 'Saved with matched expenses (no longer in Tally daybook)'
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
                      <td className="tds-workings__col-action">
                        {!canMatchExpense(row) ? (
                          '—'
                        ) : (
                          <button
                            type="button"
                            className="tds-workings__match-btn"
                            disabled={busy}
                            title="Match expenses from Cr transactions"
                            aria-label="Match expenses"
                            onClick={() => void onMatchExpense(row)}
                          >
                            <LinkIcon className="size-4" aria-hidden="true" />
                          </button>
                        )}
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
                {isSummary ? summaryCols : detailColGroup}
                <thead aria-hidden="true" className="tds-workings__table-spacer">
                  {isSummary ? summaryHeader : <DetailHeaderRow />}
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
                      <td className="tds-workings__col-pan-missing win-form__table-num">
                        {totalPanMissing}
                      </td>
                      <td className="tds-workings__col-exp-missing win-form__table-num">
                        {totalExpensesMissing}
                      </td>
                      <td className="tds-workings__col-amount win-form__table-num">
                        {formatValue(totalAmount)}
                      </td>
                      {showPaymentCols ? (
                        <>
                          <td className="tds-workings__col-pay-date">
                            <FormInput
                              type="date"
                              value={displayPaymentDate(HEAD_COMMON)}
                              disabled={busy}
                              onChange={(e) =>
                                onPaymentDateInput(HEAD_COMMON, e.target.value)
                              }
                              onBlur={(e) =>
                                void commitPaymentDate(HEAD_COMMON, e.target.value)
                              }
                              aria-label="Common payment date for all TDS heads this month"
                              title="Common for all heads (unless set individually)"
                            />
                          </td>
                          <td className="tds-workings__col-pay-pdf">
                            <div className="tds-workings__pay-pdf">
                              <input
                                ref={commonPaymentFileRef}
                                type="file"
                                accept="application/pdf,.pdf"
                                className="sr-only"
                                tabIndex={-1}
                                onChange={(e) => {
                                  const file = e.target.files?.[0]
                                  e.target.value = ''
                                  void onPaymentPdfSelected(HEAD_COMMON, file)
                                }}
                              />
                              <button
                                type="button"
                                className="tds-workings__pay-pdf-btn"
                                disabled={
                                  busy ||
                                  paymentSavingKey === `${HEAD_COMMON}:pdf` ||
                                  paymentSavingKey === `${HEAD_COMMON}:pdf-del` ||
                                  paymentSavingKey === `${HEAD_COMMON}:view`
                                }
                                aria-label={
                                  paymentsByHead[HEAD_COMMON]?.has_pdf
                                    ? 'Replace common payment PDF'
                                    : 'Upload common payment PDF'
                                }
                                title="Upload common payment PDF for this month (max 1 MB)"
                                onClick={() => commonPaymentFileRef.current?.click()}
                              >
                                {paymentSavingKey === `${HEAD_COMMON}:pdf`
                                  ? <ArrowPathIcon className="size-4 animate-spin" aria-hidden="true" />
                                  : paymentsByHead[HEAD_COMMON]?.has_pdf
                                    ? <ArrowPathIcon className="size-4" aria-hidden="true" />
                                    : <ArrowUpTrayIcon className="size-4" aria-hidden="true" />}
                              </button>
                              {paymentsByHead[HEAD_COMMON]?.has_pdf ? (
                                <>
                                  <button
                                    type="button"
                                    className="tds-workings__pay-pdf-btn"
                                    disabled={
                                      busy || paymentSavingKey === `${HEAD_COMMON}:view`
                                    }
                                    aria-label="View common payment PDF"
                                    title={
                                      paymentsByHead[HEAD_COMMON]?.pdf_filename ||
                                      'View common payment PDF'
                                    }
                                    onClick={() => void onViewPaymentPdf(HEAD_COMMON)}
                                  >
                                    <EyeIcon className="size-4" aria-hidden="true" />
                                  </button>
                                  <button
                                    type="button"
                                    className="tds-workings__pay-pdf-btn tds-workings__pay-pdf-btn--danger"
                                    disabled={
                                      busy || paymentSavingKey === `${HEAD_COMMON}:pdf-del`
                                    }
                                    aria-label="Remove common payment PDF"
                                    title="Remove common payment PDF"
                                    onClick={() => void onDeletePaymentPdf(HEAD_COMMON)}
                                  >
                                    <TrashIcon className="size-4" aria-hidden="true" />
                                  </button>
                                </>
                              ) : null}
                            </div>
                          </td>
                        </>
                      ) : null}
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
                      <td className="tds-workings__col-action" />
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
