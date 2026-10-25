import { useEffect, useMemo, useState } from 'react'
import { fetchOridStockCosting } from '../api/oridStockCosting'
import { fetchMonthlySummary, saveMonthlyOpening } from '../api/reports'
import { FormField, FormSelect } from '../components/form/FormPanel'
import { FormattedNumberInput } from '../components/form/FormattedNumberInput'
import { useFormMessage } from '../components/form/FormMessage'
import { PrimaryContentLayout } from '../components/layout/PrimaryContentLayout'
import { RateGroupsModal } from '../components/monthly-summary/RateGroupsModal'
import {
  FY_MONTHS,
  currentFinancialYearStart,
  financialYearOptions,
} from '../utils/financialYear'
import { formatCommaNumber } from '../utils/formatNumber'
import { getApiErrorMessage } from '../utils/formValidation'

const COL_COUNT = 5
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

function parseRateDraft(draft) {
  const raw = String(draft ?? '').replace(/,/g, '').trim()
  if (raw === '') return null
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
}

function ratePerQuintal(value, quintal) {
  if (value == null || quintal == null || Number(quintal) === 0) return null
  return Math.round((Number(value) / Number(quintal)) * 100) / 100
}

function roundWhole(value) {
  return value == null ? null : Math.round(Number(value))
}

