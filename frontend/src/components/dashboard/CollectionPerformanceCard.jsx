import { FormDropdown } from '../form/FormDropdown'
import { formatCommaNumber } from '../../utils/formatNumber'

const BUCKET_COLORS = {
  '0-30': '#8fbf8a',
  '31-60': '#d4a35c',
  '61-90': '#c48a72',
  'gt-90': '#b56b6b',
}

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

function formatDays(value) {
  const num = Number(value)
  if (!Number.isFinite(num)) return '—'
  return `${formatCommaNumber(num, 0)}d`
}

export function CollectionPerformanceCard({
  data,
  error,
  periodOptions,
  periodValue,
  onPeriodChange,
  representativeOptions,
  representativeValue,
  onRepresentativeChange,
}) {
  const buckets = data?.buckets ?? []
  const maxAmount = Math.max(...buckets.map((b) => Number(b.amount) || 0), 0)

  return (
    <section className="dashboard-section dashboard-section--collection" aria-label="Collection performance">
      <div className="dashboard-section__head dashboard-trade__head">
        <h2 className="dashboard-section__title">Collection</h2>
        <div className="dashboard-collection__filters">
          <FormDropdown
            className="dashboard-section__period"
            listClassName="dashboard-section__period-list"
            options={periodOptions}
            value={periodValue}
            onChange={onPeriodChange}
            placeholder="Select period"
            emptyMessage="No periods"
          />
          <FormDropdown
            className="dashboard-section__period dashboard-collection__rep"
            listClassName="dashboard-section__period-list"
            options={representativeOptions}
            value={representativeValue}
            onChange={onRepresentativeChange}
            placeholder="All representatives"
            emptyMessage="No representatives"
          />
        </div>
      </div>

      {error ? <p className="mt-2 text-sm text-red-400">{error}</p> : null}
      {!data && !error ? <p className="mt-2 text-sm text-(--muted)">Loading…</p> : null}

      {data ? (
        <div className="dashboard-collection">
          <div className="dashboard-collection__summary">
            <div>
              <span className="dashboard-trade__kpi-label">Collected</span>
              <strong className="dashboard-collection__total">
                {formatCompactInr(data.matched_amount)}
              </strong>
            </div>
            <div>
              <span className="dashboard-trade__kpi-label">Avg days</span>
              <strong className="dashboard-collection__total">
                {formatDays(data.avg_days)}
              </strong>
            </div>
          </div>

          <ul className="dashboard-collection__bars">
            {buckets.map((bucket) => {
              const amount = Number(bucket.amount) || 0
              const widthPct = maxAmount > 0 ? (amount / maxAmount) * 100 : 0
              const color = BUCKET_COLORS[bucket.key] || '#9a958c'
              return (
                <li key={bucket.key} className="dashboard-collection__row">
                  <span className="dashboard-collection__label">{bucket.label}</span>
                  <div className="dashboard-collection__track" aria-hidden="true">
                    <span
                      className="dashboard-collection__fill"
                      style={{ width: `${widthPct}%`, background: color }}
                    />
                  </div>
                  <span className="dashboard-collection__amount">
                    {formatCompactInr(amount)}
                  </span>
                  <span className="dashboard-collection__pct">
                    {formatCommaNumber(bucket.pct || 0, 0)}%
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
      ) : null}
    </section>
  )
}
