import { useEffect, useMemo, useState } from 'react'
import { fetchMonthlySummary } from '../api/reports'
import { FormField, FormSelect } from '../components/form/FormPanel'
import { useFormMessage } from '../components/form/FormMessage'
import { PrimaryContentLayout } from '../components/layout/PrimaryContentLayout'
import {
  FY_MONTHS,
  currentFinancialYearStart,
  financialYearOptions,
} from '../utils/financialYear'
import { formatCommaNumber } from '../utils/formatNumber'
import { getApiErrorMessage } from '../utils/formValidation'

const COL_COUNT = 7
const BAG_TO_QUINTAL = 50 / 100

function calendarYearFor(fyStart, month) {
  const monthNum = Number(month)
  const start = Number(fyStart)
  return monthNum >= 4 ? start : start + 1
}

function numOrZero(value) {
  const x = value == null || value === '' ? 0 : Number(value)
  return Number.isFinite(x) ? x : 0
}

function sumOptional(...values) {
  if (
    !values.some(
      (value) => value != null && value !== '' && Number.isFinite(Number(value)),
    )
  ) {
    return null
  }
  return values.reduce((total, value) => total + numOrZero(value), 0)
}

function rateFromBagsValue(bags, value) {
  const qty = Number(bags)
  const amount = Number(value)
  if (!Number.isFinite(qty) || qty === 0 || !Number.isFinite(amount)) return null
  return Math.round((amount / (qty * BAG_TO_QUINTAL)) * 100) / 100
}

/** Diff % = (sales rate − cost price) / cost price × 100. */
function diffPctFromRates(rate, costPrice) {
  const selling = Number(rate)
  const cost = Number(costPrice)
  if (!Number.isFinite(selling) || !Number.isFinite(cost) || cost === 0) return null
  return Math.round(((selling - cost) / cost) * 10000) / 100
}

function formatQty(qty) {
  if (qty == null || qty === '') return '—'
  return formatCommaNumber(qty, 2)
}

function formatPct(pct) {
  if (pct == null || pct === '') return '—'
  return `${formatCommaNumber(pct, 2)}%`
}

function formatMoney(value) {
  if (value == null || value === '') return '—'
  return formatCommaNumber(value, 2)
}

