import { MagnifyingGlassIcon } from '@heroicons/react/24/outline'
import { useEffect, useMemo, useState } from 'react'
import {
  fetchOridDhallPeriodOptions,
  searchOridDhallProductions,
  updateOridDhallProductionStatus,
} from '../../api/oridDhallProduction'
import { Modal } from '../common/Modal'
import { FormField, FormSelect } from '../form/FormPanel'
import { formatCommaNumber } from '../../utils/formatNumber'
import { formatDate } from '../../utils/formatDate'
import {
  FY_MONTHS,
  dateRangeForFinancialYear,
} from '../../utils/financialYear'
import { getApiErrorMessage } from '../../utils/formValidation'

const MONTH_ALL = 'all'
const STATUS_OPEN = 'Open'
const STATUS_CLOSED = 'Closed'

const MONTH_LABELS = Object.fromEntries(
  FY_MONTHS.map((m) => [m.value, m.label]),
)

function formatQtyPct(qty, pct) {
  const qtyText =
    qty == null || qty === '' ? '' : formatCommaNumber(qty, 2)
  const pctText =
    pct == null || pct === '' ? '' : `${formatCommaNumber(pct, 2)}%`
  if (!qtyText && !pctText) return null
  return (
    <>
      {qtyText ? <div>{qtyText}</div> : null}
      {pctText ? <div>{pctText}</div> : null}
    </>
  )
}

function sumQty(items, key) {
  let total = 0
  let any = false
  for (const row of items) {
    const n = Number(row[key])
    if (!Number.isFinite(n)) continue
    total += n
    any = true
  }
  return any ? total : null
}

function weightedPct(items, pctKey, weightKey = 'orid_raw_qty') {
  let weightSum = 0
  let weighted = 0
  for (const row of items) {
    const weight = Number(row[weightKey])
    const pct = Number(row[pctKey])
    if (!Number.isFinite(weight) || weight <= 0 || !Number.isFinite(pct)) continue
    weightSum += weight
    weighted += pct * weight
  }
  return weightSum > 0 ? weighted / weightSum : null
}