function draftFromRate(rate) {
  return rate == null || rate === '' ? '' : String(rate)
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

/**
 * `grossRate` is before discount; rows without a discount show the same rate twice.
 * `onPctChange` makes the % cell an input (expenses as % of Orid Raw value).
 * `nettRate` overrides the Nett Rate cell; `null` leaves it blank.
 */
function MetricRow({
  label,
  qty,
  pct,
  grossRate,
  rate,
  pctDraft,
  onPctChange,
  nettRate,
  emphasis = false,
  onRateClick,
}) {
  const nett = nettRate === undefined ? rate : nettRate
  return (
    <tr className={emphasis ? 'monthly-summary__total-row' : undefined}>
      <td>{label}</td>
      <td className="win-form__table-num">{formatQty(qty)}</td>
      <td
        className={`win-form__table-num${onPctChange ? ' monthly-summary__input-cell' : ''}`}
      >
        {onPctChange ? (
          <FormattedNumberInput
            value={pctDraft ?? ''}
            fractionDigits={2}
            selectOnFocus
            aria-label={`% for ${label}`}
            onChange={onPctChange}
          />
        ) : (
          formatPct(pct)
        )}
      </td>
      <td className="win-form__table-num">
        {formatMoney(grossRate === undefined ? rate : grossRate)}
      </td>
      <td className="win-form__table-num">
        {nettRate === null ? null : onRateClick && nett != null && nett !== '' ? (
          <button
            type="button"
            className="monthly-summary__rate-link"
            title="Show rates"
            onClick={onRateClick}
          >
            {formatMoney(nett)}
          </button>
        ) : (
          formatMoney(nett)
        )}
      </td>
    </tr>
  )
}

/**
 * P&L line on the Summary tab: 50kg bags, rate per quintal (whole rupees), value.
 * `qtyInput` / `rateInput` replace the Qty / Rate cells with an input.
 */
function PnlRow({ label, qty, rate, value, qtyInput, rateInput, emphasis = false }) {
  return (
    <tr className={emphasis ? 'monthly-summary__total-row' : undefined}>
      <td>{label}</td>
      <td className={`win-form__table-num${qtyInput ? ' monthly-summary__input-cell' : ''}`}>
        {qtyInput ?? formatQty(qty)}
      </td>
      <td className={`win-form__table-num${rateInput ? ' monthly-summary__input-cell' : ''}`}>
        {rateInput ?? formatMoney(roundWhole(rate))}
      </td>
      <td className="win-form__table-num">{formatMoney(value)}</td>
    </tr>
  )
}

const PNL_COL_COUNT = 4

const SECTION_TABS = [
  { id: 'summary', label: 'Summary', empty: 'No Orid Dhall stock, production, or sales for this month.' },
  { id: 'sales', label: 'Sales', empty: 'No Orid sales for this month.' },
  { id: 'production', label: 'Production', empty: 'No closed Orid productions for this month.' },
  { id: 'purchases', label: 'Purchases', empty: 'No Orid purchases for this month.' },
]

export function MonthlySummaryPage() {
  const { showError, showSuccess } = useFormMessage()
  const yearOptions = useMemo(() => financialYearOptions(8), [])
  const [financialYear, setFinancialYear] = useState(() => currentFinancialYearStart())
  const [month, setMonth] = useState(() => new Date().getMonth() + 1)
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [rateGroups, setRateGroups] = useState(null)
  const [activeTab, setActiveTab] = useState('summary')
  // Expenses as % of Orid Raw value; default to the saved Orid Costing values.
  const [expensePcts, setExpensePcts] = useState({ mfg: '', overheads: '' })
  // Overhead expenses % on Orid Dhall purchases; defaults to the Orid Costing overheads %.
  const [purchaseExpensePct, setPurchaseExpensePct] = useState('')
  // Manual Orid Dhall opening stock (50kg bags, rate per quintal), saved per month.
  const [openingDraft, setOpeningDraft] = useState({ qty: '', rate: '' })
  const [savedOpening, setSavedOpening] = useState({ qty: '', rate: '' })

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
  const tabHasRows = {
    summary: orid != null,
    sales: hasSales,
    production: lotCount > 0,
    purchases: hasPurchases,
  }[activeTab]
  const activeSection = SECTION_TABS.find((tab) => tab.id === activeTab)
  const purchaseTotalQty = sumOptional(
    orid?.purchase_orid_dhall_qty,
    orid?.purchase_orid_dhall_split_qty,
  )
  const purchaseTotalValue = sumOptional(
    orid?.purchase_orid_dhall_value,
    orid?.purchase_orid_dhall_split_value,
  )
  const purchaseTotalRate = rateFromBagsValue(purchaseTotalQty, purchaseTotalValue)
  // Orid Dhall purchase value with overhead expenses (used for nett rates and the Summary).
  const purchaseExpenseFactor = 1 + numOrZero(parseRateDraft(purchaseExpensePct)) / 100
  const purchaseDhallNettValue =
    orid?.purchase_orid_dhall_value == null
      ? null
      : Number(orid.purchase_orid_dhall_value) * purchaseExpenseFactor
  const purchaseDhallNettRate = rateFromBagsValue(orid?.purchase_orid_dhall_qty, purchaseDhallNettValue)
  const purchaseTotalNettRate = rateFromBagsValue(
    purchaseTotalQty,
    sumOptional(purchaseDhallNettValue, orid?.purchase_orid_dhall_split_value),
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
  // Like Orid Costing: Orid Dhall value = (Orid Raw + expenses) − byproduct values (lot rates).
  const rawValue = orid?.orid_raw_value == null ? null : Number(orid.orid_raw_value)
  const expenseValue = (draft) => {
    const pct = parseRateDraft(draft)
    return rawValue == null || pct == null ? null : (rawValue * pct) / 100
  }
  const mfgValue = expenseValue(expensePcts.mfg)
  const overheadsValue = expenseValue(expensePcts.overheads)
  const costBase = rawValue == null ? null : rawValue + numOrZero(mfgValue) + numOrZero(overheadsValue)
  const splitValue = orid?.orid_dhall_split_value
  const rejectionValue = orid?.orid_rejection_value
  const huskValue = orid?.orid_husk_value
  const dhallValue =
    costBase == null
      ? null
      : costBase - numOrZero(splitValue) - numOrZero(rejectionValue) - numOrZero(huskValue)
  const dhallRate = rateFromBagsValue(orid?.orid_dhall_qty, dhallValue)
  const overallRate = rateFromBagsValue(
    orid?.overall_qty,
    dhallValue == null ? null : dhallValue + numOrZero(splitValue) + numOrZero(rejectionValue),
  )
  // Summary (Orid Dhall P&L): closing stock valued at the weighted average cost of
  // opening + purchases + production; cost of sales = available − closing.
  const openingQty = parseRateDraft(openingDraft.qty)
  const openingRate = parseRateDraft(openingDraft.rate)
  const openingValue =
    openingQty == null || openingRate == null ? null : openingQty * BAG_TO_QUINTAL * openingRate
  const pnlAvailableQty = sumOptional(openingQty, orid?.purchase_orid_dhall_qty, orid?.orid_dhall_qty)
  const pnlAvailableValue = sumOptional(openingValue, purchaseDhallNettValue, dhallValue)
  const pnlSalesQty = orid?.sales_orid_dhall_qty
  // Sales at the invoice rate, before the allocated discount.
  const pnlSalesValue = orid?.sales_orid_dhall_gross_value
  const pnlClosingQty =
    pnlAvailableQty == null ? null : pnlAvailableQty - numOrZero(pnlSalesQty)
  const pnlClosingValue =
    pnlAvailableQty && pnlAvailableValue != null
      ? (pnlAvailableValue / pnlAvailableQty) * pnlClosingQty
      : null
  const pnlCostOfSales =
    pnlAvailableValue == null ? null : pnlAvailableValue - numOrZero(pnlClosingValue)
  const pnlProfit =
    pnlSalesValue == null && pnlCostOfSales == null
      ? null
      : numOrZero(pnlSalesValue) - numOrZero(pnlCostOfSales)

  const saveOpening = (next) => {
    if (next.qty === savedOpening.qty && next.rate === savedOpening.rate) return
    void saveMonthlyOpening({
      year: calendarYear,
      month: Number(month),
      openingQty: parseRateDraft(next.qty),
      openingRate: parseRateDraft(next.rate),
    })
      .then(() => {
        setSavedOpening(next)
        showSuccess('Opening stock saved')
      })
      .catch((err) => showError(getApiErrorMessage(err, 'Unable to save opening stock')))
  }
  // FormattedNumberInput normalises on blur; read the field text so the save sees it.
  const blurOpening = (field) => (e) => {
    const raw = String(e.target.value ?? '').replace(/,/g, '').trim()
    saveOpening({ ...openingDraft, [field]: raw === '' ? '' : String(Number(raw)) })
  }
  const salesTotalGrossRate = rateFromBagsValue(
    salesTotalQty,
    sumOptional(
      orid?.sales_orid_dhall_gross_value,
      orid?.sales_orid_dhall_split_gross_value,
      orid?.sales_orid_rejection_gross_value,
    ),
  )

  useEffect(() => {
    let cancelled = false
    void fetchOridStockCosting()
      .then((row) => {
        if (cancelled || !row) return
        setExpensePcts({
          mfg: draftFromRate(row.manual_mfg_expenses_pct),
          overheads: draftFromRate(row.manual_overheads_pct),
        })
        setPurchaseExpensePct(draftFromRate(row.manual_overheads_pct))
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void fetchMonthlySummary({ year: calendarYear, month: Number(month) })
      .then((data) => {
        if (cancelled) return
        setSummary(data)
        const opening = {
          qty: draftFromRate(data?.opening?.opening_qty),
          rate: draftFromRate(data?.opening?.opening_rate),
        }
        setOpeningDraft(opening)
        setSavedOpening(opening)
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
      breadcrumb={[{ label: 'Orid Processing' }, { label: 'Monthly Summary' }]}
      title="Monthly Summary"
      hideFooter
    >
      <div className="recv-toolbar shrink-0">
        <div className="grid min-w-0 flex-1 grid-cols-2 gap-x-3 gap-y-2 lg:max-w-xl">
          <FormField label="Financial year">
            <FormSelect
              value={financialYear}
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
              value={month}
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
        <div className="stock-analysis__tabs" role="tablist" aria-label="Monthly summary sections">
          {SECTION_TABS.map((tab) => {
            const active = activeTab === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                id={`monthly-summary-tab-${tab.id}`}
                aria-selected={active}
                aria-controls="monthly-summary-panel"
                className={`stock-analysis__tab${active ? ' stock-analysis__tab--active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            )
          })}
        </div>
        <div
          className="monthly-summary__table-wrap"
          role="tabpanel"
          id="monthly-summary-panel"
          aria-labelledby={`monthly-summary-tab-${activeTab}`}
        >
          {activeTab === 'summary' ? (
            <table className="win-form__table win-form__table--bordered monthly-summary__table w-full text-sm">
              <colgroup>
                <col className="monthly-summary__col-label" />
                <col />
                <col />
                <col />
              </colgroup>
              <thead>
                <tr>
                  <th />
                  <th className="win-form__table-num">Qty</th>
                  <th className="win-form__table-num">Rate</th>
                  <th className="win-form__table-num">Value</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={PNL_COL_COUNT} className="win-form__table-empty">
                      Loading…
                    </td>
                  </tr>
                ) : !tabHasRows ? (
                  <tr>
                    <td colSpan={PNL_COL_COUNT} className="win-form__table-empty">
                      {activeSection.empty}
                    </td>
                  </tr>
                ) : (
                  <>
                    <PnlRow
                      label="Opening Stock"
                      value={openingValue}
                      qtyInput={
                        <FormattedNumberInput
                          value={openingDraft.qty}
                          fractionDigits={2}
                          selectOnFocus
                          aria-label="Opening stock bags"
                          onChange={(value) => setOpeningDraft((prev) => ({ ...prev, qty: value }))}
                          onBlur={blurOpening('qty')}
                        />
                      }
                      rateInput={
                        <FormattedNumberInput
                          value={openingDraft.rate}
                          fractionDigits={2}
                          selectOnFocus
                          aria-label="Opening stock rate"
                          onChange={(value) => setOpeningDraft((prev) => ({ ...prev, rate: value }))}
                          onBlur={blurOpening('rate')}
                        />
                      }
                    />
                    <PnlRow
                      label="Add: Purchases"
                      qty={orid.purchase_orid_dhall_qty}
                      rate={purchaseDhallNettRate}
                      value={purchaseDhallNettValue}
                    />
                    <PnlRow
                      label="Add: Production"
                      qty={orid.orid_dhall_qty}
                      rate={dhallRate}
                      value={dhallValue}
                    />
                    <PnlRow
                      label="Total Available"
                      qty={pnlAvailableQty}
                      rate={rateFromBagsValue(pnlAvailableQty, pnlAvailableValue)}
                      value={pnlAvailableValue}
                      emphasis
                    />
                    <PnlRow
                      label="Less: Closing Stock"
                      qty={pnlClosingQty}
                      rate={rateFromBagsValue(pnlClosingQty, pnlClosingValue)}
                      value={pnlClosingValue}
                    />
                    <PnlRow
                      label="Cost of Sales"
                      qty={pnlSalesQty}
                      rate={rateFromBagsValue(pnlSalesQty, pnlCostOfSales)}
                      value={pnlCostOfSales}
                      emphasis
                    />
                    <PnlRow
                      label="Sales"
                      qty={pnlSalesQty}
                      rate={rateFromBagsValue(pnlSalesQty, pnlSalesValue)}
                      value={pnlSalesValue}
                    />
                    <PnlRow
                      label={pnlProfit != null && pnlProfit < 0 ? 'Loss' : 'Profit'}
                      qty={pnlSalesQty}
                      rate={rateFromBagsValue(pnlSalesQty, pnlProfit)}
                      value={pnlProfit}
                      emphasis
                    />
                  </>
                )}
              </tbody>
            </table>
          ) : (
            <table className="win-form__table win-form__table--bordered monthly-summary__table w-full text-sm">
              <colgroup>
                <col className="monthly-summary__col-label" />
                <col />
                <col className="monthly-summary__col-pct" />
                <col />
                <col />
              </colgroup>
              <thead>
                <tr>
                  <th />
                  <th className="win-form__table-num">Qty</th>
                  <th className="win-form__table-num">
                    {activeTab === 'purchases' ? 'Expenses %' : '%'}
                  </th>
                  <th className="win-form__table-num">Rate</th>
                  <th className="win-form__table-num">Nett Rate</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={COL_COUNT} className="win-form__table-empty">
                      Loading…
                    </td>
                  </tr>
                ) : !tabHasRows ? (
                  <tr>
                    <td colSpan={COL_COUNT} className="win-form__table-empty">
                      {activeSection.empty}
                    </td>
                  </tr>
                ) : (
                  <>
                    {activeTab === 'sales' ? (
                      <>
                        <MetricRow
                          label="Orid Dhall"
                          qty={orid.sales_orid_dhall_qty}
                          grossRate={orid.sales_orid_dhall_gross_rate}
                          onRateClick={() =>
                            setRateGroups({ kind: 'sales', title: 'Sales · Orid Dhall', stockGroups: ['Orid Dhall'] })
                          }
                          rate={orid.sales_orid_dhall_rate}
                        />
                        <MetricRow
                          label="Orid Dhall Split"
                          qty={orid.sales_orid_dhall_split_qty}
                          grossRate={orid.sales_orid_dhall_split_gross_rate}
                          onRateClick={() =>
                            setRateGroups({ kind: 'sales', title: 'Sales · Orid Dhall Split', stockGroups: ['Orid Dhall Split'] })
                          }
                          rate={orid.sales_orid_dhall_split_rate}
                        />
                        <MetricRow
                          label="Orid Dhall Rejection"
                          qty={orid.sales_orid_rejection_qty}
                          grossRate={orid.sales_orid_rejection_gross_rate}
                          onRateClick={() =>
                            setRateGroups({ kind: 'sales', title: 'Sales · Orid Dhall Rejection', stockGroups: ['Orid Dhall Rejection'] })
                          }
                          rate={orid.sales_orid_rejection_rate}
                        />
                        <MetricRow
                          label="Sales Total"
                          qty={salesTotalQty}
                          grossRate={salesTotalGrossRate}
                          onRateClick={() =>
                            setRateGroups({ kind: 'sales', title: 'Sales Total', stockGroups: ['Orid Dhall', 'Orid Dhall Split', 'Orid Dhall Rejection'] })
                          }
                          rate={salesTotalRate}
                          emphasis
                        />
                      </>
                    ) : null}
                    {activeTab === 'production' ? (
                      <>
                        <MetricRow
                          label="Orid Raw"
                          qty={orid.orid_raw_qty}
                          pct={orid.orid_raw_pct}
                          rate={roundWhole(orid.orid_raw_rate)}
                          nettRate={null}
                        />
                        <MetricRow
                          label="Manufacturing Expenses"
                          rate={roundWhole(ratePerQuintal(mfgValue, orid.orid_raw_qty))}
                          nettRate={null}
                          pctDraft={expensePcts.mfg}
                          onPctChange={(value) => setExpensePcts((prev) => ({ ...prev, mfg: value }))}
                        />
                        <MetricRow
                          label="Overheads"
                          rate={roundWhole(ratePerQuintal(overheadsValue, orid.orid_raw_qty))}
                          nettRate={null}
                          pctDraft={expensePcts.overheads}
                          onPctChange={(value) => setExpensePcts((prev) => ({ ...prev, overheads: value }))}
                        />
                        <MetricRow
                          label="Orid Raw + Expenses"
                          qty={orid.orid_raw_qty}
                          rate={roundWhole(ratePerQuintal(costBase, orid.orid_raw_qty))}
                          nettRate={roundWhole(ratePerQuintal(costBase, orid.orid_raw_qty))}
                          emphasis
                        />
                        <MetricRow
                          label="Orid Dhall"
                          qty={orid.orid_dhall_qty}
                          pct={orid.orid_dhall_pct}
                          rate={roundWhole(dhallRate)}
                          nettRate={roundWhole(dhallRate)}
                        />
                        <MetricRow
                          label="Orid Dhall Split"
                          qty={orid.orid_dhall_split_qty}
                          pct={orid.orid_dhall_split_pct}
                          rate={roundWhole(orid.orid_dhall_split_rate)}
                          nettRate={null}
                        />
                        <MetricRow
                          label="Orid Dhall Rejection"
                          qty={orid.orid_rejection_qty}
                          pct={orid.orid_rejection_pct}
                          rate={roundWhole(orid.orid_rejection_rate)}
                          nettRate={null}
                        />
                        <MetricRow
                          label="Orid Husk"
                          qty={orid.orid_husk_qty}
                          pct={orid.orid_husk_pct}
                          rate={roundWhole(orid.orid_husk_rate)}
                          nettRate={null}
                        />
                        <MetricRow
                          label="Net Dhall Yield"
                          qty={orid.overall_qty}
                          pct={orid.overall_pct}
                          rate={roundWhole(overallRate)}
                          nettRate={null}
                          emphasis
                        />
                      </>
                    ) : null}
                    {activeTab === 'purchases' ? (
                      <>
                        <MetricRow
                          label="Orid Dhall Purchase"
                          qty={orid.purchase_orid_dhall_qty}
                          onRateClick={() =>
                            setRateGroups({ kind: 'purchases', title: 'Purchases · Orid Dhall', stockGroups: ['Orid Dhall'] })
                          }
                          rate={orid.purchase_orid_dhall_rate}
                          nettRate={purchaseDhallNettRate}
                          pctDraft={purchaseExpensePct}
                          onPctChange={setPurchaseExpensePct}
                        />
                        <MetricRow
                          label="Orid Dhall Split Purchase"
                          qty={orid.purchase_orid_dhall_split_qty}
                          onRateClick={() =>
                            setRateGroups({ kind: 'purchases', title: 'Purchases · Orid Dhall Split', stockGroups: ['Orid Dhall Split'] })
                          }
                          rate={orid.purchase_orid_dhall_split_rate}
                        />
                        <MetricRow
                          label="Purchase Total"
                          qty={purchaseTotalQty}
                          onRateClick={() =>
                            setRateGroups({ kind: 'purchases', title: 'Purchase Total', stockGroups: ['Orid Dhall', 'Orid Dhall Split'] })
                          }
                          rate={purchaseTotalRate}
                          nettRate={purchaseTotalNettRate}
                          emphasis
                        />
                      </>
                    ) : null}
                  </>
                )}
              </tbody>
            </table>
          )}
        </div>
      </section>
      {rateGroups ? (
        <RateGroupsModal
          title={rateGroups.title}
          kind={rateGroups.kind}
          stockGroups={rateGroups.stockGroups}
          year={calendarYear}
          month={Number(month)}
          onClose={() => setRateGroups(null)}
        />
      ) : null}
    </PrimaryContentLayout>
  )
}
