import { useEffect, useMemo, useRef, useState } from 'react'
import { PlusIcon } from '@heroicons/react/24/outline'
import {
  fetchOridStockCosting,
  saveOridStockCosting,
} from '../api/oridStockCosting'
import {
  createOridStockPending,
  deleteOridStockPending,
  fetchOridStockPendings,
  updateOridStockPending,
} from '../api/oridStockPendings'
import {
  fetchOridStockWorkings,
  saveOridStockWorkings,
} from '../api/oridStockWorkings'
import {
  fetchOridDhallSales50kg,
  fetchOridStockAnalysisWorkings,
  fetchStockAnalysisSales,
} from '../api/tally'
import { FormattedNumberInput } from '../components/form/FormattedNumberInput'
import { FormDropdown } from '../components/form/FormDropdown'
import { FormField, FormInput, FormSelect } from '../components/form/FormPanel'
import { useFormMessage } from '../components/form/FormMessage'
import { PrimaryContentLayout } from '../components/layout/PrimaryContentLayout'
import {
  clearOridStockPendingsLocal,
  readOridStockPendingsLocal,
} from '../config/oridStockPendings'
import {
  DEFAULT_ORID_YIELD_PCTS,
  ORID_RAW_STOCK_GROUP,
} from '../constants/oridRawYield'
import { todayIsoDate } from '../utils/formatDate'
import {
  formatCommaNumber,
  formatQty,
  formatValue,
} from '../utils/formatNumber'
import { getApiErrorMessage } from '../utils/formValidation'

const COL_COUNT = 8

const SALES_DAYS_WINDOW = 30
const SALES_UPLIFT_PCT = 0.1

const COMMODITY_FILTERS = [
  { value: '', label: 'All' },
  { value: 'toor', label: 'Toor' },
  { value: 'moong', label: 'Moong' },
]

const ORID_PENDING_GROUP_ORID = 'Orid Raw'
const ORID_PENDING_GROUP_DHALL = 'Orid Dhall'

const ORID_PENDING_TABS = [
  {
    id: 'pending_orid_raw',
    label: 'Pending (Orid Raw)',
    stockGroup: ORID_PENDING_GROUP_ORID,
  },
  {
    id: 'pending_orid_dhall',
    label: 'Pending (Orid Dhall)',
    stockGroup: ORID_PENDING_GROUP_DHALL,
  },
]

const ORID_TABS = [
  { id: 'workings', label: 'Workings' },
  { id: 'costing', label: 'Costing' },
  ...ORID_PENDING_TABS.map(({ id, label }) => ({ id, label })),
]

const ORID_WORKINGS_ROWS = [
  { id: 'in_stock', label: 'In Stock' },
  { id: 'pending_purchases', label: 'Pending Purchases' },
  { id: 'pending_arrivals', label: 'Pending Arrivals' },
  { id: 'receipt_from_manufacturing', label: 'Receipt from Manufacturing' },
  { id: 'closing', label: 'Closing', emphasis: true },
]

const ORID_PENDING_STATUSES = [
  { value: 'pending_purchase', label: 'Pending Purchase' },
  { value: 'pending_arrival', label: 'Pending Arrival' },
  { value: 'remove', label: 'Remove' },
]

const ORID_PENDINGS_COL_COUNT = 7
const ORID_COSTING_COL_COUNT = 6
const PENDING_SAVE_DEBOUNCE_MS = 400
const COSTING_SAVE_DEBOUNCE_MS = 400
const WORKINGS_SAVE_DEBOUNCE_MS = 400

const ESTIMATED_SALES_MODES = [
  { value: 'manual', label: 'Manual' },
  { value: 'last_30_days', label: 'Last 30days sales' },
  { value: 'last_month', label: 'Last Month Sales' },
  { value: 'last_3_months_avg', label: 'Last 3months Avg' },
]

const ESTIMATED_SALES_MODE_KEYS = new Set(
  ESTIMATED_SALES_MODES.map((item) => item.value),
)

const ORID_COSTING_DHALL = 'Orid Dhall'
const ORID_COSTING_BYPRODUCTS = [
  'Orid Dhall Split',
  'Orid Dhall Rejection',
  'Orid Husk',
]
const ORID_COSTING_PCT_ITEMS = [ORID_COSTING_DHALL, ...ORID_COSTING_BYPRODUCTS]

const ORID_COSTING_ROWS = [
  { id: 'orid_raw', label: ORID_RAW_STOCK_GROUP, kind: 'raw' },
  { id: 'orid_dhall', label: ORID_COSTING_DHALL, kind: 'dhall' },
  { id: 'orid_dhall_split', label: 'Orid Dhall Split', kind: 'byproduct' },
  { id: 'orid_dhall_rejection', label: 'Orid Dhall Rejection', kind: 'byproduct' },
  { id: 'orid_husk', label: 'Orid Husk', kind: 'byproduct' },
]

const tableClass = 'win-form__table win-form__table--bordered stock-analysis__table w-full text-sm'
const oridWorkingsTableClass =
  'win-form__table win-form__table--bordered stock-analysis__workings-table w-full text-sm'
const oridPendingsTableClass =
  'win-form__table win-form__table--bordered stock-analysis__pendings-table w-full text-sm'
const oridCostingTableClass =
  'win-form__table win-form__table--bordered stock-analysis__costing-table w-full text-sm'

function defaultCostingPctDrafts() {
  const drafts = {}
  for (const label of ORID_COSTING_PCT_ITEMS) {
    drafts[label] = String(DEFAULT_ORID_YIELD_PCTS[label] ?? '')
  }
  return drafts
}

function defaultCostingRateDrafts() {
  const drafts = {}
  for (const label of ORID_COSTING_BYPRODUCTS) drafts[label] = ''
  return drafts
}

