import { useEffect, useMemo, useRef, useState } from 'react'
import { fetchStockAnalysisSales } from '../api/tally'
import { FormattedNumberInput } from '../components/form/FormattedNumberInput'
import { FormField, FormInput, FormSelect } from '../components/form/FormPanel'
import { useFormMessage } from '../components/form/FormMessage'
import { PrimaryContentLayout } from '../components/layout/PrimaryContentLayout'
import { defaultOridYieldPcts, ORID_YIELD_GROUPS } from '../constants/oridRawYield'
import { todayIsoDate } from '../utils/formatDate'
import { formatCommaNumber, formatQty } from '../utils/formatNumber'
import { getApiErrorMessage } from '../utils/formValidation'
import {
  applyOridRawConversion,
  isOridYieldGroup,
} from '../utils/stockAnalysisOridConversion'

const BASE_COL_COUNT = 8

const SALES_DAYS_WINDOW = 30
const SALES_UPLIFT_PCT = 0.1

const COMMODITY_FILTERS = [
  { value: '', label: 'All' },
  { value: 'orid', label: 'Orid' },
  { value: 'toor', label: 'Toor' },
  { value: 'moong', label: 'Moong' },
]

const tableClass = 'win-form__table win-form__table--bordered stock-analysis__table w-full text-sm'

function TableColGroup({ showConversion }) {
  return (
    <colgroup>
      <col className="stock-analysis__col-group" />
      {showConversion ? <col className="stock-analysis__col-conv" /> : null}
      <col className="stock-analysis__col-qtl" />
      <col className="stock-analysis__col-qtl" />
      <col className="stock-analysis__col-qtl" />
      <col className="stock-analysis__col-qtl" />
      <col className="stock-analysis__col-days" />
      <col className="stock-analysis__col-days" />
      <col className="stock-analysis__col-days" />
    </colgroup>
  )
}

/** Days of stock at the last-30-days sales run rate. */
function salesDaysFromLast30(closingQuintals, last30Quintals) {
  const closing = Number(closingQuintals) || 0
  const last30 = Number(last30Quintals) || 0
  if (last30 <= 0) return null
  return (closing / last30) * SALES_DAYS_WINDOW
}

/** Days of stock at the average monthly sales (3-month avg column). */
function salesDaysFromMonthlyAvg(closingQuintals, monthlyAvgQuintals) {
  const closing = Number(closingQuintals) || 0
  const monthlyAvg = Number(monthlyAvgQuintals) || 0
  if (monthlyAvg <= 0) return null
  return (closing / monthlyAvg) * SALES_DAYS_WINDOW
}

/** Days of stock if 3-month avg monthly sales were higher by the given fraction. */
function salesDaysFromMonthlyAvgUplift(
  closingQuintals,
  monthlyAvgQuintals,
  uplift = SALES_UPLIFT_PCT,
) {
  const monthlyAvg = Number(monthlyAvgQuintals) || 0
  if (monthlyAvg <= 0) return null
  return salesDaysFromMonthlyAvg(closingQuintals, monthlyAvg * (1 + uplift))
}

function formatSalesDays(value) {
  if (value == null || !Number.isFinite(value)) return '—'
  return formatCommaNumber(value, 1)
}

function yieldPctDraftValue(value) {
  if (value == null || value === '') return ''
  const num = Number(value)
  return Number.isFinite(num) ? String(num) : ''
}

function parseYieldPctDraft(value) {
  if (value === '' || value == null || value === '-') return 0
  const num = Number.parseFloat(String(value).replace(/,/g, ''))
  return Number.isFinite(num) ? Math.max(0, num) : 0
}

function QuintalCell({ value }) {
  return (
    <td className="win-form__table-num">
      <span className="win-form__table-readonly">{formatQty(value)}</span>
    </td>
  )
}

function SalesDaysCell({ value }) {
  return (
    <td className="win-form__table-num">
      <span className="win-form__table-readonly">{formatSalesDays(value)}</span>
    </td>
  )
}

function rowGroupLabel(row) {
  return row?.stock_group || row?.stock_item || 'Unmapped'
}

function matchesCommodityFilter(stockGroup, commodity) {
  const key = (commodity || '').trim().toLowerCase()
  if (!key) return true
  const name = String(stockGroup || '').toLowerCase()
  return name.includes(key)
}

function sumQuintals(rows, field) {
  return rows.reduce((total, row) => total + (Number(row?.[field]?.quintals) || 0), 0)
}

