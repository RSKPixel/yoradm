import { useEffect, useState } from 'react'
import api from '../api/client'

export function DashboardPage() {
  const [stats, setStats] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    void api
      .get('/tally/dashboard')
      .then((res) => setStats(res.data))
      .catch(() => setError('Unable to load dashboard stats'))
  }, [])

  const cards = stats
    ? [
        { label: 'Accounts', value: stats.accounts },
        { label: 'Inventory items', value: stats.inventory_items },
        { label: 'Sales rows', value: stats.sales_rows },
        { label: 'Purchase rows', value: stats.purchase_rows },
        { label: 'Receivables', value: stats.receivables },
        { label: 'Stock movements', value: stats.stock_movements },
      ]
    : []

  return (
    <div>
      <h1 className="font-(family-name:--font-display) text-3xl tracking-tight">Dashboard</h1>
      <p className="mt-1 text-(--muted)">Live counts from Tally sync tables</p>
      {error && <p className="mt-4 text-sm text-red-400">{error}</p>}
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <div key={card.label} className="border-b border-(--line) pb-4">
            <p className="text-sm text-(--muted)">{card.label}</p>
            <p className="mt-1 font-(family-name:--font-display) text-4xl tabular-nums text-(--accent)">
              {card.value.toLocaleString()}
            </p>
          </div>
        ))}
        {!stats && !error && <p className="text-(--muted)">Loading…</p>}
      </div>
    </div>
  )
}