function applyCostingApiToDrafts(row) {
  const pctDrafts = defaultCostingPctDrafts()
  const rateDrafts = defaultCostingRateDrafts()
  let expensesPctDraft = ''
  if (!row) {
    return { pctDrafts, rateDrafts, expensesPctDraft }
  }
  pctDrafts[ORID_COSTING_DHALL] = draftFromNumber(row.orid_dhall_pct)
  pctDrafts['Orid Dhall Split'] = draftFromNumber(row.orid_dhall_split_pct)
  pctDrafts['Orid Dhall Rejection'] = draftFromNumber(row.orid_rejection_pct)
  pctDrafts['Orid Husk'] = draftFromNumber(row.orid_husk_pct)
  // Keep defaults when API fields are null (first save may be partial).
  for (const label of ORID_COSTING_PCT_ITEMS) {
    if (!pctDrafts[label]) {
      pctDrafts[label] = String(DEFAULT_ORID_YIELD_PCTS[label] ?? '')
    }
  }
  rateDrafts['Orid Dhall Split'] = draftFromNumber(row.split_rate)
  rateDrafts['Orid Dhall Rejection'] = draftFromNumber(row.rejection_rate)
  rateDrafts['Orid Husk'] = draftFromNumber(row.husk_rate)
  expensesPctDraft = draftFromNumber(row.expenses_pct)
  return { pctDrafts, rateDrafts, expensesPctDraft }
}

function costingSavePayload(pctDrafts, rateDrafts, expensesPctDraft) {
  return {
    orid_dhall_pct: parsePendingNumber(pctDrafts[ORID_COSTING_DHALL]),
    orid_dhall_split_pct: parsePendingNumber(pctDrafts['Orid Dhall Split']),
    orid_rejection_pct: parsePendingNumber(pctDrafts['Orid Dhall Rejection']),
    orid_husk_pct: parsePendingNumber(pctDrafts['Orid Husk']),
    expenses_pct: parsePendingNumber(expensesPctDraft),
    split_rate: parsePendingNumber(rateDrafts['Orid Dhall Split']),
    rejection_rate: parsePendingNumber(rateDrafts['Orid Dhall Rejection']),
    husk_rate: parsePendingNumber(rateDrafts['Orid Husk']),
  }
}

function qtyFromRawPercent(rawQty, pctDraft) {
  const pct = parsePendingNumber(pctDraft)
  if (rawQty == null || pct == null) return null
  return Math.round((Number(rawQty) * pct) / 100)
}

function roundMoney(value) {
  return Math.round(Number(value) * 100) / 100
}

function buildOridCostingRows({
  rawQty,
  rawRate,
  rawValue,
  pctDrafts,
  rateDrafts,
  expensesPctDraft,
}) {
  const rows = []
  let byproductValueSum = 0
  let hasByproductValue = false

  for (const meta of ORID_COSTING_ROWS) {
    if (meta.kind === 'raw') {
      rows.push({
        ...meta,
        pct: null,
        expensesPct: null,
        qty: rawQty,
        rate: rawRate,
        value: rawValue,
      })
      continue
    }

    const pct = parsePendingNumber(pctDrafts[meta.label])
    const qty = qtyFromRawPercent(rawQty, pctDrafts[meta.label])

    if (meta.kind === 'byproduct') {
      const rate = parsePendingNumber(rateDrafts[meta.label])
      const value = qty != null && rate != null ? roundMoney(qty * rate) : null
      if (value != null) {
        byproductValueSum += value
        hasByproductValue = true
      }
      rows.push({
        ...meta,
        pct,
        expensesPct: null,
        qty,
        rate,
        value,
      })
      continue
    }

    // Orid Dhall — residual rate/value after byproduct values + expenses %.
    rows.push({
      ...meta,
      pct,
      expensesPct: parsePendingNumber(expensesPctDraft),
      qty,
      rate: null,
      value: null,
      pending: true,
    })
  }

  return rows.map((row) => {
    if (!row.pending) return row
    if (rawValue == null || row.qty == null || row.qty === 0) {
      return { ...row, rate: null, value: null, pending: undefined }
    }
    let value = hasByproductValue
      ? roundMoney(Number(rawValue) - byproductValueSum)
      : Number(rawValue)
    if (row.expensesPct != null) {
      value = roundMoney(value * (1 + row.expensesPct / 100))
    }
    const rate = roundMoney(value / row.qty)
    return { ...row, rate, value, pending: undefined }
  })
}

function parsePendingNumber(value) {
  if (value === '' || value == null || value === '-') return null
  const num = Number.parseFloat(String(value).replace(/,/g, ''))
  return Number.isFinite(num) ? num : null
}

function draftFromNumber(value) {
  if (value == null || value === '') return ''
  const num = Number(value)
  return Number.isFinite(num) ? String(num) : ''
}

function mapPendingApiRow(row) {
  return {
    id: String(row.id),
    stockGroup: row.stock_group,
    broker: row.broker || '',
    poDate: row.po_date || '',
    deliveryDate: row.delivery_date || '',
    qty: draftFromNumber(row.qty),
    rate: draftFromNumber(row.rate),
    status: row.status,
  }
}

function pendingUpdatePayload(line, patch = {}) {
  const next = { ...line, ...patch }
  return {
    broker: next.broker?.trim() ? next.broker.trim() : null,
    po_date: next.poDate || null,
    delivery_date: next.deliveryDate || null,
    qty: parsePendingNumber(next.qty),
    rate: parsePendingNumber(next.rate),
    status: next.status,
  }
}

function pendingCreatePayload(stockGroup) {
  return {
    stock_group: stockGroup,
    broker: null,
    po_date: null,
    delivery_date: null,
    qty: null,
    rate: null,
    status: 'pending_purchase',
  }
}

async function migrateLocalPendingsIfNeeded(existingRows) {
  if (existingRows.length > 0) {
    clearOridStockPendingsLocal()
    return existingRows
  }
  const local = readOridStockPendingsLocal()
  if (!local.length) return existingRows

  const created = []
  for (const line of local) {
    const stockGroup = String(line.stockGroup || '').trim()
    const status = String(line.status || '').trim()
    if (
      stockGroup !== ORID_PENDING_GROUP_ORID &&
      stockGroup !== ORID_PENDING_GROUP_DHALL
    ) {
      continue
    }
    if (status !== 'pending_purchase' && status !== 'pending_arrival') continue
    const row = await createOridStockPending({
      stock_group: stockGroup,
      broker: line.broker?.trim() ? line.broker.trim() : null,
      po_date: line.poDate || null,
      delivery_date: line.deliveryDate || null,
      qty: parsePendingNumber(line.qty),
      rate: parsePendingNumber(line.rate),
      status,
    })
    created.push(row)
  }
  clearOridStockPendingsLocal()
  return created
}

