import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  fetchBrokerage,
  fetchBrokerageBrokers,
  saveBrokerageRates,
} from '../api/brokerage'
import { fetchCompany } from '../api/company'
import { PdfPreviewModal } from '../components/common/PdfPreviewModal'
import { FormDropdown } from '../components/form/FormDropdown'
import { FormattedNumberInput } from '../components/form/FormattedNumberInput'
import { FormField } from '../components/form/FormPanel'
import { useFormMessage } from '../components/form/FormMessage'
import { PrimaryContentLayout } from '../components/layout/PrimaryContentLayout'
import {
  FY_MONTHS,
  currentFinancialYearStart,
  financialYearOptions,
} from '../utils/financialYear'
import { createBrokeragePdfBlob } from '../utils/brokeragePdf'
import { formatQty, formatValue } from '../utils/formatNumber'
import { getApiErrorMessage } from '../utils/formValidation'

const SIDE_SALE = 'sale'
const SIDE_PURCHASE = 'purchase'
const COL_COUNT = 8

function currentMonthValue() {
  return String(new Date().getMonth() + 1)
}

function rateKey(side, stockItem) {
  return `${side}::${stockItem}`
}

function rateDraftValue(value) {
  if (value == null || value === '') return ''
  const num = Number(value)
  return Number.isFinite(num) ? String(num) : ''
}

/** Empty when zero. Adjust is a non-negative whole number (subtract only). */
function adjustDraftValue(value) {
  if (value == null || value === '') return ''
  const num = Math.abs(Math.trunc(Number(value)))
  if (!Number.isFinite(num) || num === 0) return ''
  return String(num)
}

function parseDraftNumber(value) {
  if (value === '' || value == null || value === '-') return null
  const num = Number(value)
  return Number.isFinite(num) ? num : null
}

/** Non-negative whole-number adjust amount used for subtraction. */
function parseAdjustDraft(value) {
  const num = parseDraftNumber(value)
  if (num == null) return 0
  return Math.max(0, Math.trunc(num))
}

function adjustedQty(qty, adjust) {
  return (Number(qty) || 0) - (Number.isFinite(adjust) ? adjust : 0)
}

function effectiveQuintals(row, adjust) {
  const qty = Number(row.qty) || 0
  const baseQuintals = Number(row.quintals) || 0
  const adj = Number.isFinite(adjust) ? adjust : 0
  if (qty === 0) return 0
  return baseQuintals * (adjustedQty(qty, adj) / qty)
}

function emptySection(side) {
  return {
    side,
    rows: [],
    total_qty: 0,
    total_quintals: 0,
    total_brokerage: 0,
  }
}

function sideLabel(side) {
  return side === SIDE_PURCHASE ? 'Purchase' : 'Sales'
}

function sortRowsByTypeThenItem(rows) {
  return [...rows].sort((a, b) => {
    const sideOrder = (side) => (side === SIDE_SALE ? 0 : 1)
    const typeCmp = sideOrder(a.side) - sideOrder(b.side)
    if (typeCmp !== 0) return typeCmp
    return String(a.stock_item).localeCompare(String(b.stock_item), undefined, {
      sensitivity: 'base',
    })
  })
}

function combineRows(sales, purchases) {
  const saleRows = (sales?.rows || []).map((row) => ({
    ...row,
    side: SIDE_SALE,
  }))
  const purchaseRows = (purchases?.rows || []).map((row) => ({
    ...row,
    side: SIDE_PURCHASE,
  }))
  return sortRowsByTypeThenItem([...saleRows, ...purchaseRows])
}

const tableColGroup = (
  <colgroup>
    <col className="brokerage__col-type" />
    <col className="brokerage__col-item" />
    <col className="brokerage__col-qty" />
    <col className="brokerage__col-adjust" />
    <col className="brokerage__col-adj-qty" />
    <col className="brokerage__col-qtl" />
    <col className="brokerage__col-rate" />
    <col className="brokerage__col-amount" />
  </colgroup>
)

function HeaderRow() {
  return (
    <tr>
      <th className="brokerage__col-type">Type</th>
      <th className="brokerage__col-item">Stock Item</th>
      <th className="brokerage__col-qty win-form__table-num">Qty</th>
      <th className="brokerage__col-adjust win-form__table-num">Adjust</th>
      <th className="brokerage__col-adj-qty win-form__table-num">Adjusted Qty</th>
      <th className="brokerage__col-qtl win-form__table-num">Quintals</th>
      <th className="brokerage__col-rate win-form__table-num">Rate / Qtl</th>
      <th className="brokerage__col-amount win-form__table-num">Brokerage</th>
    </tr>
  )
}

