import { useEffect, useState } from 'react'
import { fetchPendingDeliveriesByStockGroup } from '../api/deliveryChallan'
import { PendingDeliveriesModal } from '../components/dashboard/PendingDeliveriesModal'
import { getApiErrorMessage } from '../utils/formValidation'

function formatBags50(value) {
  const num = Number(value)
  if (!Number.isFinite(num)) return '0'
  return Math.round(num).toLocaleString()
}

function formatBags100(value) {
  const num = Number(value)
  if (!Number.isFinite(num)) return '0.00'
  return num.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function PendingDeliveriesSection({ pending, error, onOpen }) {
  const items = pending?.items ?? []
  const canOpen = Boolean(pending) && items.length > 0

  return (
    <section className="dashboard-section" aria-label="Pending deliveries">
      <div className="dashboard-section__head">
        <button
          type="button"
          className="dashboard-section__title-btn"
          onClick={onOpen}
          disabled={!canOpen}
        >
          Pending deliveries
        </button>
      </div>

      {error ? <p className="mt-3 text-sm text-red-400">{error}</p> : null}
      {!pending && !error ? <p className="mt-3 text-sm text-(--muted)">Loading…</p> : null}
      {pending && items.length === 0 ? (
        <p className="mt-3 text-sm text-(--muted)">No pending invoices.</p>
      ) : null}

      {items.length > 0 ? (
        <div className="mt-3">
          <div className="dashboard-section__cols" aria-hidden="true">
            <span>Stock group</span>
            <span>/50kgs</span>
            <span>/100kgs</span>
          </div>
          <ul className="dashboard-section__list">
            {items.map((item) => (
              <li key={item.stock_group}>
                <button type="button" className="dashboard-section__row" onClick={onOpen}>
                  <span className="dashboard-section__group">
                    {item.stock_group}
                    <span className="text-(--muted)"> ({item.invoice_count})</span>
                  </span>
                  <span className="dashboard-section__num">{formatBags50(item.bags_50)}</span>
                  <span className="dashboard-section__num">{formatBags100(item.bags_100)}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  )
}

export function DashboardPage() {
  const [pending, setPending] = useState(null)
  const [error, setError] = useState('')
  const [modalOpen, setModalOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    void fetchPendingDeliveriesByStockGroup()
      .then((data) => {
        if (!cancelled) setPending(data)
      })
      .catch((err) => {
        if (!cancelled) setError(getApiErrorMessage(err, 'Unable to load pending deliveries'))
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div>
      <div className="dashboard-grid" aria-label="Dashboard tiles">
        <PendingDeliveriesSection
          pending={pending}
          error={error}
          onOpen={() => setModalOpen(true)}
        />
      </div>

      {modalOpen ? (
        <PendingDeliveriesModal
          items={pending?.items ?? []}
          onClose={() => setModalOpen(false)}
        />
      ) : null}
    </div>
  )
}