function pendingLineValue(qtyDraft, rateDraft) {
  const qty = parsePendingNumber(qtyDraft)
  const rate = parsePendingNumber(rateDraft)
  if (qty == null || rate == null) return null
  return qty * rate
}

function aggregatePendingMetrics(lines, stockGroup) {
  let qtySum = 0
  let valueSum = 0
  let hasQty = false
  let hasValue = false

  for (const line of lines) {
    if (line.stockGroup !== stockGroup) continue
    const qty = parsePendingNumber(line.qty)
    const rate = parsePendingNumber(line.rate)
    if (qty == null) continue
    qtySum += qty
    hasQty = true
    if (rate != null) {
      valueSum += qty * rate
      hasValue = true
    }
  }

  if (!hasQty && !hasValue) return {}

  const qty = hasQty ? qtySum : null
  const value = hasValue ? valueSum : null
  const rate = qty != null && value != null && qty !== 0 ? value / qty : null
  return { qty, rate, value }
}

function pendingWorkingsRow(id, lines) {
  return {
    id,
    orid: aggregatePendingMetrics(lines, ORID_PENDING_GROUP_ORID),
    orid_dhall: aggregatePendingMetrics(lines, ORID_PENDING_GROUP_DHALL),
  }
}

function sumWorkingsMetrics(parts) {
  let qtySum = 0
  let valueSum = 0
  let hasQty = false
  let hasValue = false

  for (const part of parts) {
    if (part?.qty != null && part.qty !== '') {
      const qty = Number(part.qty)
      if (Number.isFinite(qty)) {
        qtySum += qty
        hasQty = true
      }
    }
    if (part?.value != null && part.value !== '') {
      const value = Number(part.value)
      if (Number.isFinite(value)) {
        valueSum += value
        hasValue = true
      }
    }
  }

  if (!hasQty && !hasValue) return {}

  const qty = hasQty ? qtySum : null
  const value = hasValue ? valueSum : null
  const rate = qty != null && value != null && qty !== 0 ? value / qty : null
  return { qty, rate, value }
}

function manufacturingWorkingsRow(dhallMetrics) {
  const hasDhall =
    dhallMetrics &&
    (dhallMetrics.qty != null || dhallMetrics.rate != null || dhallMetrics.value != null)
  return {
    id: 'receipt_from_manufacturing',
    orid: {},
    orid_dhall: hasDhall
      ? {
          qty: dhallMetrics.qty ?? null,
          rate: dhallMetrics.rate ?? null,
          value: dhallMetrics.value ?? null,
        }
      : {},
  }
}

function mergeOridWorkingsRows(
  apiRows = [],
  pendingLines = [],
  manufacturingDhall = null,
) {
  const byId = new Map(apiRows.map((row) => [row.id, row]))
  const purchases = pendingLines.filter((line) => line.status === 'pending_purchase')
  const arrivals = pendingLines.filter((line) => line.status === 'pending_arrival')

  const rows = ORID_WORKINGS_ROWS.map((meta) => {
    if (meta.id === 'pending_purchases') return pendingWorkingsRow(meta.id, purchases)
    if (meta.id === 'pending_arrivals') return pendingWorkingsRow(meta.id, arrivals)
    if (meta.id === 'receipt_from_manufacturing') {
      return manufacturingWorkingsRow(manufacturingDhall)
    }
    if (meta.id === 'closing') return { id: meta.id }
    return byId.get(meta.id) ?? { id: meta.id }
  })

  const detailRows = rows.filter((row) => row.id !== 'closing')
  return rows.map((row) => {
    if (row.id !== 'closing') return row
    return {
      id: 'closing',
      orid: sumWorkingsMetrics(detailRows.map((item) => item.orid)),
      orid_dhall: sumWorkingsMetrics(detailRows.map((item) => item.orid_dhall)),
    }
  })
}

function formatWorkingsQty(value) {
  if (value == null || value === '') return '—'
  const text = formatCommaNumber(value, 2)
  return text || '—'
}

function formatWorkingsRate(value) {
  if (value == null || value === '') return '—'
  const text = formatCommaNumber(value, 2)
  return text || '—'
}

function formatWorkingsValue(value) {
  if (value == null || value === '') return '—'
  const text = formatCommaNumber(value, 2)
  return text || '—'
}

function OridWorkingsNumCell({ value, kind = 'qty' }) {
  const text =
    kind === 'rate'
      ? formatWorkingsRate(value)
      : kind === 'value'
        ? formatWorkingsValue(value)
        : formatWorkingsQty(value)
  return (
    <td className="win-form__table-num">
      <span className="win-form__table-readonly">{text}</span>
    </td>
  )
}

function OridWorkingsRow({ label, orid, oridDhall, emphasis = false }) {
  return (
    <tr className={emphasis ? 'stock-analysis__workings-total' : undefined}>
      <td title={label}>{label}</td>
      <OridWorkingsNumCell value={orid?.qty} />
      <OridWorkingsNumCell value={orid?.rate} kind="rate" />
      <OridWorkingsNumCell value={orid?.value} kind="value" />
      <OridWorkingsNumCell value={oridDhall?.qty} />
      <OridWorkingsNumCell value={oridDhall?.rate} kind="rate" />
      <OridWorkingsNumCell value={oridDhall?.value} kind="value" />
    </tr>
  )
}

function bags50FromQuintals(quintals) {
  const qty = Number(quintals)
  if (!Number.isFinite(qty)) return null
  return Math.round(qty * 2)
}

function estimatedDaysFromSales(stockQty, salesDraft) {
  const stock = Number(stockQty)
  const sales = parsePendingNumber(salesDraft)
  if (!Number.isFinite(stock) || sales == null || sales <= 0) return null
  return Math.round(((stock / sales) * 30) * 100) / 100
}