function HeaderRow({ avgMonths, showConversion }) {
  return (
    <tr>
      <th>Stock group</th>
      {showConversion ? <th className="win-form__table-num">Conv %</th> : null}
      <th className="win-form__table-num">Closing qtl</th>
      <th className="win-form__table-num">Closing 4w avg qtl</th>
      <th className="win-form__table-num">Last 30 days qtl</th>
      <th className="win-form__table-num">Avg {avgMonths} months qtl</th>
      <th className="win-form__table-num">Sales days (30d)</th>
      <th className="win-form__table-num">Sales days (3 mo)</th>
      <th className="win-form__table-num">Sales days (3 mo +10%)</th>
    </tr>
  )
}

function ConversionCell({ group, value, disabled, onChange }) {
  if (!isOridYieldGroup(group)) {
    return <td className="win-form__table-num" />
  }

  return (
    <td className="win-form__table-num stock-analysis__conversion">
      <FormattedNumberInput
        value={yieldPctDraftValue(value)}
        fractionDigits={2}
        disabled={disabled}
        selectOnFocus
        aria-label={`Conversion percent for ${group}`}
        onChange={(draft) => onChange(group, draft)}
      />
    </td>
  )
}

function DataRow({ row, showConversion, yieldPcts, loading, onYieldChange }) {
  const group = rowGroupLabel(row)

  return (
    <tr>
      <td className="stock-analysis__group">{group}</td>
      {showConversion ? (
        <ConversionCell
          group={group}
          value={yieldPcts[group]}
          disabled={loading}
          onChange={onYieldChange}
        />
      ) : null}
      <QuintalCell value={row.closing?.quintals} />
      <QuintalCell value={row.closing_4w_ma?.quintals} />
      <QuintalCell value={row.last_30_days?.quintals} />
      <QuintalCell value={row.avg_3_months?.quintals} />
      <SalesDaysCell
        value={salesDaysFromLast30(row.closing?.quintals, row.last_30_days?.quintals)}
      />
      <SalesDaysCell
        value={salesDaysFromMonthlyAvg(row.closing?.quintals, row.avg_3_months?.quintals)}
      />
      <SalesDaysCell
        value={salesDaysFromMonthlyAvgUplift(
          row.closing?.quintals,
          row.avg_3_months?.quintals,
        )}
      />
    </tr>
  )
}

