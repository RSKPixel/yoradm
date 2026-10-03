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

const COL_COUNT = 14
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

function hasAnyFinite(...values) {
  return values.some(
    (value) => value != null && value !== '' && Number.isFinite(Number(value)),
  )
}

/** Cost = purchase + production (nulls as 0 if any term exists). */
function costBalance(purchase, production) {
  if (!hasAnyFinite(purchase, production)) return null
  return numOrZero(purchase) + numOrZero(production)
}

/** P&L = cost − sales (nulls as 0 if any term exists). */
function plBalance(cost, sales) {
  if (!hasAnyFinite(cost, sales)) return null
  return numOrZero(cost) - numOrZero(sales)
}

function sumOptional(...values) {
  if (!hasAnyFinite(...values)) return null
  return values.reduce((total, value) => total + numOrZero(value), 0)
}

function rowPlValue({ value, purchaseValue, salesValue, hidePl = false }) {
  if (hidePl) return null
  return plBalance(costBalance(purchaseValue, value), salesValue)
}

function rateFromQuintalValue(quintal, value) {
  const q = Number(quintal)
  const amount = Number(value)
  if (!Number.isFinite(q) || q === 0 || !Number.isFinite(amount)) return null
  return Math.round((amount / q) * 100) / 100
}

function rateFromBagsValue(bags, value) {
  const qty = Number(bags)
  if (!Number.isFinite(qty)) return null
  return rateFromQuintalValue(qty * BAG_TO_QUINTAL, value)
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

function QtyCell({ qty }) {
  return <td className="win-form__table-num">{formatQty(qty)}</td>
}

function PctCell({ pct }) {
  return <td className="win-form__table-num">{formatPct(pct)}</td>
}

function ValueCell({ value }) {
  return <td className="win-form__table-num">{formatMoney(value)}</td>
}

function MetricRow({
  label,
  qty,
  pct,
  rate,
  value,
  purchaseQty,
  purchaseRate,
  purchaseValue,
  salesQty,
  salesRate,
  salesValue,
  productionQtyIsQuintal = false,
  hidePl = false,
}) {
  // Orid Raw production qty is quintal; Cost/Sales qty use 50kg bags.
  const productionBags = productionQtyIsQuintal
    ? qty == null || qty === ''
      ? null
      : Number(qty) * 2
    : qty
  const costQty = costBalance(purchaseQty, productionBags)
  const costValue = costBalance(purchaseValue, value)
  const costRate = rateFromBagsValue(costQty, costValue)
  const plValue = hidePl ? null : plBalance(costValue, salesValue)
  const plRate = hidePl ? null : rateFromBagsValue(salesQty, plValue)

  return (
    <tr>
      <td>{label}</td>
      <QtyCell qty={qty} />
      <PctCell pct={pct} />
      <ValueCell value={rate} />
      <ValueCell value={value} />
      <QtyCell qty={purchaseQty} />
      <ValueCell value={purchaseRate} />
      <QtyCell qty={costQty} />
      <ValueCell value={costRate} />
      <ValueCell value={costValue} />
      <QtyCell qty={salesQty} />
      <ValueCell value={salesRate} />
      <ValueCell value={plRate} />
      <ValueCell value={plValue} />
    </tr>
  )
}

function hasTrade(orid) {
  if (!orid) return false
  return [
    orid.sales_orid_raw_qty,
    orid.sales_orid_dhall_qty,
    orid.sales_orid_dhall_split_qty,
    orid.sales_orid_rejection_qty,
    orid.purchase_orid_dhall_qty,
    orid.purchase_orid_dhall_split_qty,
  ].some((value) => value != null && Number(value) !== 0)
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
  const showRows = lotCount > 0 || hasTrade(orid)

  const productionTotalValue = sumOptional(
    orid?.orid_dhall_value,
    orid?.orid_dhall_split_value,
    orid?.orid_rejection_value,
  )
  const plTotalValue = sumOptional(
    rowPlValue({
      value: orid?.orid_dhall_value,
      purchaseValue: orid?.purchase_orid_dhall_value,
      salesValue: orid?.sales_orid_dhall_value,
    }),
    rowPlValue({
      value: orid?.orid_dhall_split_value,
      purchaseValue: orid?.purchase_orid_dhall_split_value,
      salesValue: orid?.sales_orid_dhall_split_value,
    }),
    rowPlValue({
      value: orid?.orid_rejection_value,
      salesValue: orid?.sales_orid_rejection_value,
    }),
  )

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
              <col />
              <col />
              <col />
              <col />
              <col />
              <col />
              <col />
              <col />
              <col />
            </colgroup>
            <thead>
              <tr>
                <th rowSpan={2} />
                <th className="monthly-summary__group" colSpan={4}>
                  Production
                </th>
                <th className="monthly-summary__group" colSpan={2}>
                  Purchase
                </th>
                <th className="monthly-summary__group" colSpan={3}>
                  Cost
                </th>
                <th className="monthly-summary__group" colSpan={2}>
                  Sales
                </th>
                <th className="monthly-summary__group" colSpan={2}>
                  P&amp;L
                </th>
              </tr>
              <tr>
                <th className="win-form__table-num">Qty</th>
                <th className="win-form__table-num">%</th>
                <th className="win-form__table-num">Rate</th>
                <th className="win-form__table-num">
                  Total
                  <br />
                  Value
                </th>
                <th className="win-form__table-num">Qty</th>
                <th className="win-form__table-num">Rate</th>
                <th className="win-form__table-num">
                  Qty
                  <br />
                  50kg
                </th>
                <th className="win-form__table-num">Rate</th>
                <th className="win-form__table-num">Value</th>
                <th className="win-form__table-num">
                  Qty
                  <br />
                  50kg
                </th>
                <th className="win-form__table-num">Rate</th>
                <th className="win-form__table-num">Rate</th>
                <th className="win-form__table-num">
                  Total
                  <br />
                  Value
                </th>
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
                  <MetricRow
                    label="Orid Raw"
                    qty={orid.orid_raw_qty}
                    pct={orid.orid_raw_pct}
                    rate={orid.orid_raw_rate}
                    value={orid.orid_raw_value}
                    salesQty={orid.sales_orid_raw_qty}
                    salesRate={orid.sales_orid_raw_rate}
                    salesValue={orid.sales_orid_raw_value}
                    productionQtyIsQuintal
                    hidePl
                  />
                  <MetricRow
                    label="Orid Dhall"
                    qty={orid.orid_dhall_qty}
                    pct={orid.orid_dhall_pct}
                    rate={orid.orid_dhall_rate}
                    value={orid.orid_dhall_value}
                    purchaseQty={orid.purchase_orid_dhall_qty}
                    purchaseRate={orid.purchase_orid_dhall_rate}
                    purchaseValue={orid.purchase_orid_dhall_value}
                    salesQty={orid.sales_orid_dhall_qty}
                    salesRate={orid.sales_orid_dhall_rate}
                    salesValue={orid.sales_orid_dhall_value}
                  />
                  <MetricRow
                    label="Orid Dhall Split"
                    qty={orid.orid_dhall_split_qty}
                    pct={orid.orid_dhall_split_pct}
                    rate={orid.orid_dhall_split_rate}
                    value={orid.orid_dhall_split_value}
                    purchaseQty={orid.purchase_orid_dhall_split_qty}
                    purchaseRate={orid.purchase_orid_dhall_split_rate}
                    purchaseValue={orid.purchase_orid_dhall_split_value}
                    salesQty={orid.sales_orid_dhall_split_qty}
                    salesRate={orid.sales_orid_dhall_split_rate}
                    salesValue={orid.sales_orid_dhall_split_value}
                  />
                  <MetricRow
                    label="Orid Dhall Rejection"
                    qty={orid.orid_rejection_qty}
                    pct={orid.orid_rejection_pct}
                    rate={orid.orid_rejection_rate}
                    value={orid.orid_rejection_value}
                    salesQty={orid.sales_orid_rejection_qty}
                    salesRate={orid.sales_orid_rejection_rate}
                    salesValue={orid.sales_orid_rejection_value}
                  />
                  <MetricRow
                    label="Yield"
                    qty={orid.overall_qty}
                    pct={orid.overall_pct}
                    rate={orid.overall_rate}
                    value={orid.overall_value}
                    salesQty={orid.sales_overall_qty}
                    salesRate={orid.sales_overall_rate}
                    salesValue={orid.sales_overall_value}
                    hidePl
                  />
                  <tr className="monthly-summary__total-row">
                    <td>Total</td>
                    <td className="win-form__table-num">—</td>
                    <td className="win-form__table-num">—</td>
                    <td className="win-form__table-num">—</td>
                    <ValueCell value={productionTotalValue} />
                    <td className="win-form__table-num">—</td>
                    <td className="win-form__table-num">—</td>
                    <td className="win-form__table-num">—</td>
                    <td className="win-form__table-num">—</td>
                    <td className="win-form__table-num">—</td>
                    <td className="win-form__table-num">—</td>
                    <td className="win-form__table-num">—</td>
                    <td className="win-form__table-num">—</td>
                    <ValueCell value={plTotalValue} />
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </PrimaryContentLayout>
  )
}
