import { ListBulletIcon } from '@heroicons/react/24/outline'
import { useEffect, useMemo, useState } from 'react'
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { fetchMonthlyRateGroups } from '../../api/reports'
import { Modal } from '../common/Modal'
import { formatCommaNumber } from '../../utils/formatNumber'
import { getApiErrorMessage } from '../../utils/formValidation'

const COL_COUNT = 8

function money(value) {
  return value == null ? '—' : formatCommaNumber(value, 2)
}

function rateOf(value, quintal) {
  return quintal ? value / quintal : null
}

function RateTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const row = payload[0].payload
  return (
    <div className="rate-groups-chart__tooltip">
      <strong>Tally rate {money(row.line_rate)}</strong>
      <span>{formatCommaNumber(row.bags, 2)} bags · {row.share}%</span>
      <span>Rate {money(row.gross_rate)}</span>
      <span>Nett Rate {money(row.rate)}</span>
    </div>
  )
}

/** Monthly Summary drill-down: Tally lines for a row grouped by line rate. */
export function RateGroupsModal({ title, kind, year, month, stockGroups, onClose }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const groupsKey = stockGroups.join('|')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    fetchMonthlyRateGroups({ year, month, kind, stockGroups: groupsKey.split('|') })
      .then((data) => {
        if (!cancelled) setItems(data.items ?? [])
      })
      .catch((err) => {
        if (!cancelled) {
          setItems([])
          setError(getApiErrorMessage(err, 'Failed to load rate groups'))
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [year, month, kind, groupsKey])

  const total = items.reduce(
    (acc, row) => ({
      bags: acc.bags + row.bags,
      quintal: acc.quintal + row.quintal,
      gross: acc.gross + row.gross_value,
      discount: acc.discount + row.discount,
      value: acc.value + row.value,
    }),
    { bags: 0, quintal: 0, gross: 0, discount: 0, value: 0 },
  )

  // Bags sold/bought at each Tally rate, lowest rate on the left.
  const chartData = useMemo(() => {
    const totalBags = items.reduce((acc, row) => acc + row.bags, 0)
    return [...items]
      .sort((a, b) => (a.line_rate ?? 0) - (b.line_rate ?? 0))
      .map((row) => ({
        ...row,
        label: row.line_rate == null ? '—' : formatCommaNumber(row.line_rate, 2),
        share: totalBags ? formatCommaNumber((row.bags / totalBags) * 100, 1) : '0',
      }))
  }, [items])

  return (
    <Modal
      title={`${title} — Rates`}
      titleIcon={ListBulletIcon}
      onClose={onClose}
      ariaLabelledBy="monthly-summary-rate-groups-title"
      className="dc-search-modal"
    >
      <div className="dc-search-layout">

        {error ? <p className="dc-search-error">{error}</p> : null}

        {!loading && chartData.length > 0 ? (
          <div className="rate-groups-chart" aria-label="50kg bags by Tally rate">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={chartData}
                margin={{ top: 8, right: 8, left: 0, bottom: 4 }}
              >
                <CartesianGrid
                  stroke="rgba(255,255,255,0.06)"
                  vertical={false}
                  strokeDasharray="3 6"
                />
                <XAxis
                  dataKey="label"
                  tick={{ fill: '#9a958c', fontSize: 11 }}
                  axisLine={{ stroke: '#2a2e36' }}
                  tickLine={false}
                  interval={0}
                />
                <YAxis
                  yAxisId="bags"
                  tickFormatter={(v) => formatCommaNumber(v, 0)}
                  tick={{ fill: '#9a958c', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  width={48}
                />
                <Tooltip content={<RateTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                <Bar
                  yAxisId="bags"
                  dataKey="bags"
                  name="50kg Bags"
                  fill="#d4a35c"
                  radius={[2, 2, 0, 0]}
                  maxBarSize={28}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        ) : null}

        <div className="dc-search-panel">
          <div className="dc-search-table-wrap">
            <table className="dc-search-table">
              <thead>
                <tr>
                  <th className="dc-search-num">Tally Rate</th>
                  <th className="dc-search-num">Invoices</th>
                  <th className="dc-search-num">50kg Bags</th>
                  <th className="dc-search-num">Gross Value</th>
                  <th className="dc-search-num">Rate</th>
                  <th className="dc-search-num">Discount</th>
                  <th className="dc-search-num">Net Value</th>
                  <th className="dc-search-num">Nett Rate</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={COL_COUNT} className="dc-search-empty">
                      Loading…
                    </td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={COL_COUNT} className="dc-search-empty">
                      No lines for this month.
                    </td>
                  </tr>
                ) : (
                  items.map((row) => (
                    <tr key={String(row.line_rate)}>
                      <td className="dc-search-num">{money(row.line_rate)}</td>
                      <td className="dc-search-num">{row.invoices}</td>
                      <td className="dc-search-num">{formatCommaNumber(row.bags, 2)}</td>
                      <td className="dc-search-num">{money(row.gross_value)}</td>
                      <td className="dc-search-num">{money(row.gross_rate)}</td>
                      <td className="dc-search-num">{money(row.discount)}</td>
                      <td className="dc-search-num">{money(row.value)}</td>
                      <td className="dc-search-num">
                        <strong>{money(row.rate)}</strong>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {!loading && items.length > 0 ? (
                <tfoot>
                  <tr>
                    <td>
                      <span className="win-form__table-total-label">Total</span>
                    </td>
                    <td />
                    <td className="dc-search-num">
                      <strong>{formatCommaNumber(total.bags, 2)}</strong>
                    </td>
                    <td className="dc-search-num">
                      <strong>{money(total.gross)}</strong>
                    </td>
                    <td className="dc-search-num">
                      <strong>{money(rateOf(total.gross, total.quintal))}</strong>
                    </td>
                    <td className="dc-search-num">
                      <strong>{money(total.discount)}</strong>
                    </td>
                    <td className="dc-search-num">
                      <strong>{money(total.value)}</strong>
                    </td>
                    <td className="dc-search-num">
                      <strong>{money(rateOf(total.value, total.quintal))}</strong>
                    </td>
                  </tr>
                </tfoot>
              ) : null}
            </table>
          </div>
        </div>
      </div>
    </Modal>
  )
}