function workingsMetricPayload(metric) {
  return {
    qty: metric?.qty ?? null,
    rate: metric?.rate ?? null,
    value: metric?.value ?? null,
  }
}

function normalizeEstimatedSalesMode(value) {
  const mode = String(value || '').trim()
  return ESTIMATED_SALES_MODE_KEYS.has(mode) ? mode : 'manual'
}

function sales50kgFromMode(mode, salesMetrics) {
  if (!salesMetrics) return null
  if (mode === 'last_30_days') return salesMetrics.last_30_days
  if (mode === 'last_month') return salesMetrics.last_month
  if (mode === 'last_3_months_avg') return salesMetrics.last_3_months_avg
  return null
}

function workingsSavePayload(asOf, rows, estimatedSalesMode, estimatedSales50kg) {
  const closing = rows.find((item) => item.id === 'closing')
  const qtyIn50kg = bags50FromQuintals(closing?.orid_dhall?.qty)
  const estimatedDays = estimatedDaysFromSales(qtyIn50kg, estimatedSales50kg)
  return {
    as_of: asOf || null,
    estimated_sales_mode: normalizeEstimatedSalesMode(estimatedSalesMode),
    estimated_sales_50kg: parsePendingNumber(estimatedSales50kg),
    qty_in_50kg: qtyIn50kg,
    estimated_days: estimatedDays,
    rows: rows.map((row) => ({
      id: row.id,
      orid: workingsMetricPayload(row.orid),
      orid_dhall: workingsMetricPayload(row.orid_dhall),
    })),
  }
}

function OridWorkingsTable({
  rows = [],
  estimatedSalesMode = 'manual',
  estimatedSales50kg = '',
  onEstimatedSalesModeChange,
  onEstimatedSales50kgChange,
}) {
  const closing = rows.find((item) => item.id === 'closing')
  const closingDhallQty = closing?.orid_dhall?.qty
  const qtyIn50kg = bags50FromQuintals(closingDhallQty)
  const estimatedDays = estimatedDaysFromSales(qtyIn50kg, estimatedSales50kg)
  const isManualSales = estimatedSalesMode === 'manual'
  const estimatedSalesModeLabel =
    ESTIMATED_SALES_MODES.find((opt) => opt.value === estimatedSalesMode)
      ?.label || 'Manual'
  const estimatedSalesModeStyle = {
    width: `${estimatedSalesModeLabel.length + 4}ch`,
  }

  return (
    <div className="stock-analysis__workings">
      <table className={oridWorkingsTableClass}>
        <colgroup>
          <col className="stock-analysis__workings-col-particulars" />
          <col className="stock-analysis__workings-col-num" />
          <col className="stock-analysis__workings-col-num" />
          <col className="stock-analysis__workings-col-num" />
          <col className="stock-analysis__workings-col-num" />
          <col className="stock-analysis__workings-col-num" />
          <col className="stock-analysis__workings-col-num" />
        </colgroup>
        <thead>
          <tr>
            <th>Particulars</th>
            <th className="win-form__table-num">Orid</th>
            <th className="win-form__table-num">Rate</th>
            <th className="win-form__table-num">Value</th>
            <th className="win-form__table-num">Orid Dhall</th>
            <th className="win-form__table-num">Rate</th>
            <th className="win-form__table-num">Value</th>
          </tr>
        </thead>
        <tbody>
          {ORID_WORKINGS_ROWS.map((meta) => {
            const row = rows.find((item) => item.id === meta.id)
            return (
              <OridWorkingsRow
                key={meta.id}
                label={meta.label}
                orid={row?.orid}
                oridDhall={row?.orid_dhall}
                emphasis={meta.emphasis}
              />
            )
          })}
          <tr>
            <td
              colSpan={4}
              className="stock-analysis__workings-label-end"
              title="Qty in 50kg"
            >
              Qty in 50kg
            </td>
            <td className="win-form__table-num">
              <span className="win-form__table-readonly">
                {qtyIn50kg == null ? '—' : formatCommaNumber(qtyIn50kg, 2)}
              </span>
            </td>
            <td colSpan={2} className="win-form__table-num" />
          </tr>
          <tr>
            <td colSpan={4} className="stock-analysis__workings-label-end">
              <div className="stock-analysis__workings-sales-row">
                <FormDropdown
                  className="stock-analysis__workings-sales-mode"
                  listClassName="stock-analysis__workings-sales-list"
                  options={ESTIMATED_SALES_MODES}
                  value={estimatedSalesMode}
                  onChange={onEstimatedSalesModeChange}
                  placeholder="Manual"
                  style={estimatedSalesModeStyle}
                />
              </div>
            </td>
            <td className="win-form__table-num">
              {isManualSales ? (
                <FormattedNumberInput
                  value={estimatedSales50kg}
                  fractionDigits={2}
                  selectOnFocus
                  aria-label="Estimated sales for Orid Dhall"
                  onChange={onEstimatedSales50kgChange}
                />
              ) : (
                <span className="win-form__table-readonly">
                  {estimatedSales50kg === ''
                    ? '—'
                    : formatCommaNumber(parsePendingNumber(estimatedSales50kg), 2)}
                </span>
              )}
            </td>
            <td colSpan={2} className="win-form__table-num" />
          </tr>
          <tr>
            <td
              colSpan={4}
              className="stock-analysis__workings-label-end"
              title="Estimated days"
            >
              Estimated days
            </td>
            <OridWorkingsNumCell value={estimatedDays} />
            <td colSpan={2} className="win-form__table-num" />
          </tr>
        </tbody>
      </table>
    </div>
  )
}