export function StockAnalysisPage() {
  const { showError } = useFormMessage()
  const [analysis, setAnalysis] = useState(null)
  const [loading, setLoading] = useState(true)
  const [asOf, setAsOf] = useState(todayIsoDate)
  const [commodity, setCommodity] = useState('')
  const [oridYieldPcts, setOridYieldPcts] = useState(defaultOridYieldPcts)

  const headRef = useRef(null)
  const bodyRef = useRef(null)
  const footRef = useRef(null)
  const syncing = useRef(false)

  const showConversion = commodity === 'orid'
  const colCount = showConversion ? BASE_COL_COUNT + 1 : BASE_COL_COUNT

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void fetchStockAnalysisSales({ asOf })
      .then((data) => {
        if (!cancelled) setAnalysis(data)
      })
      .catch((err) => {
        if (!cancelled) {
          setAnalysis(null)
          showError(getApiErrorMessage(err, 'Unable to load stock analysis'))
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [asOf, showError])

  function syncHorizontalScroll(source) {
    if (syncing.current) return
    syncing.current = true
    const left = source.scrollLeft
    if (headRef.current && headRef.current !== source) headRef.current.scrollLeft = left
    if (bodyRef.current && bodyRef.current !== source) bodyRef.current.scrollLeft = left
    if (footRef.current && footRef.current !== source) footRef.current.scrollLeft = left
    syncing.current = false
  }

  function onYieldChange(group, draft) {
    setOridYieldPcts((current) => ({
      ...current,
      [group]: parseYieldPctDraft(draft),
    }))
  }

  const allRows = analysis?.rows ?? []
  const preparedRows = useMemo(() => {
    if (!showConversion) return allRows
    return applyOridRawConversion(allRows, oridYieldPcts)
  }, [allRows, oridYieldPcts, showConversion])

  const rows = useMemo(
    () => preparedRows.filter((row) => matchesCommodityFilter(rowGroupLabel(row), commodity)),
    [preparedRows, commodity],
  )

  const totals = useMemo(() => {
    if (commodity === '' && analysis && !showConversion) {
      return {
        closing: Number(analysis.closing_totals?.quintals) || 0,
        closing_4w_ma: Number(analysis.closing_4w_ma_totals?.quintals) || 0,
        last_30_days: Number(analysis.last_30_days_totals?.quintals) || 0,
        avg_3_months: Number(analysis.avg_3_months_totals?.quintals) || 0,
      }
    }
    return {
      closing: sumQuintals(rows, 'closing'),
      closing_4w_ma: sumQuintals(rows, 'closing_4w_ma'),
      last_30_days: sumQuintals(rows, 'last_30_days'),
      avg_3_months: sumQuintals(rows, 'avg_3_months'),
    }
  }, [analysis, commodity, rows, showConversion])

  const totalYieldPct = useMemo(
    () => ORID_YIELD_GROUPS.reduce((sum, group) => sum + (Number(oridYieldPcts[group]) || 0), 0),
    [oridYieldPcts],
  )

  const totalSalesDays30 = useMemo(
    () => salesDaysFromLast30(totals.closing, totals.last_30_days),
    [totals.closing, totals.last_30_days],
  )
  const totalSalesDays3Mo = useMemo(
    () => salesDaysFromMonthlyAvg(totals.closing, totals.avg_3_months),
    [totals.closing, totals.avg_3_months],
  )
  const totalSalesDaysUplift = useMemo(
    () => salesDaysFromMonthlyAvgUplift(totals.closing, totals.avg_3_months),
    [totals.closing, totals.avg_3_months],
  )
  const showFooter = !loading && rows.length > 0
  const avgMonths = analysis?.avg_3_months_months || 3
  const activeFilter = COMMODITY_FILTERS.find((opt) => opt.value === commodity)?.label || 'All'

  return (
    <PrimaryContentLayout
      breadcrumb={[{ label: 'Reports' }, { label: 'Stock Analysis' }]}
      title="Stock Analysis"
    >
      <div className="recv-toolbar shrink-0">
        <div className="grid min-w-0 flex-1 grid-cols-2 gap-x-3 lg:max-w-md">
          <FormField label="As of">
            <FormInput
              type="date"
              value={asOf}
              onChange={(e) => setAsOf(e.target.value)}
              disabled={loading}
            />
          </FormField>
          <FormField label="Commodity">
            <FormSelect
              value={commodity}
              onChange={(e) => setCommodity(e.target.value)}
              disabled={loading}
            >
              {COMMODITY_FILTERS.map((opt) => (
                <option key={opt.value || 'all'} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </FormSelect>
          </FormField>
        </div>
      </div>

      <div className="stock-analysis__table-wrap mt-1">
        <div
          className="stock-analysis__table-head"
          ref={headRef}
          onScroll={(event) => syncHorizontalScroll(event.currentTarget)}
        >
          <table className={tableClass}>
            <TableColGroup showConversion={showConversion} />
            <thead>
              <HeaderRow avgMonths={avgMonths} showConversion={showConversion} />
            </thead>
          </table>
        </div>

        <div
          className="stock-analysis__table-scroll"
          ref={bodyRef}
          onScroll={(event) => syncHorizontalScroll(event.currentTarget)}
        >
          <table className={tableClass}>
            <TableColGroup showConversion={showConversion} />
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={colCount} className="win-form__table-empty">
                    Loading…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={colCount} className="win-form__table-empty">
                    {commodity
                      ? `No stock or sales data for ${activeFilter}.`
                      : 'No stock or sales data found.'}
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <DataRow
                    key={rowGroupLabel(row)}
                    row={row}
                    showConversion={showConversion}
                    yieldPcts={oridYieldPcts}
                    loading={loading}
                    onYieldChange={onYieldChange}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>

        {showFooter ? (
          <div
            className="stock-analysis__table-foot"
            ref={footRef}
            onScroll={(event) => syncHorizontalScroll(event.currentTarget)}
          >
            <table className={tableClass}>
              <TableColGroup showConversion={showConversion} />
              <tbody>
                <tr>
                  <td>
                    <span className="win-form__table-total-label">
                      Total ({rows.length} groups)
                    </span>
                  </td>
                  {showConversion ? (
                    <td className="win-form__table-num">
                      <span className="win-form__table-readonly">
                        {formatCommaNumber(totalYieldPct, 1)}
                      </span>
                    </td>
                  ) : null}
                  <QuintalCell value={totals.closing} />
                  <QuintalCell value={totals.closing_4w_ma} />
                  <QuintalCell value={totals.last_30_days} />
                  <QuintalCell value={totals.avg_3_months} />
                  <SalesDaysCell value={totalSalesDays30} />
                  <SalesDaysCell value={totalSalesDays3Mo} />
                  <SalesDaysCell value={totalSalesDaysUplift} />
                </tr>
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </PrimaryContentLayout>
  )
}
