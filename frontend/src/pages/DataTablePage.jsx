import { useEffect, useState } from 'react'
import api from '../api/client'

export function DataTablePage({ title, subtitle, endpoint, columns }) {
  const [rows, setRows] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [error, setError] = useState('')
  const pageSize = 20

  useEffect(() => {
    void api
      .get(endpoint, { params: { page, page_size: pageSize } })
      .then((res) => {
        setRows(res.data.items)
        setTotal(res.data.total)
        setPages(res.data.pages || 1)
      })
      .catch(() => setError('Failed to load data'))
  }, [endpoint, page])

  return (
    <div>
      <h1 className="font-(family-name:--font-display) text-3xl tracking-tight">{title}</h1>
      <p className="mt-1 text-(--muted)">
        {subtitle} · {total.toLocaleString()} records
      </p>
      {error && <p className="mt-4 text-sm text-red-400">{error}</p>}
      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b border-(--line) text-(--muted)">
              {columns.map((col) => (
                <th key={String(col.key)} className="px-2 py-3 font-medium">
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-(--line)/70">
                {columns.map((col) => (
                  <td key={String(col.key)} className="px-2 py-3 align-top">
                    {col.render ? col.render(row) : String(row[col.key] ?? '—')}
                  </td>
                ))}
              </tr>
            ))}
            {!rows.length && !error && (
              <tr>
                <td colSpan={columns.length} className="py-8 text-(--muted)">
                  Loading…
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="mt-4 flex items-center gap-3 text-sm">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => setPage((p) => p - 1)}
          className="rounded border border-(--line) px-3 py-1 disabled:opacity-40"
        >
          Previous
        </button>
        <span className="text-(--muted)">
          Page {page} of {pages}
        </span>
        <button
          type="button"
          disabled={page >= pages}
          onClick={() => setPage((p) => p + 1)}
          className="rounded border border-(--line) px-3 py-1 disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  )
}