function OridPendingGroupTable({
  title,
  stockGroup,
  lines,
  onAdd,
  onChange,
  addDisabled = false,
}) {
  return (
    <div className="stock-analysis__pendings">
      <section className="stock-analysis__pendings-block" aria-label={title}>
        <div className="stock-analysis__pendings-toolbar">
          <button
            type="button"
            className="win-form__icon-button"
            aria-label={`Add ${title} line`}
            disabled={addDisabled}
            onClick={() => onAdd(stockGroup)}
          >
            <PlusIcon />
          </button>
        </div>

        <table className={oridPendingsTableClass}>
          <colgroup>
            <col className="stock-analysis__pendings-col-broker" />
            <col className="stock-analysis__pendings-col-date" />
            <col className="stock-analysis__pendings-col-date" />
            <col className="stock-analysis__pendings-col-num" />
            <col className="stock-analysis__pendings-col-num" />
            <col className="stock-analysis__pendings-col-num" />
            <col className="stock-analysis__pendings-col-status" />
          </colgroup>
          <thead>
            <tr>
              <th>Broker</th>
              <th>PO date</th>
              <th>Date of delivery</th>
              <th className="win-form__table-num">Qty</th>
              <th className="win-form__table-num">Rate</th>
              <th className="win-form__table-num">Value</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {lines.length === 0 ? (
              <tr>
                <td colSpan={ORID_PENDINGS_COL_COUNT} className="win-form__table-empty">
                  No pending lines. Use + to add one.
                </td>
              </tr>
            ) : (
              lines.map((line) => {
                const value = pendingLineValue(line.qty, line.rate)
                return (
                  <tr key={line.id}>
                    <td>
                      <FormInput
                        value={line.broker}
                        aria-label="Broker"
                        onChange={(e) =>
                          onChange(line.id, { broker: e.target.value })
                        }
                      />
                    </td>
                    <td>
                      <FormInput
                        type="date"
                        value={line.poDate}
                        aria-label="PO date"
                        onChange={(e) =>
                          onChange(line.id, { poDate: e.target.value })
                        }
                      />
                    </td>
                    <td>
                      <FormInput
                        type="date"
                        value={line.deliveryDate}
                        aria-label="Date of delivery"
                        onChange={(e) =>
                          onChange(line.id, { deliveryDate: e.target.value })
                        }
                      />
                    </td>
                    <td className="win-form__table-num">
                      <FormattedNumberInput
                        value={line.qty}
                        fractionDigits={2}
                        allowNegative
                        selectOnFocus
                        aria-label="Qty"
                        onChange={(qty) => onChange(line.id, { qty })}
                      />
                    </td>
                    <td className="win-form__table-num">
                      <FormattedNumberInput
                        value={line.rate}
                        fractionDigits={2}
                        selectOnFocus
                        aria-label="Rate"
                        onChange={(rate) => onChange(line.id, { rate })}
                      />
                    </td>
                    <td className="win-form__table-num">
                      <span className="win-form__table-readonly">
                        {value == null ? '—' : formatValue(value)}
                      </span>
                    </td>
                    <td>
                      <FormSelect
                        className="win-form__table-select"
                        value={line.status}
                        aria-label="Status"
                        onChange={(e) =>
                          onChange(line.id, { status: e.target.value })
                        }
                      >
                        {ORID_PENDING_STATUSES.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </FormSelect>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </section>
    </div>
  )
}

function OridCostingTable({
  closingOrid,
  pctDrafts,
  rateDrafts,
  expensesPctDraft,
  onPctChange,
  onRateChange,
  onExpensesPctChange,
}) {
  const rows = useMemo(
    () =>
      buildOridCostingRows({
        rawQty: closingOrid?.qty ?? null,
        rawRate: closingOrid?.rate ?? null,
        rawValue: closingOrid?.value ?? null,
        pctDrafts,
        rateDrafts,
        expensesPctDraft,
      }),
    [closingOrid, pctDrafts, rateDrafts, expensesPctDraft],
  )

  return (
    <div className="stock-analysis__costing">
      <table className={oridCostingTableClass}>
        <colgroup>
          <col className="stock-analysis__costing-col-item" />
          <col className="stock-analysis__costing-col-pct" />
          <col className="stock-analysis__costing-col-pct" />
          <col className="stock-analysis__costing-col-num" />
          <col className="stock-analysis__costing-col-num" />
          <col className="stock-analysis__costing-col-num" />
        </colgroup>
        <thead>
          <tr>
            <th>Stock item</th>
            <th className="win-form__table-num">Percentage</th>
            <th className="win-form__table-num">Expenses %</th>
            <th className="win-form__table-num">Qty</th>
            <th className="win-form__table-num">Rate</th>
            <th className="win-form__table-num">Value</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={ORID_COSTING_COL_COUNT} className="win-form__table-empty">
                No costing data.
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr
                key={row.id}
                className={row.kind === 'raw' ? 'stock-analysis__costing-raw' : undefined}
              >
                <td>{row.label}</td>
                <td className="win-form__table-num">
                  {row.kind === 'raw' ? (
                    <span className="win-form__table-readonly">—</span>
                  ) : (
                    <FormattedNumberInput
                      value={pctDrafts[row.label] ?? ''}
                      fractionDigits={2}
                      selectOnFocus
                      aria-label={`Percentage for ${row.label}`}
                      onChange={(value) => onPctChange(row.label, value)}
                    />
                  )}
                </td>
                <td className="win-form__table-num">
                  {row.kind === 'dhall' ? (
                    <FormattedNumberInput
                      value={expensesPctDraft}
                      fractionDigits={2}
                      selectOnFocus
                      aria-label="Expenses percent"
                      onChange={onExpensesPctChange}
                    />
                  ) : (
                    <span className="win-form__table-readonly">—</span>
                  )}
                </td>
                <td className="win-form__table-num">
                  <span className="win-form__table-readonly">
                    {row.qty == null ? '—' : formatCommaNumber(row.qty, 2)}
                  </span>
                </td>
                <td className="win-form__table-num">
                  {row.kind === 'byproduct' ? (
                    <FormattedNumberInput
                      value={rateDrafts[row.label] ?? ''}
                      fractionDigits={2}
                      selectOnFocus
                      aria-label={`Rate for ${row.label}`}
                      onChange={(value) => onRateChange(row.label, value)}
                    />
                  ) : (
                    <span className="win-form__table-readonly">
                      {row.rate == null ? '—' : formatCommaNumber(row.rate, 2)}
                    </span>
                  )}
                </td>
                <td className="win-form__table-num">
                  <span className="win-form__table-readonly">
                    {row.value == null ? '—' : formatCommaNumber(row.value, 2)}
                  </span>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}

function OridReportTabs({
  activeTab,
  onChange,
  workingsRows,
  estimatedSalesMode,
  estimatedSales50kg,
  onEstimatedSalesModeChange,
  onEstimatedSales50kgChange,
  pendingLines,
  onAddPendingLine,
  onChangePendingLine,
  pendingBusy = false,
  costingPctDrafts,
  costingRateDrafts,
  costingExpensesPctDraft,
  onCostingPctChange,
  onCostingRateChange,
  onCostingExpensesPctChange,
}) {
  const pendingTab = ORID_PENDING_TABS.find((tab) => tab.id === activeTab)
  const closingOrid = workingsRows.find((row) => row.id === 'closing')?.orid

  return (
    <div className="stock-analysis__orid">
      <div className="stock-analysis__tabs" role="tablist" aria-label="Orid report sections">
        {ORID_TABS.map((tab) => {
          const active = activeTab === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`stock-analysis-orid-tab-${tab.id}`}
              aria-selected={active}
              aria-controls={`stock-analysis-orid-panel-${tab.id}`}
              className={`stock-analysis__tab${active ? ' stock-analysis__tab--active' : ''}`}
              onClick={() => onChange(tab.id)}
            >
              {tab.label}
            </button>
          )
        })}
      </div>

      <div
        className="stock-analysis__tab-panel"
        role="tabpanel"
        id={`stock-analysis-orid-panel-${activeTab}`}
        aria-labelledby={`stock-analysis-orid-tab-${activeTab}`}
      >
        {activeTab === 'workings' ? (
          <OridWorkingsTable
            rows={workingsRows}
            estimatedSalesMode={estimatedSalesMode}
            estimatedSales50kg={estimatedSales50kg}
            onEstimatedSalesModeChange={onEstimatedSalesModeChange}
            onEstimatedSales50kgChange={onEstimatedSales50kgChange}
          />
        ) : null}
        {activeTab === 'costing' ? (
          <OridCostingTable
            closingOrid={closingOrid}
            pctDrafts={costingPctDrafts}
            rateDrafts={costingRateDrafts}
            expensesPctDraft={costingExpensesPctDraft}
            onPctChange={onCostingPctChange}
            onRateChange={onCostingRateChange}
            onExpensesPctChange={onCostingExpensesPctChange}
          />
        ) : null}
        {pendingTab ? (
          <OridPendingGroupTable
            title={pendingTab.label}
            stockGroup={pendingTab.stockGroup}
            lines={pendingLines.filter(
              (line) => line.stockGroup === pendingTab.stockGroup,
            )}
            onAdd={onAddPendingLine}
            onChange={onChangePendingLine}
            addDisabled={pendingBusy}
          />
        ) : null}
      </div>
    </div>
  )
}

function TableColGroup() {
  return (
    <colgroup>
      <col className="stock-analysis__col-group" />
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

function HeaderRow({ avgMonths }) {
  return (
    <tr>
      <th>Stock group</th>
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

function DataRow({ row }) {
  return (
    <tr>
      <td className="stock-analysis__group">{rowGroupLabel(row)}</td>
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

export function OridStockAnalysisPage() {
  return <StockAnalysisPage oridOnly />
}

export function StockAnalysisPage({ oridOnly = false }) {
  const { showError } = useFormMessage()
  const [analysis, setAnalysis] = useState(null)
  const [oridWorkings, setOridWorkings] = useState(null)
  const [loading, setLoading] = useState(true)
  const [asOf, setAsOf] = useState(todayIsoDate)
  const [commodity, setCommodity] = useState('')
  const [oridTab, setOridTab] = useState('workings')
  const [pendingLines, setPendingLines] = useState([])
  const [pendingBusy, setPendingBusy] = useState(false)
  const [costingPctDrafts, setCostingPctDrafts] = useState(defaultCostingPctDrafts)
  const [costingRateDrafts, setCostingRateDrafts] = useState(defaultCostingRateDrafts)
  const [costingExpensesPctDraft, setCostingExpensesPctDraft] = useState('')
  const [costingHydrated, setCostingHydrated] = useState(false)
  const [estimatedSalesMode, setEstimatedSalesMode] = useState('manual')
  const [estimatedSales50kg, setEstimatedSales50kg] = useState('')
  const [oridDhallSales, setOridDhallSales] = useState(null)
  const [workingsHydrated, setWorkingsHydrated] = useState(false)

  const headRef = useRef(null)
  const bodyRef = useRef(null)
  const footRef = useRef(null)
  const syncing = useRef(false)
  const pendingLinesRef = useRef(pendingLines)
  const pendingSaveTimers = useRef(new Map())
  const costingSaveTimer = useRef(null)
  const costingPctRef = useRef(costingPctDrafts)
  const costingRateRef = useRef(costingRateDrafts)
  const costingExpensesRef = useRef(costingExpensesPctDraft)
  const workingsSaveTimer = useRef(null)
  const estimatedSalesModeRef = useRef(estimatedSalesMode)
  const estimatedSalesRef = useRef(estimatedSales50kg)
  const workingsRowsRef = useRef([])
  const workingsHydratedRef = useRef(false)

  const isOridReport = oridOnly

  useEffect(() => {
    pendingLinesRef.current = pendingLines
  }, [pendingLines])

  useEffect(() => {
    costingPctRef.current = costingPctDrafts
    costingRateRef.current = costingRateDrafts
    costingExpensesRef.current = costingExpensesPctDraft
  }, [costingPctDrafts, costingRateDrafts, costingExpensesPctDraft])

  useEffect(() => {
    estimatedSalesModeRef.current = estimatedSalesMode
  }, [estimatedSalesMode])

  useEffect(() => {
    estimatedSalesRef.current = estimatedSales50kg
  }, [estimatedSales50kg])

  useEffect(() => {
    workingsHydratedRef.current = workingsHydrated
  }, [workingsHydrated])

  useEffect(() => {
    return () => {
      for (const timer of pendingSaveTimers.current.values()) {
        window.clearTimeout(timer)
      }
      pendingSaveTimers.current.clear()
      if (costingSaveTimer.current) window.clearTimeout(costingSaveTimer.current)
      if (workingsSaveTimer.current) window.clearTimeout(workingsSaveTimer.current)
    }
  }, [])

  function schedulePendingSave(lineId) {
    const key = String(lineId)
    const existing = pendingSaveTimers.current.get(key)
    if (existing) window.clearTimeout(existing)
    const timer = window.setTimeout(() => {
      pendingSaveTimers.current.delete(key)
      const line = pendingLinesRef.current.find((item) => item.id === key)
      if (!line) return
      void updateOridStockPending(Number(key), pendingUpdatePayload(line)).catch(
        (err) => {
          showError(getApiErrorMessage(err, 'Unable to save pending line'))
        },
      )
    }, PENDING_SAVE_DEBOUNCE_MS)
    pendingSaveTimers.current.set(key, timer)
  }

  async function addPendingLine(stockGroup) {
    if (pendingBusy) return
    setPendingBusy(true)
    try {
      const row = await createOridStockPending(pendingCreatePayload(stockGroup))
      setPendingLines((current) => [...current, mapPendingApiRow(row)])
    } catch (err) {
      showError(getApiErrorMessage(err, 'Unable to add pending line'))
    } finally {
      setPendingBusy(false)
    }
  }

  function changePendingLine(lineId, patch) {
    const key = String(lineId)

    if (patch.status === 'remove') {
      const timer = pendingSaveTimers.current.get(key)
      if (timer) {
        window.clearTimeout(timer)
        pendingSaveTimers.current.delete(key)
      }
      setPendingLines((current) => current.filter((line) => line.id !== key))
      void deleteOridStockPending(Number(key)).catch((err) => {
        showError(getApiErrorMessage(err, 'Unable to remove pending line'))
      })
      return
    }

    setPendingLines((current) =>
      current.map((line) => (line.id === key ? { ...line, ...patch } : line)),
    )
    schedulePendingSave(key)
  }

  function scheduleCostingSave() {
    if (!costingHydrated) return
    if (costingSaveTimer.current) window.clearTimeout(costingSaveTimer.current)
    costingSaveTimer.current = window.setTimeout(() => {
      costingSaveTimer.current = null
      void saveOridStockCosting(
        costingSavePayload(
          costingPctRef.current,
          costingRateRef.current,
          costingExpensesRef.current,
        ),
      ).catch((err) => {
        showError(getApiErrorMessage(err, 'Unable to save costing'))
      })
    }, COSTING_SAVE_DEBOUNCE_MS)
  }

  function changeCostingPct(label, value) {
    setCostingPctDrafts((current) => {
      const next = { ...current, [label]: value }
      costingPctRef.current = next
      return next
    })
    scheduleCostingSave()
  }

  function changeCostingRate(label, value) {
    setCostingRateDrafts((current) => {
      const next = { ...current, [label]: value }
      costingRateRef.current = next
      return next
    })
    scheduleCostingSave()
  }

  function changeCostingExpensesPct(value) {
    costingExpensesRef.current = value
    setCostingExpensesPctDraft(value)
    scheduleCostingSave()
  }

  function scheduleWorkingsSave() {
    if (!workingsHydratedRef.current) return
    if (workingsSaveTimer.current) window.clearTimeout(workingsSaveTimer.current)
    workingsSaveTimer.current = window.setTimeout(() => {
      workingsSaveTimer.current = null
      if (!workingsHydratedRef.current) return
      void saveOridStockWorkings(
        workingsSavePayload(
          null,
          workingsRowsRef.current,
          estimatedSalesModeRef.current,
          estimatedSalesRef.current,
        ),
      ).catch((err) => {
        showError(getApiErrorMessage(err, 'Unable to save workings'))
      })
    }, WORKINGS_SAVE_DEBOUNCE_MS)
  }

  function applyEstimatedSalesMode(mode, salesMetrics) {
    const nextMode = normalizeEstimatedSalesMode(mode)
    estimatedSalesModeRef.current = nextMode
    setEstimatedSalesMode(nextMode)
    if (nextMode === 'manual') return
    const nextValue = draftFromNumber(sales50kgFromMode(nextMode, salesMetrics))
    estimatedSalesRef.current = nextValue
    setEstimatedSales50kg(nextValue)
  }

  function changeEstimatedSalesMode(mode) {
    applyEstimatedSalesMode(mode, oridDhallSales)
    scheduleWorkingsSave()
  }

  function changeEstimatedSales50kg(value) {
    if (estimatedSalesModeRef.current !== 'manual') return
    estimatedSalesRef.current = value
    setEstimatedSales50kg(value)
    scheduleWorkingsSave()
  }

  const baseWorkingsRows = useMemo(
    () => mergeOridWorkingsRows(oridWorkings?.rows ?? [], pendingLines, null),
    [oridWorkings, pendingLines],
  )

  const costingClosingOrid = baseWorkingsRows.find((row) => row.id === 'closing')?.orid

  const manufacturingDhall = useMemo(() => {
    const rows = buildOridCostingRows({
      rawQty: costingClosingOrid?.qty ?? null,
      rawRate: costingClosingOrid?.rate ?? null,
      rawValue: costingClosingOrid?.value ?? null,
      pctDrafts: costingPctDrafts,
      rateDrafts: costingRateDrafts,
      expensesPctDraft: costingExpensesPctDraft,
    })
    const dhall = rows.find((row) => row.kind === 'dhall')
    if (!dhall) return null
    if (dhall.qty == null && dhall.rate == null && dhall.value == null) return null
    return { qty: dhall.qty, rate: dhall.rate, value: dhall.value }
  }, [
    costingClosingOrid,
    costingPctDrafts,
    costingRateDrafts,
    costingExpensesPctDraft,
  ])

  const workingsRows = useMemo(
    () =>
      mergeOridWorkingsRows(
        oridWorkings?.rows ?? [],
        pendingLines,
        manufacturingDhall,
      ),
    [oridWorkings, pendingLines, manufacturingDhall],
  )

  useEffect(() => {
    workingsRowsRef.current = workingsRows
  }, [workingsRows])

  useEffect(() => {
    if (!workingsHydrated || loading) return
    scheduleWorkingsSave()
  }, [workingsHydrated, loading, workingsRows])

  useEffect(() => {
    if (isOridReport) return undefined
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
  }, [asOf, isOridReport, showError])

  useEffect(() => {
    if (!isOridReport) return undefined
    let cancelled = false
    setLoading(true)
    setCostingHydrated(false)
    setWorkingsHydrated(false)
    workingsHydratedRef.current = false
    if (workingsSaveTimer.current) {
      window.clearTimeout(workingsSaveTimer.current)
      workingsSaveTimer.current = null
    }
    void Promise.all([
      fetchOridStockAnalysisWorkings(),
      fetchOridStockPendings(),
      fetchOridStockCosting(),
      fetchOridStockWorkings(),
      fetchOridDhallSales50kg(),
    ])
      .then(async ([workings, pendings, costing, savedWorkings, dhallSales]) => {
        if (cancelled) return
        setOridWorkings(workings)
        setOridDhallSales(dhallSales)
        const rows = await migrateLocalPendingsIfNeeded(pendings?.rows ?? [])
        if (cancelled) return
        setPendingLines(rows.map(mapPendingApiRow))
        const drafts = applyCostingApiToDrafts(costing)
        setCostingPctDrafts(drafts.pctDrafts)
        setCostingRateDrafts(drafts.rateDrafts)
        setCostingExpensesPctDraft(drafts.expensesPctDraft)
        setCostingHydrated(true)
        const savedMode = normalizeEstimatedSalesMode(
          savedWorkings?.estimated_sales_mode,
        )
        estimatedSalesModeRef.current = savedMode
        setEstimatedSalesMode(savedMode)
        if (savedMode === 'manual') {
          const salesDraft = draftFromNumber(savedWorkings?.estimated_sales_50kg)
          estimatedSalesRef.current = salesDraft
          setEstimatedSales50kg(salesDraft)
        } else {
          applyEstimatedSalesMode(savedMode, dhallSales)
        }
        setWorkingsHydrated(true)
        workingsHydratedRef.current = true
      })
      .catch((err) => {
        if (!cancelled) {
          setOridWorkings(null)
          setOridDhallSales(null)
          setPendingLines([])
          setCostingHydrated(false)
          setWorkingsHydrated(false)
          workingsHydratedRef.current = false
          showError(getApiErrorMessage(err, 'Unable to load Orid stock analysis'))
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [isOridReport, showError])

  function syncHorizontalScroll(source) {
    if (syncing.current) return
    syncing.current = true
    const left = source.scrollLeft
    if (headRef.current && headRef.current !== source) headRef.current.scrollLeft = left
    if (bodyRef.current && bodyRef.current !== source) bodyRef.current.scrollLeft = left
    if (footRef.current && footRef.current !== source) footRef.current.scrollLeft = left
    syncing.current = false
  }

  const allRows = analysis?.rows ?? []
  const rows = useMemo(() => {
    if (isOridReport) return []
    return allRows.filter((row) => matchesCommodityFilter(rowGroupLabel(row), commodity))
  }, [allRows, commodity, isOridReport])

  const totals = useMemo(() => {
    if (commodity === '' && analysis) {
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
  }, [analysis, commodity, rows])

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
  const showFooter = !loading && !isOridReport && rows.length > 0
  const avgMonths = analysis?.avg_3_months_months || 3
  const activeFilter = COMMODITY_FILTERS.find((opt) => opt.value === commodity)?.label || 'All'

  const pageTitle = oridOnly ? 'Orid Stock Analysis' : 'Stock Analysis'

  return (
    <PrimaryContentLayout
      breadcrumb={[{ label: 'Reports' }, { label: pageTitle }]}
      title={pageTitle}
    >
      {oridOnly ? null : (
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
      )}

      {isOridReport ? (
        <OridReportTabs
          activeTab={oridTab}
          onChange={setOridTab}
          workingsRows={workingsRows}
          estimatedSalesMode={estimatedSalesMode}
          estimatedSales50kg={estimatedSales50kg}
          onEstimatedSalesModeChange={changeEstimatedSalesMode}
          onEstimatedSales50kgChange={changeEstimatedSales50kg}
          pendingLines={pendingLines}
          onAddPendingLine={addPendingLine}
          onChangePendingLine={changePendingLine}
          pendingBusy={pendingBusy}
          costingPctDrafts={costingPctDrafts}
          costingRateDrafts={costingRateDrafts}
          costingExpensesPctDraft={costingExpensesPctDraft}
          onCostingPctChange={changeCostingPct}
          onCostingRateChange={changeCostingRate}
          onCostingExpensesPctChange={changeCostingExpensesPct}
        />
      ) : (
        <div className="stock-analysis__table-wrap mt-1">
          <div
            className="stock-analysis__table-head"
            ref={headRef}
            onScroll={(event) => syncHorizontalScroll(event.currentTarget)}
          >
            <table className={tableClass}>
              <TableColGroup />
              <thead>
                <HeaderRow avgMonths={avgMonths} />
              </thead>
            </table>
          </div>

          <div
            className="stock-analysis__table-scroll"
            ref={bodyRef}
            onScroll={(event) => syncHorizontalScroll(event.currentTarget)}
          >
            <table className={tableClass}>
              <TableColGroup />
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={COL_COUNT} className="win-form__table-empty">
                      Loading…
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={COL_COUNT} className="win-form__table-empty">
                      {commodity
                        ? `No stock or sales data for ${activeFilter}.`
                        : 'No stock or sales data found.'}
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => <DataRow key={rowGroupLabel(row)} row={row} />)
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
                <TableColGroup />
                <tbody>
                  <tr>
                    <td>
                      <span className="win-form__table-total-label">
                        Total ({rows.length} groups)
                      </span>
                    </td>
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
      )}
    </PrimaryContentLayout>
  )
}