function MetricRow({
  label,
  qty,
  pct,
  costPrice,
  rate,
  diffPct,
  value,
  emphasis = false,
}) {
  return (
    <tr className={emphasis ? 'monthly-summary__total-row' : undefined}>
      <td>{label}</td>
      <td className="win-form__table-num">{formatQty(qty)}</td>
      <td className="win-form__table-num">{formatPct(pct)}</td>
      <td className="win-form__table-num">{formatMoney(costPrice)}</td>
      <td className="win-form__table-num">{formatMoney(rate)}</td>
      <td
        className={[
          'win-form__table-num',
          diffPct == null || diffPct === ''
            ? ''
            : Number(diffPct) >= 0
              ? 'monthly-summary__diff--pos'
              : 'monthly-summary__diff--neg',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {formatPct(diffPct)}
      </td>
      <td className="win-form__table-num">{formatMoney(value)}</td>
    </tr>
  )
}

/** Weighted cost rate from production + purchase qty/value (50kg bags). */
function costPriceFromSources(...pairs) {
  const qtys = []
  const values = []
  for (const [qty, value] of pairs) {
    qtys.push(qty)
    values.push(value)
  }
  return rateFromBagsValue(sumOptional(...qtys), sumOptional(...values))
}

function SectionRow({ label }) {
  return (
    <tr className="monthly-summary__section-row">
      <td colSpan={COL_COUNT}>{label}</td>
    </tr>
  )
}

export function MonthlySummaryPage() {
  const { showError } = useFormMessage()
  const yearOptions = useMemo(() => financialYearOptions(8), [])
  const [financialYear, setFinancialYear] = useState(() => currentFinancialYearStart())
  const [month, setMonth] = useState(() => new Date().getMonth() + 1)
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)

  const calendarYear = calendarYearFor(financialYear, month)
  const orid = summary?.orid_production
  const lotCount = Number(orid?.lot_count) || 0
  const hasPurchases = [
    orid?.purchase_orid_dhall_qty,
    orid?.purchase_orid_dhall_split_qty,
  ].some((value) => value != null && Number(value) !== 0)
  const hasSales = [
    orid?.sales_orid_dhall_qty,
    orid?.sales_orid_dhall_split_qty,
    orid?.sales_orid_rejection_qty,
  ].some((value) => value != null && Number(value) !== 0)
  const showRows = lotCount > 0 || hasPurchases || hasSales
  const purchaseTotalQty = sumOptional(
    orid?.purchase_orid_dhall_qty,
    orid?.purchase_orid_dhall_split_qty,
  )
  const purchaseTotalValue = sumOptional(
    orid?.purchase_orid_dhall_value,
    orid?.purchase_orid_dhall_split_value,
  )
  const purchaseTotalRate = rateFromBagsValue(purchaseTotalQty, purchaseTotalValue)
  const purchaseTotalDiffPct = diffPctFromRates(
    orid?.overall_rate,
    purchaseTotalRate,
  )
  const salesTotalQty = sumOptional(
    orid?.sales_orid_dhall_qty,
    orid?.sales_orid_dhall_split_qty,
    orid?.sales_orid_rejection_qty,
  )
  const salesTotalValue = sumOptional(
    orid?.sales_orid_dhall_value,
    orid?.sales_orid_dhall_split_value,
    orid?.sales_orid_rejection_value,
  )
  const salesTotalRate = rateFromBagsValue(salesTotalQty, salesTotalValue)
  const salesDhallCostPrice = costPriceFromSources(
    [orid?.orid_dhall_qty, orid?.orid_dhall_value],
    [orid?.purchase_orid_dhall_qty, orid?.purchase_orid_dhall_value],
  )
  const salesSplitCostPrice = costPriceFromSources(
    [orid?.orid_dhall_split_qty, orid?.orid_dhall_split_value],
    [orid?.purchase_orid_dhall_split_qty, orid?.purchase_orid_dhall_split_value],
  )
  const salesRejectionCostPrice = costPriceFromSources([
    orid?.orid_rejection_qty,
    orid?.orid_rejection_value,
  ])
  const salesTotalCostPrice = costPriceFromSources(
    [orid?.orid_dhall_qty, orid?.orid_dhall_value],
    [orid?.purchase_orid_dhall_qty, orid?.purchase_orid_dhall_value],
    [orid?.orid_dhall_split_qty, orid?.orid_dhall_split_value],
    [orid?.purchase_orid_dhall_split_qty, orid?.purchase_orid_dhall_split_value],
    [orid?.orid_rejection_qty, orid?.orid_rejection_value],
  )
  const salesDhallDiffPct = diffPctFromRates(
    orid?.sales_orid_dhall_rate,
    salesDhallCostPrice,
  )
  const salesSplitDiffPct = diffPctFromRates(
    orid?.sales_orid_dhall_split_rate,
    salesSplitCostPrice,
  )
  const salesRejectionDiffPct = diffPctFromRates(
    orid?.sales_orid_rejection_rate,
    salesRejectionCostPrice,
  )
  const salesTotalDiffPct = diffPctFromRates(salesTotalRate, salesTotalCostPrice)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void fetchMonthlySummary({ year: calendarYear, month: Number(month) })
      .then((data) => {
        if (!cancelled) setSummary(data)
      })
      .catch((err) => {
        if (!cancelled) {
          setSummary(null)
          showError(getApiErrorMessage(err, 'Unable to load monthly summary'))
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [calendarYear, month])

  return (
    <PrimaryContentLayout
      breadcrumb={[{ label: 'Reports' }, { label: 'Monthly Summary' }]}
      title="Monthly Summary"
    >
      <div className="recv-toolbar shrink-0">
        <div className="grid min-w-0 flex-1 grid-cols-2 gap-x-3 gap-y-2 lg:max-w-xl">
          <FormField label="Financial year">
            <FormSelect
              value={String(financialYear)}
              onChange={(e) => setFinancialYear(Number(e.target.value))}
              disabled={loading}
            >
              {yearOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </FormSelect>
          </FormField>
          <FormField label="Month">
            <FormSelect
              value={String(month)}
              onChange={(e) => setMonth(Number(e.target.value))}
              disabled={loading}
            >
              {FY_MONTHS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </FormSelect>
          </FormField>
        </div>
      </div>

      <section className="monthly-summary__block">
        <div className="monthly-summary__table-wrap">
          <table className="win-form__table win-form__table--bordered monthly-summary__table w-full text-sm">
            <colgroup>
              <col className="monthly-summary__col-label" />
              <col />
              <col className="monthly-summary__col-pct" />
              <col />
              <col />
              <col className="monthly-summary__col-pct" />
              <col />
            </colgroup>
            <thead>
              <tr>
                <th />
                <th className="win-form__table-num">Qty</th>
                <th className="win-form__table-num">%</th>
                <th className="win-form__table-num">
                  Cost
                  <br />
                  Price
                </th>
                <th className="win-form__table-num">Rate</th>
                <th className="win-form__table-num">
                  Diff
                  <br />
                  %
                </th>
                <th className="win-form__table-num">Value</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={COL_COUNT} className="win-form__table-empty">
                    Loading…
                  </td>
                </tr>
              ) : !showRows ? (
                <tr>
                  <td colSpan={COL_COUNT} className="win-form__table-empty">
                    No closed Orid productions, purchases, or sales for this month.
                  </td>
                </tr>
              ) : (
                <>
                  <SectionRow label="Sales" />
                  <MetricRow
                    label="Orid Dhall"
                    qty={orid.sales_orid_dhall_qty}
                    costPrice={salesDhallCostPrice}
                    rate={orid.sales_orid_dhall_rate}
                    diffPct={salesDhallDiffPct}
                    value={orid.sales_orid_dhall_value}
                  />
                  <MetricRow
                    label="Orid Dhall Split"
                    qty={orid.sales_orid_dhall_split_qty}
                    costPrice={salesSplitCostPrice}
                    rate={orid.sales_orid_dhall_split_rate}
                    diffPct={salesSplitDiffPct}
                    value={orid.sales_orid_dhall_split_value}
                  />
                  <MetricRow
                    label="Orid Dhall Rejection"
                    qty={orid.sales_orid_rejection_qty}
                    costPrice={salesRejectionCostPrice}
                    rate={orid.sales_orid_rejection_rate}
                    diffPct={salesRejectionDiffPct}
                    value={orid.sales_orid_rejection_value}
                  />
                  <MetricRow
                    label="Sales Total"
                    qty={salesTotalQty}
                    costPrice={salesTotalCostPrice}
                    rate={salesTotalRate}
                    diffPct={salesTotalDiffPct}
                    value={salesTotalValue}
                    emphasis
                  />
                  <SectionRow label="Production" />
                  <MetricRow
                    label="Orid Raw"
                    qty={orid.orid_raw_qty}
                    pct={orid.orid_raw_pct}
                    rate={orid.orid_raw_rate}
                    value={orid.orid_raw_value}
                  />
                  <MetricRow
                    label="Orid Dhall"
                    qty={orid.orid_dhall_qty}
                    pct={orid.orid_dhall_pct}
                    rate={orid.orid_dhall_rate}
                    value={orid.orid_dhall_value}
                  />
                  <MetricRow
                    label="Orid Dhall Split"
                    qty={orid.orid_dhall_split_qty}
                    pct={orid.orid_dhall_split_pct}
                    rate={orid.orid_dhall_split_rate}
                    value={orid.orid_dhall_split_value}
                  />
                  <MetricRow
                    label="Orid Dhall Rejection"
                    qty={orid.orid_rejection_qty}
                    pct={orid.orid_rejection_pct}
                    rate={orid.orid_rejection_rate}
                    value={orid.orid_rejection_value}
                  />
                  <MetricRow
                    label="Net Dhall Yield"
                    qty={orid.overall_qty}
                    pct={orid.overall_pct}
                    rate={orid.overall_rate}
                    value={orid.overall_value}
                    emphasis
                  />
                  <SectionRow label="Purchases" />
                  <MetricRow
                    label="Orid Dhall Purchase"
                    qty={orid.purchase_orid_dhall_qty}
                    rate={orid.purchase_orid_dhall_rate}
                    value={orid.purchase_orid_dhall_value}
                  />
                  <MetricRow
                    label="Orid Dhall Split Purchase"
                    qty={orid.purchase_orid_dhall_split_qty}
                    rate={orid.purchase_orid_dhall_split_rate}
                    value={orid.purchase_orid_dhall_split_value}
                  />
                  <MetricRow
                    label="Purchase Total"
                    qty={purchaseTotalQty}
                    rate={purchaseTotalRate}
                    diffPct={purchaseTotalDiffPct}
                    value={purchaseTotalValue}
                    emphasis
                  />
                </>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </PrimaryContentLayout>
  )
}
