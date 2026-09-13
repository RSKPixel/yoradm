import { useEffect, useMemo, useRef, useState } from 'react'
import { fetchPurchaseAnalysis } from '../api/tally'
import { FormField, FormInput, FormSelect } from '../components/form/FormPanel'
import { useFormMessage } from '../components/form/FormMessage'
import { PrimaryContentLayout } from '../components/layout/PrimaryContentLayout'
import { PurchaseProductionYieldModal } from '../components/purchases/PurchaseProductionYieldModal'
import { formatDate, todayIsoDate } from '../utils/formatDate'
import { formatQty, formatValue } from '../utils/formatNumber'
import { getApiErrorMessage } from '../utils/formValidation'

const COL_COUNT = 8

const tableClass = 'win-form__table win-form__table--bordered purchases-report__table w-full text-sm'

const tableColGroup = (
  <colgroup>
    <col className="purchases-report__col-date" />
    <col className="purchases-report__col-party" />
    <col className="purchases-report__col-item" />
    <col className="purchases-report__col-num" />
    <col className="purchases-report__col-num" />
    <col className="purchases-report__col-num" />
    <col className="purchases-report__col-num" />
    <col className="purchases-report__col-status" />
  </colgroup>
)

function daysAgoIso(days) {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function HeaderRow() {
  return (
    <tr>
      <th>Date</th>
      <th>Party</th>
      <th>Stock item</th>
      <th className="win-form__table-num">Qty</th>
      <th className="win-form__table-num">Weight</th>
      <th className="win-form__table-num">Rate</th>
      <th className="win-form__table-num">Value</th>
      <th>Production status</th>
    </tr>
  )
}

function hasClosedYield(row) {
  return row.production_status === 'Closed' && row.production_yield
}

function ProductionStatusCell({ row, onOpenYield }) {
  const showYield = hasClosedYield(row)

  if (!showYield) {
    return <td>{row.production_status || '—'}</td>
  }

  return (
    <td>
      <button
        type="button"
        className="purchases-report__status-button"
        onClick={() => onOpenYield(row)}
      >
        {row.production_status}
      </button>
    </td>
  )
}

function DataRow({ row, onOpenYield }) {
  return (
    <tr>
      <td>{formatDate(row.voucher_date) || '—'}</td>
      <td className="purchases-report__party" title={row.ledger_name || ''}>
        {row.ledger_name || '—'}
      </td>
      <td className="purchases-report__item" title={row.stock_item || ''}>
        {row.stock_item || '—'}
      </td>
      <td className="win-form__table-num">
        <span className="win-form__table-readonly">
          {row.qty == null ? '—' : formatQty(row.qty)}
        </span>
      </td>
      <td className="win-form__table-num">
        <span className="win-form__table-readonly">
          {row.weight == null ? '—' : formatQty(row.weight)}
        </span>
      </td>
      <td className="win-form__table-num">
        <span className="win-form__table-readonly">
          {row.rate == null ? '—' : formatValue(row.rate)}
        </span>
      </td>
      <td className="win-form__table-num">
        <span className="win-form__table-readonly">{formatValue(row.amount)}</span>
      </td>
      <ProductionStatusCell row={row} onOpenYield={onOpenYield} />
    </tr>
  )
}

export function PurchasesPage() {
  const { showError } = useFormMessage()
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(true)
  const [dateFrom, setDateFrom] = useState(() => daysAgoIso(29))
  const [dateTo, setDateTo] = useState(todayIsoDate)
  const [party, setParty] = useState('')
  const [stockItem, setStockItem] = useState('')
  const [partyFilter, setPartyFilter] = useState('')
  const [yieldRow, setYieldRow] = useState(null)

  const headRef = useRef(null)
  const bodyRef = useRef(null)
  const footRef = useRef(null)
  const syncing = useRef(false)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPartyFilter(party.trim())
    }, 300)
    return () => window.clearTimeout(timer)
  }, [party])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void fetchPurchaseAnalysis({
      dateFrom,
      dateTo,
      party: partyFilter || undefined,
      stockItem: stockItem || undefined,
    })
      .then((data) => {
        if (cancelled) return
        setReport(data)
        const options = Array.isArray(data?.stock_items) ? data.stock_items : []
        if (stockItem && !options.includes(stockItem)) {
          setStockItem('')
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setReport(null)
          showError(getApiErrorMessage(err, 'Unable to load purchases report'))
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [dateFrom, dateTo, partyFilter, stockItem, showError])

  function syncHorizontalScroll(source) {
    if (syncing.current) return
    syncing.current = true
    const left = source.scrollLeft
    if (headRef.current && headRef.current !== source) headRef.current.scrollLeft = left
    if (bodyRef.current && bodyRef.current !== source) bodyRef.current.scrollLeft = left
    if (footRef.current && footRef.current !== source) footRef.current.scrollLeft = left
    syncing.current = false
  }

  const rows = report?.rows ?? []
  const stockItems = report?.stock_items ?? []
  const totals = useMemo(() => {
    return rows.reduce(
      (acc, row) => {
        acc.qty += Number(row.qty) || 0
        acc.weight += Number(row.weight) || 0
        acc.amount += Number(row.amount) || 0
        return acc
      },
      { qty: 0, weight: 0, amount: 0 },
    )
  }, [rows])
  const totalAmount =
    report && Number.isFinite(Number(report.total_amount))
      ? Number(report.total_amount)
      : totals.amount
  const showFooter = !loading && rows.length > 0

  return (
    <PrimaryContentLayout
      breadcrumb={[{ label: 'Reports' }, { label: 'Purchases' }]}
      title="Purchases"
    >
      <div className="recv-toolbar shrink-0">
        <div className="grid min-w-0 flex-1 grid-cols-2 gap-x-3 gap-y-2 lg:grid-cols-4 lg:max-w-4xl">
          <FormField label="Date from">
            <FormInput
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              disabled={loading}
            />
          </FormField>
          <FormField label="Date to">
            <FormInput
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              disabled={loading}
            />
          </FormField>
          <FormField label="Party">
            <FormInput
              type="text"
              value={party}
              onChange={(e) => setParty(e.target.value)}
              disabled={loading}
            />
          </FormField>
          <FormField label="Stock item">
            <FormSelect
              value={stockItem}
              onChange={(e) => setStockItem(e.target.value)}
              disabled={loading}
            >
              <option value="">All stock items</option>
              {stockItems.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </FormSelect>
          </FormField>
        </div>
      </div>

      <div className="purchases-report__table-wrap mt-1">
        <div
          className="purchases-report__table-head"
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
          className="purchases-report__table-scroll"
          ref={bodyRef}
          onScroll={(event) => syncHorizontalScroll(event.currentTarget)}
        >
          <table className={tableClass}>
            {tableColGroup}
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
                    No purchase lines for the selected filters.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <DataRow key={row.id} row={row} onOpenYield={setYieldRow} />
                ))
              )}
            </tbody>
          </table>
        </div>

        {showFooter ? (
          <div
            className="purchases-report__table-foot"
            ref={footRef}
            onScroll={(event) => syncHorizontalScroll(event.currentTarget)}
          >
            <table className={tableClass}>
              {tableColGroup}
              <tbody>
                <tr>
                  <td colSpan={3}>
                    <span className="win-form__table-total-label">
                      Total ({rows.length} lines)
                    </span>
                  </td>
                  <td className="win-form__table-num">
                    <span className="win-form__table-readonly">{formatQty(totals.qty)}</span>
                  </td>
                  <td className="win-form__table-num">
                    <span className="win-form__table-readonly">{formatQty(totals.weight)}</span>
                  </td>
                  <td />
                  <td className="win-form__table-num">
                    <span className="win-form__table-readonly">{formatValue(totalAmount)}</span>
                  </td>
                  <td />
                </tr>
              </tbody>
            </table>
          </div>
        ) : null}
      </div>

      {yieldRow ? (
        <PurchaseProductionYieldModal row={yieldRow} onClose={() => setYieldRow(null)} />
      ) : null}
    </PrimaryContentLayout>
  )
}