export function BrokeragePage() {
  const { showError, showSuccess } = useFormMessage()
  const fyOptions = useMemo(
    () =>
      financialYearOptions(5).map((opt) => ({
        value: String(opt.value),
        label: opt.label,
      })),
    [],
  )
  const monthOptions = useMemo(
    () => FY_MONTHS.map((m) => ({ value: String(m.value), label: m.label })),
    [],
  )

  const [fyStart, setFyStart] = useState(() => String(currentFinancialYearStart()))
  const [month, setMonth] = useState(currentMonthValue)
  const [broker, setBroker] = useState('')
  const [brokers, setBrokers] = useState([])
  const [sales, setSales] = useState(() => emptySection(SIDE_SALE))
  const [purchases, setPurchases] = useState(() => emptySection(SIDE_PURCHASE))
  const [rateDrafts, setRateDrafts] = useState({})
  const [adjustDrafts, setAdjustDrafts] = useState({})
  const [tdsPercentDraft, setTdsPercentDraft] = useState('')
  const [defaultBrokerageTdsPct, setDefaultBrokerageTdsPct] = useState(null)
  const [loadingBrokers, setLoadingBrokers] = useState(false)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [printing, setPrinting] = useState(false)
  const [pdfPreview, setPdfPreview] = useState(null)

  const headRef = useRef(null)
  const bodyRef = useRef(null)
  const footRef = useRef(null)
  const syncing = useRef(false)

  const busy = loading || saving || loadingBrokers || printing
  const paymentFyStart = Number(fyStart)
  const paymentMonth = Number(month)

  const brokerOptions = useMemo(
    () => brokers.map((name) => ({ value: name, label: name })),
    [brokers],
  )

  const rows = useMemo(() => combineRows(sales, purchases), [sales, purchases])
  const canPrint = Boolean(broker && rows.length > 0)
  const firstPurchaseIndex = useMemo(
    () => rows.findIndex((row) => row.side === SIDE_PURCHASE),
    [rows],
  )
  const showTypeDivider =
    firstPurchaseIndex > 0 && rows.some((row) => row.side === SIDE_SALE)
  const showFooter = rows.length > 0

  const totals = useMemo(() => {
    let totalQty = 0
    let totalAdjust = 0
    let totalAdjustedQty = 0
    let totalQuintals = 0
    let totalBrokerage = 0
    for (const row of rows) {
      const qty = Number(row.qty) || 0
      const key = rateKey(row.side, row.stock_item)
      const adjust = parseAdjustDraft(adjustDrafts[key])
      const adjQty = adjustedQty(qty, adjust)
      const quintals = effectiveQuintals(row, adjust)
      totalQty += qty
      totalAdjust += adjust
      totalAdjustedQty += adjQty
      totalQuintals += quintals
      const rate = parseDraftNumber(rateDrafts[key])
      if (rate != null) totalBrokerage += quintals * rate
    }
    const tdsPercent = parseDraftNumber(tdsPercentDraft)
    const tdsAmount =
      tdsPercent != null ? (totalBrokerage * tdsPercent) / 100 : 0
    const netBrokerage = totalBrokerage - tdsAmount
    return {
      totalQty,
      totalAdjust,
      totalAdjustedQty,
      totalQuintals,
      totalBrokerage,
      tdsPercent,
      tdsAmount,
      netBrokerage,
    }
  }, [rows, rateDrafts, adjustDrafts, tdsPercentDraft])

  const printRows = useMemo(
    () =>
      rows.map((row) => {
        const key = rateKey(row.side, row.stock_item)
        const adjust = parseAdjustDraft(adjustDrafts[key])
        const rate = parseDraftNumber(rateDrafts[key])
        const qty = Number(row.qty) || 0
        const adjQty = adjustedQty(qty, adjust)
        const quintals = effectiveQuintals(row, adjust)
        return {
          sideLabel: sideLabel(row.side),
          stockItem: row.stock_item,
          adjustedQty: adjQty,
          quintals,
          rate,
          brokerage: rate != null ? quintals * rate : 0,
        }
      }),
    [rows, rateDrafts, adjustDrafts],
  )

  const applyWorkings = useCallback((data, companyDefaultTds) => {
    const nextSales = data?.sales || emptySection(SIDE_SALE)
    const nextPurchases = data?.purchases || emptySection(SIDE_PURCHASE)
    setSales(nextSales)
    setPurchases(nextPurchases)
    const nextRates = {}
    const nextAdjusts = {}
    for (const row of nextSales.rows || []) {
      const key = rateKey(SIDE_SALE, row.stock_item)
      nextRates[key] = rateDraftValue(row.rate_per_quintal)
      nextAdjusts[key] = adjustDraftValue(row.qty_adjust)
    }
    for (const row of nextPurchases.rows || []) {
      const key = rateKey(SIDE_PURCHASE, row.stock_item)
      nextRates[key] = rateDraftValue(row.rate_per_quintal)
      nextAdjusts[key] = adjustDraftValue(row.qty_adjust)
    }
    setRateDrafts(nextRates)
    setAdjustDrafts(nextAdjusts)
    const savedTds = data?.tds_percent
    const fallbackTds =
      companyDefaultTds !== undefined ? companyDefaultTds : defaultBrokerageTdsPct
    setTdsPercentDraft(
      savedTds != null && savedTds !== ''
        ? rateDraftValue(savedTds)
        : rateDraftValue(fallbackTds),
    )
  }, [defaultBrokerageTdsPct])

  const loadBrokers = useCallback(async () => {
    if (!Number.isFinite(paymentFyStart) || !Number.isFinite(paymentMonth)) return
    setLoadingBrokers(true)
    try {
      const data = await fetchBrokerageBrokers({
        fyStart: paymentFyStart,
        month: paymentMonth,
      })
      const names = Array.isArray(data?.brokers) ? data.brokers : []
      setBrokers(names)
      setBroker((current) => (names.includes(current) ? current : ''))
    } catch (err) {
      setBrokers([])
      setBroker('')
      showError(getApiErrorMessage(err, 'Unable to load brokers'))
    } finally {
      setLoadingBrokers(false)
    }
  }, [paymentFyStart, paymentMonth, showError])

  const load = useCallback(async () => {
    if (!broker) {
      applyWorkings(null)
      return
    }
    if (!Number.isFinite(paymentFyStart) || !Number.isFinite(paymentMonth)) return
    setLoading(true)
    try {
      const [company, data] = await Promise.all([
        fetchCompany().catch(() => null),
        fetchBrokerage({
          fyStart: paymentFyStart,
          month: paymentMonth,
          broker,
        }),
      ])
      const companyDefault =
        company?.brokerage_tds_pct == null ? null : company.brokerage_tds_pct
      setDefaultBrokerageTdsPct(companyDefault)
      applyWorkings(data, companyDefault)
    } catch (err) {
      applyWorkings(null)
      showError(getApiErrorMessage(err, 'Unable to load brokerage'))
    } finally {
      setLoading(false)
    }
  }, [applyWorkings, broker, paymentFyStart, paymentMonth, showError])

  useEffect(() => {
    void loadBrokers()
  }, [loadBrokers])

  useEffect(() => {
    void load()
  }, [load])

  function onRateChange(side, stockItem, value) {
    setRateDrafts((prev) => ({
      ...prev,
      [rateKey(side, stockItem)]: value,
    }))
  }

  function onAdjustChange(side, stockItem, value) {
    setAdjustDrafts((prev) => ({
      ...prev,
      [rateKey(side, stockItem)]: value,
    }))
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

  function closePdfPreview() {
    setPdfPreview((current) => {
      if (current?.url) URL.revokeObjectURL(current.url)
      return null
    })
  }

  async function onPrint() {
    if (!canPrint || printing) return
    closePdfPreview()
    setPrinting(true)
    setPdfPreview({ url: '', fileName: '' })
    try {
      const company = await fetchCompany()
      const { blob, fileName } = await createBrokeragePdfBlob({
        company,
        broker,
        fyStart: paymentFyStart,
        month: paymentMonth,
        rows: printRows,
        totalAdjustedQty: totals.totalAdjustedQty,
        totalQuintals: totals.totalQuintals,
        totalBrokerage: totals.totalBrokerage,
        tdsPercent: totals.tdsPercent,
        tdsAmount: totals.tdsAmount,
        netBrokerage: totals.netBrokerage,
      })
      const url = URL.createObjectURL(blob)
      setPdfPreview({ url, fileName })
    } catch (err) {
      closePdfPreview()
      showError(getApiErrorMessage(err, err?.message || 'Could not generate PDF'))
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

  async function onSave() {
    if (!broker || busy) return
    const rates = rows.map((row) => {
      const key = rateKey(row.side, row.stock_item)
      const adjustRaw = adjustDrafts[key]
      const adjust =
        adjustRaw === '' || adjustRaw == null
          ? null
          : parseAdjustDraft(adjustRaw)
      return {
        side: row.side,
        stock_item: row.stock_item,
        rate_per_quintal: parseDraftNumber(rateDrafts[key]),
        qty_adjust: adjust === 0 ? null : adjust,
      }
    })

    setSaving(true)
    try {
      const data = await saveBrokerageRates({
        fyStart: paymentFyStart,
        month: paymentMonth,
        broker,
        rates,
        tdsPercent: parseDraftNumber(tdsPercentDraft),
      })
      applyWorkings(data, defaultBrokerageTdsPct)
      showSuccess('Brokerage rates saved.')
    } catch (err) {
      showError(getApiErrorMessage(err, 'Unable to save brokerage rates'))
    } finally {
      setSaving(false)
    }
  }

  const countLabel = !broker
    ? 'Select a broker to calculate'
    : loading
      ? 'Loading…'
      : `${rows.length} line${rows.length === 1 ? '' : 's'}`

  const tableClass = 'win-form__table brokerage__table'

  return (
    <PrimaryContentLayout
      title="Brokerage"
      breadcrumb={[{ label: 'Transactions' }, { label: 'Brokerage' }]}
      footer={
        <>
          <button
            type="button"
            className="win-form__button"
            disabled={busy || !broker}
            onClick={() => void load()}
          >
            Reload
          </button>
          <button
            type="button"
            className="win-form__button"
            disabled={busy || !canPrint}
            onClick={() => void onPrint()}
          >
            {printing ? 'Printing…' : 'Print'}
          </button>
          <button
            type="button"
            className="win-form__button win-form__button--primary"
            disabled={busy || !broker}
            onClick={() => void onSave()}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </>
      }
    >
      <PdfPreviewModal
        open={printing || Boolean(pdfPreview)}
        title="Brokerage"
        fileName={pdfPreview?.fileName}
        pdfUrl={pdfPreview?.url}
        loading={printing}
        onClose={() => {
          if (!printing) closePdfPreview()
        }}
        onDownload={onDownloadPdf}
      />
      <div className="brokerage">
        <div className="brokerage__toolbar shrink-0">
          <div className="brokerage__filters">
            <FormField label="Financial Year" className="brokerage__field brokerage__field--fy">
              <FormDropdown
                options={fyOptions}
                value={fyStart}
                onChange={setFyStart}
                disabled={busy}
                placeholder="FY"
              />
            </FormField>
            <FormField label="Month" className="brokerage__field brokerage__field--month">
              <FormDropdown
                options={monthOptions}
                value={month}
                onChange={setMonth}
                disabled={busy}
                placeholder="Month"
              />
            </FormField>
            <FormField label="Broker" className="brokerage__field brokerage__field--broker">
              <FormDropdown
                options={brokerOptions}
                value={broker}
                onChange={setBroker}
                disabled={busy}
                placeholder={loadingBrokers ? 'Loading…' : 'Select broker'}
                emptyMessage="No brokers in this month"
              />
            </FormField>
          </div>
          <p className="brokerage__count">{countLabel}</p>
        </div>

        <div className="brokerage__table-wrap">
          <div
            className="brokerage__table-head"
            ref={headRef}
            onScroll={(event) => syncHorizontalScroll(event.currentTarget)}
          >
            <table className={tableClass}>
              {tableColGroup}
              <thead>
                <HeaderRow />
              </thead>
            </table>
          </div>

          <div
            className="brokerage__table-scroll"
            ref={bodyRef}
            onScroll={(event) => syncHorizontalScroll(event.currentTarget)}
          >
            <table className={tableClass}>
              {tableColGroup}
              <thead aria-hidden="true" className="brokerage__table-spacer">
                <HeaderRow />
              </thead>
              <tbody>
                {!broker ? (
                  <tr>
                    <td colSpan={COL_COUNT} className="win-form__table-empty">
                      Select a broker to calculate brokerage.
                    </td>
                  </tr>
                ) : loading ? (
                  <tr>
                    <td colSpan={COL_COUNT} className="win-form__table-empty">
                      Loading…
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={COL_COUNT} className="win-form__table-empty">
                      No sales or purchase lines for this broker in the selected month.
                    </td>
                  </tr>
                ) : (
                  rows.map((row, index) => {
                    const key = rateKey(row.side, row.stock_item)
                    const rateDraft = rateDrafts[key] ?? ''
                    const adjustDraft = adjustDrafts[key] ?? ''
                    const rate = parseDraftNumber(rateDraft)
                    const adjust = parseAdjustDraft(adjustDraft)
                    const adjQty = adjustedQty(row.qty, adjust)
                    const quintals = effectiveQuintals(row, adjust)
                    const amount = rate != null ? quintals * rate : 0
                    const showDivider = showTypeDivider && index === firstPurchaseIndex
                    return (
                      <Fragment key={key}>
                        {showDivider ? (
                          <tr className="brokerage__type-divider" aria-hidden="true">
                            <td colSpan={COL_COUNT} />
                          </tr>
                        ) : null}
                        <tr>
                          <td className="brokerage__col-type">{sideLabel(row.side)}</td>
                          <td className="brokerage__col-item" title={row.stock_item}>
                            {row.stock_item}
                          </td>
                          <td className="brokerage__col-qty win-form__table-num">
                            {formatQty(row.qty)}
                          </td>
                          <td className="brokerage__col-adjust win-form__table-num">
                            <FormattedNumberInput
                              value={adjustDraft}
                              fractionDigits={0}
                              disabled={busy}
                              selectOnFocus
                              aria-label={`Qty adjust for ${sideLabel(row.side)} ${row.stock_item}`}
                              onChange={(value) =>
                                onAdjustChange(row.side, row.stock_item, value)
                              }
                            />
                          </td>
                          <td className="brokerage__col-adj-qty win-form__table-num">
                            {formatQty(adjQty)}
                          </td>
                          <td className="brokerage__col-qtl win-form__table-num">
                            {formatValue(quintals)}
                          </td>
                          <td className="brokerage__col-rate win-form__table-num">
                            <FormattedNumberInput
                              value={rateDraft}
                              fractionDigits={2}
                              disabled={busy}
                              selectOnFocus
                              aria-label={`Rate per quintal for ${sideLabel(row.side)} ${row.stock_item}`}
                              onChange={(value) =>
                                onRateChange(row.side, row.stock_item, value)
                              }
                            />
                          </td>
                          <td className="brokerage__col-amount win-form__table-num">
                            {formatValue(amount)}
                          </td>
                        </tr>
                      </Fragment>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          {showFooter ? (
            <div
              className="brokerage__table-foot"
              ref={footRef}
              onScroll={(event) => syncHorizontalScroll(event.currentTarget)}
            >
              <table className={tableClass}>
                {tableColGroup}
                <thead aria-hidden="true" className="brokerage__table-spacer">
                  <HeaderRow />
                </thead>
                <tbody>
                  <tr>
                    <td className="brokerage__total-label" colSpan={2}>
                      <span className="win-form__table-total-label">Total</span>
                    </td>
                    <td className="brokerage__col-qty win-form__table-num">
                      {formatQty(totals.totalQty)}
                    </td>
                    <td className="brokerage__col-adjust win-form__table-num">
                      {totals.totalAdjust
                        ? formatQty(totals.totalAdjust)
                        : formatQty(0)}
                    </td>
                    <td className="brokerage__col-adj-qty win-form__table-num">
                      {formatQty(totals.totalAdjustedQty)}
                    </td>
                    <td className="brokerage__col-qtl win-form__table-num">
                      {formatValue(totals.totalQuintals)}
                    </td>
                    <td className="brokerage__col-rate" />
                    <td className="brokerage__col-amount win-form__table-num">
                      {formatValue(totals.totalBrokerage)}
                    </td>
                  </tr>
                  <tr>
                    <td className="brokerage__total-label" colSpan={2}>
                      <span className="win-form__table-total-label">TDS %</span>
                    </td>
                    <td className="brokerage__col-qty" />
                    <td className="brokerage__col-adjust" />
                    <td className="brokerage__col-adj-qty" />
                    <td className="brokerage__col-qtl" />
                    <td className="brokerage__col-rate win-form__table-num">
                      <FormattedNumberInput
                        value={tdsPercentDraft}
                        fractionDigits={2}
                        disabled={busy}
                        selectOnFocus
                        aria-label="TDS percent"
                        title="TDS percent"
                        onChange={setTdsPercentDraft}
                      />
                    </td>
                    <td className="brokerage__col-amount win-form__table-num">
                      {totals.tdsAmount
                        ? `-${formatValue(totals.tdsAmount)}`
                        : formatValue(0)}
                    </td>
                  </tr>
                  <tr>
                    <td className="brokerage__total-label" colSpan={2}>
                      <span className="win-form__table-total-label">Net</span>
                    </td>
                    <td className="brokerage__col-qty" />
                    <td className="brokerage__col-adjust" />
                    <td className="brokerage__col-adj-qty" />
                    <td className="brokerage__col-qtl" />
                    <td className="brokerage__col-rate" />
                    <td className="brokerage__col-amount win-form__table-num">
                      {formatValue(totals.netBrokerage)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      </div>
    </PrimaryContentLayout>
  )
}