export function OridDhallProductionSearchModal({
  onClose,
  onSelect,
  onStatusChange,
}) {
  const [periodYears, setPeriodYears] = useState([])
  const [periodsLoading, setPeriodsLoading] = useState(true)
  const [financialYear, setFinancialYear] = useState('')
  const [month, setMonth] = useState(MONTH_ALL)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [statusSavingId, setStatusSavingId] = useState(null)

  const selectedYear = useMemo(
    () =>
      periodYears.find((y) => String(y.fy_start) === String(financialYear)) ||
      null,
    [periodYears, financialYear],
  )

  const monthOptions = selectedYear?.months ?? []

  const { dateFrom, dateTo } = useMemo(() => {
    if (!financialYear) return { dateFrom: '', dateTo: '' }
    return dateRangeForFinancialYear(financialYear, month)
  }, [financialYear, month])

  const totals = useMemo(() => {
    // Open lots are incomplete — footer totals use Closed only.
    const closed = items.filter(
      (row) => (row.status || STATUS_OPEN) === STATUS_CLOSED,
    )
    const rawQty = sumQty(closed, 'orid_raw_qty')
    return {
      rawQty,
      rawPct: rawQty != null && rawQty > 0 ? 100 : null,
      dhallQty: sumQty(closed, 'orid_dhall_qty'),
      dhallPct: weightedPct(closed, 'orid_dhall_pct'),
      splitQty: sumQty(closed, 'orid_dhall_split_qty'),
      splitPct: weightedPct(closed, 'orid_dhall_split_pct'),
      huskQty: sumQty(closed, 'orid_husk_qty'),
      huskPct: weightedPct(closed, 'orid_husk_pct'),
      overallPct: weightedPct(closed, 'overall_pct'),
      netValue: sumQty(closed, 'net_value'),
    }
  }, [items])

  useEffect(() => {
    let cancelled = false

    async function loadPeriods() {
      setPeriodsLoading(true)
      try {
        const data = await fetchOridDhallPeriodOptions()
        const years = data?.financial_years ?? []
        if (cancelled) return
        setPeriodYears(years)
        if (years.length) {
          const first = years[0]
          setFinancialYear(String(first.fy_start))
          const months = first.months ?? []
          setMonth(months.length ? String(months[months.length - 1]) : MONTH_ALL)
        } else {
          setFinancialYear('')
          setMonth(MONTH_ALL)
        }
      } catch (err) {
        if (!cancelled) {
          setPeriodYears([])
          setError(getApiErrorMessage(err, 'Failed to load period options'))
        }
      } finally {
        if (!cancelled) setPeriodsLoading(false)
      }
    }

    void loadPeriods()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!selectedYear) return
    const months = selectedYear.months ?? []
    if (month !== MONTH_ALL && !months.includes(Number(month))) {
      setMonth(months.length ? String(months[months.length - 1]) : MONTH_ALL)
    }
  }, [selectedYear, month])

  useEffect(() => {
    if (!dateFrom || !dateTo) {
      setItems([])
      setLoading(false)
      return undefined
    }

    let cancelled = false

    async function load() {
      setLoading(true)
      setError('')
      try {
        const data = await searchOridDhallProductions({
          dateFrom,
          dateTo,
          pageSize: 100,
        })
        if (!cancelled) setItems(data.items ?? [])
      } catch (err) {
        if (!cancelled) {
          setItems([])
          setError(getApiErrorMessage(err, 'Failed to load productions'))
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [dateFrom, dateTo])

  async function onRowStatusChange(row, nextStatus) {
    const status = nextStatus === STATUS_CLOSED ? STATUS_CLOSED : STATUS_OPEN
    if ((row.status || STATUS_OPEN) === status) return

    setStatusSavingId(row.id)
    setError('')
    try {
      await updateOridDhallProductionStatus(row.id, status)
      setItems((prev) =>
        prev.map((item) => (item.id === row.id ? { ...item, status } : item)),
      )
      onStatusChange?.(row.id, status)
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not update status'))
    } finally {
      setStatusSavingId(null)
    }
  }

  const busy = periodsLoading || loading
  const showFooter = !busy && items.length > 0

  return (
    <Modal
      title="Search Orid Dhall Production"
      titleIcon={MagnifyingGlassIcon}
      onClose={onClose}
      ariaLabelledBy="odp-search-modal-title"
      className="dc-search-modal"
    >
      <div className="dc-search-layout">
        <div className="dc-search-toolbar">
          <div className="dc-search-period">
            <FormField label="Financial Year" className="dc-search-field">
              <FormSelect
                value={financialYear}
                disabled={periodsLoading || periodYears.length === 0}
                onChange={(e) => setFinancialYear(e.target.value)}
              >
                {periodYears.length === 0 ? (
                  <option value="">No data</option>
                ) : (
                  periodYears.map((opt) => (
                    <option key={opt.fy_start} value={String(opt.fy_start)}>
                      {opt.label}
                    </option>
                  ))
                )}
              </FormSelect>
            </FormField>
            <FormField label="Month" className="dc-search-field">
              <FormSelect
                value={month}
                disabled={periodsLoading || !selectedYear}
                onChange={(e) => setMonth(e.target.value)}
              >
                <option value={MONTH_ALL}>All</option>
                {monthOptions.map((m) => (
                  <option key={m} value={String(m)}>
                    {MONTH_LABELS[m] || m}
                  </option>
                ))}
              </FormSelect>
            </FormField>
          </div>
          <p className="dc-search-count">
            {busy
              ? 'Loading…'
              : `${items.length} production${items.length === 1 ? '' : 's'}`}
          </p>
        </div>

        {error ? <p className="dc-search-error">{error}</p> : null}

        <div className="dc-search-panel">
          <div className="dc-search-table-shell">
            <div className="dc-search-table-scroll">
              <table className="dc-search-table">
                <thead>
                  <tr>
                    <th>Lot No.</th>
                    <th>Production Date</th>
                    <th className="dc-search-num">Orid Raw</th>
                    <th className="dc-search-num">Orid Dhall</th>
                    <th className="dc-search-num">
                      Orid Dhall
                      <br />
                      Split
                    </th>
                    <th className="dc-search-num">Orid Husk</th>
                    <th className="dc-search-num">
                      Overall
                      <br />
                      %
                    </th>
                    <th className="dc-search-num">
                      Net
                      <br />
                      Value
                    </th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {busy ? (
                    <tr>
                      <td colSpan={9} className="dc-search-empty">
                        Loading…
                      </td>
                    </tr>
                  ) : items.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="dc-search-empty">
                        No productions found for this period.
                      </td>
                    </tr>
                  ) : (
                    items.map((row) => (
                      <tr
                        key={row.id}
                        className="dc-search-row"
                        tabIndex={0}
                        onClick={() => onSelect(row.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            onSelect(row.id)
                          }
                        }}
                      >
                        <td>
                          <span className="dc-search-id">{row.lot_no || row.id}</span>
                        </td>
                        <td>{formatDate(row.production_date)}</td>
                        <td className="dc-search-num">
                          {formatQtyPct(row.orid_raw_qty, row.orid_raw_pct)}
                        </td>
                        <td className="dc-search-num">
                          {formatQtyPct(row.orid_dhall_qty, row.orid_dhall_pct)}
                        </td>
                        <td className="dc-search-num">
                          {formatQtyPct(
                            row.orid_dhall_split_qty,
                            row.orid_dhall_split_pct,
                          )}
                        </td>
                        <td className="dc-search-num">
                          {formatQtyPct(row.orid_husk_qty, row.orid_husk_pct)}
                        </td>
                        <td className="dc-search-num dc-search-num--bottom">
                          {row.overall_pct == null
                            ? ''
                            : `${formatCommaNumber(row.overall_pct, 2)}%`}
                        </td>
                        <td className="dc-search-num dc-search-num--bottom">
                          {row.net_value == null
                            ? ''
                            : formatCommaNumber(row.net_value, 2)}
                        </td>
                        <td
                          className="dc-search-num--bottom odp-search-status"
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => e.stopPropagation()}
                        >
                          <FormSelect
                            value={row.status || STATUS_OPEN}
                            disabled={statusSavingId === row.id}
                            onChange={(e) =>
                              void onRowStatusChange(row, e.target.value)
                            }
                            aria-label={`Status for lot ${row.lot_no || row.id}`}
                          >
                            <option value={STATUS_OPEN}>{STATUS_OPEN}</option>
                            <option value={STATUS_CLOSED}>{STATUS_CLOSED}</option>
                          </FormSelect>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {showFooter ? (
              <div className="dc-search-table-foot">
                <table className="dc-search-table">
                  <tbody>
                    <tr className="dc-search-total-row">
                      <td colSpan={2}>Total (Closed)</td>
                      <td className="dc-search-num">
                        {formatQtyPct(totals.rawQty, totals.rawPct)}
                      </td>
                      <td className="dc-search-num">
                        {formatQtyPct(totals.dhallQty, totals.dhallPct)}
                      </td>
                      <td className="dc-search-num">
                        {formatQtyPct(totals.splitQty, totals.splitPct)}
                      </td>
                      <td className="dc-search-num">
                        {formatQtyPct(totals.huskQty, totals.huskPct)}
                      </td>
                      <td className="dc-search-num dc-search-num--bottom">
                        {totals.overallPct == null
                          ? ''
                          : `${formatCommaNumber(totals.overallPct, 2)}%`}
                      </td>
                      <td className="dc-search-num dc-search-num--bottom">
                        {totals.netValue == null
                          ? ''
                          : formatCommaNumber(totals.netValue, 2)}
                      </td>
                      <td />
                    </tr>
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </Modal>
  )
}
