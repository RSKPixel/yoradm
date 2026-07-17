import { useMemo } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { formatCommaNumber } from '../../utils/formatNumber'

const SALES_COLOR = '#d4a35c'
const PURCHASE_COLOR = '#6f8fad'
const RECEIPT_COLOR = '#8fbf8a'
const PAYMENT_COLOR = '#c48a72'

function formatCompactInr(value) {
  const num = Number(value)
  if (!Number.isFinite(num)) return '—'
  const abs = Math.abs(num)
  const sign = num < 0 ? '-' : ''
  if (abs >= 1_00_00_000) {
    return `${sign}${formatCommaNumber(abs / 1_00_00_000, 2)} Cr`
  }
  if (abs >= 1_00_000) {
    return `${sign}${formatCommaNumber(abs / 1_00_000, 2)} L`
  }
  if (abs >= 1_000) {
    return `${sign}${formatCommaNumber(abs / 1_000, 1)} K`
  }
  return `${sign}${formatCommaNumber(abs, 0)}`
}

function formatFullInr(value) {
  const num = Number(value)
  if (!Number.isFinite(num)) return '—'
  return `₹${formatCommaNumber(num, 0)}`
}

function pctLabel(pct) {
  if (pct == null || !Number.isFinite(Number(pct))) return '—'
  return `${formatCommaNumber(pct, 0)}%`
}

function TradeTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const point = payload[0]?.payload
  return (
    <div className="dashboard-trade__tooltip">
      <p className="dashboard-trade__tooltip-date">{point?.label || label}</p>
      <p>
        <span style={{ color: SALES_COLOR }}>Sales</span>
        <strong>{formatFullInr(point?.sales)}</strong>
        <em>{point?.sales_vouchers || 0}</em>
      </p>
      <p>
        <span style={{ color: PURCHASE_COLOR }}>Purchase</span>
        <strong>{formatFullInr(point?.purchase)}</strong>
        <em>{point?.purchase_vouchers || 0}</em>
      </p>
      <p>
        <span style={{ color: RECEIPT_COLOR }}>Receipt</span>
        <strong>{formatFullInr(point?.receipt)}</strong>
        <em>{point?.receipt_vouchers || 0}</em>
      </p>
      <p>
        <span style={{ color: PAYMENT_COLOR }}>Payment</span>
        <strong>{formatFullInr(point?.payment)}</strong>
        <em>{point?.payment_vouchers || 0}</em>
      </p>
    </div>
  )
}

export function SalesPurchaseTradeCard({ data, error }) {
  const chartData = useMemo(() => data?.points ?? [], [data])
  const tickInterval = 0

  return (
    <section
      className="dashboard-section dashboard-section--span-3 dashboard-section--trade"
      aria-label="Sales purchase receipt payment"
    >
      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      {!data && !error ? <p className="text-sm text-(--muted)">Loading…</p> : null}

      {data ? (
        <>
          <div className="dashboard-trade__kpis" role="group" aria-label="Trade KPIs">
            <div className="dashboard-trade__kpi">
              <span className="dashboard-trade__kpi-label">Sales</span>
              <strong className="dashboard-trade__kpi-value dashboard-trade__kpi-value--sales">
                {formatCompactInr(data.sales_total)}
              </strong>
            </div>
            <div className="dashboard-trade__kpi">
              <span className="dashboard-trade__kpi-label">Purchase</span>
              <strong className="dashboard-trade__kpi-value dashboard-trade__kpi-value--purchase">
                {formatCompactInr(data.purchase_total)}
              </strong>
            </div>
            <div className="dashboard-trade__kpi">
              <span className="dashboard-trade__kpi-label">Receipt</span>
              <strong className="dashboard-trade__kpi-value dashboard-trade__kpi-value--receipt">
                {formatCompactInr(data.receipt_total)}
              </strong>
            </div>
            <div className="dashboard-trade__kpi">
              <span className="dashboard-trade__kpi-label">Payment</span>
              <strong className="dashboard-trade__kpi-value dashboard-trade__kpi-value--payment">
                {formatCompactInr(data.payment_total)}
              </strong>
            </div>
            <div className="dashboard-trade__kpi">
              <span className="dashboard-trade__kpi-label">Collection</span>
              <strong className="dashboard-trade__kpi-value">
                {pctLabel(data.collection_pct)}
              </strong>
            </div>
          </div>

          <div className="dashboard-trade__chart">
            {chartData.length === 0 ? (
              <p className="text-sm text-(--muted)">No daybook activity in this period.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartData}
                  margin={{ top: 8, right: 4, left: 0, bottom: 4 }}
                  barCategoryGap="18%"
                  barGap={2}
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
                    interval={tickInterval}
                    minTickGap={8}
                  />
                  <YAxis
                    tickFormatter={formatCompactInr}
                    tick={{ fill: '#9a958c', fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    width={52}
                  />
                  <Tooltip
                    content={<TradeTooltip />}
                    cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                  />
                  <Legend
                    verticalAlign="top"
                    align="right"
                    iconType="circle"
                    iconSize={8}
                    wrapperStyle={{ fontSize: 11, color: '#9a958c', paddingBottom: 4 }}
                  />
                  <Bar
                    dataKey="sales"
                    name="Sales"
                    fill={SALES_COLOR}
                    radius={[2, 2, 0, 0]}
                    maxBarSize={18}
                  />
                  <Bar
                    dataKey="purchase"
                    name="Purchase"
                    fill={PURCHASE_COLOR}
                    radius={[2, 2, 0, 0]}
                    maxBarSize={18}
                  />
                  <Bar
                    dataKey="receipt"
                    name="Receipt"
                    fill={RECEIPT_COLOR}
                    radius={[2, 2, 0, 0]}
                    maxBarSize={18}
                  />
                  <Bar
                    dataKey="payment"
                    name="Payment"
                    fill={PAYMENT_COLOR}
                    radius={[2, 2, 0, 0]}
                    maxBarSize={18}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </>
      ) : null}
    </section>
  )
}
