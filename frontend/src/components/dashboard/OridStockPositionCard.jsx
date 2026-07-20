function formatBags50(value) {
  const num = Number(value)
  if (!Number.isFinite(num)) return '0'
  return Math.round(num).toLocaleString()
}

function formatBags100(value) {
  const num = Number(value)
  if (!Number.isFinite(num)) return '0'
  return Math.round(num).toLocaleString()
}

function formatAvgRate(value) {
  const num = Number(value)
  if (!Number.isFinite(num) || num === 0) return '—'
  return Math.round(num).toLocaleString()
}

/**
 * Admin dashboard tile: Orid + Orid Dhall purchase stock
 * not yet selected on any Orid Dhall production.
 */
export function OridStockPositionCard({ data, error, onOpen }) {
  const items = data?.items ?? []
  const canOpen = Boolean(data) && items.some((item) => (item.lines?.length || item.voucher_count) > 0)

  return (
    <section className="dashboard-section dashboard-section--orid" aria-label="Orid stock position">
      <div className="dashboard-section__head">
        <button
          type="button"
          className="dashboard-section__title-btn"
          onClick={onOpen}
          disabled={!canOpen}
        >
          Orid Stock Position
        </button>
      </div>

      {error ? <p className="mt-2 text-sm text-red-400">{error}</p> : null}
      {!data && !error ? <p className="mt-2 text-sm text-(--muted)">Loading…</p> : null}
      {data && items.length === 0 ? (
        <p className="mt-2 text-sm text-(--muted)">No unselected Orid stock.</p>
      ) : null}

      {items.length > 0 ? (
        <div className="dashboard-section__body">
          <div className="dashboard-orid-grid dashboard-orid-grid--head" aria-hidden="true">
            <span>Stock</span>
            <span>50kg</span>
            <span>100kg</span>
            <span>Avg</span>
          </div>
          <ul className="dashboard-section__list">
            {items.map((item) => (
              <li key={item.stock_group}>
                <button
                  type="button"
                  className="dashboard-orid-grid dashboard-orid-grid--row"
                  onClick={onOpen}
                  disabled={!canOpen}
                >
                  <span className="dashboard-section__group" title={item.label || item.stock_group}>
                    {item.label || item.stock_group}
                    <span className="text-(--muted)"> ({item.voucher_count})</span>
                  </span>
                  <span className="dashboard-section__num">{formatBags50(item.bags_50)}</span>
                  <span className="dashboard-section__num">{formatBags100(item.bags_100)}</span>
                  <span className="dashboard-section__num">{formatAvgRate(item.avg_rate)}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  )
}
