import { useCallback, useEffect, useRef, useState } from 'react'
import { syncTallyData } from '../api/tallyData'
import { useFormMessage } from '../components/form/FormMessage'
import { PrimaryContentLayout } from '../components/layout/PrimaryContentLayout'
import { getApiErrorMessage } from '../utils/formValidation'

const sessionFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'medium',
})

function formatTimestamp(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return sessionFormatter.format(date)
}

function formatCount(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return '—'
  return n.toLocaleString()
}

function stepLabel(step) {
  if (step.target_table === 'yoradm_sales') return 'Sales'
  if (step.target_table === 'yoradm_purchase') return 'Purchases'
  if (step.target_table === 'yoradm_daybook2') return 'Daybook2'
  return step.target_table
}

export function TallyDataPage() {
  const { showError } = useFormMessage()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const inFlightRef = useRef(false)

  const runSync = useCallback(async () => {
    if (inFlightRef.current) return
    inFlightRef.current = true
    setLoading(true)
    try {
      const result = await syncTallyData()
      setData(result)
    } catch (err) {
      showError(getApiErrorMessage(err, 'Could not sync Tally data'))
    } finally {
      inFlightRef.current = false
      setLoading(false)
    }
  }, [showError])

  useEffect(() => {
    void runSync()
  }, [runSync])

  const steps = data?.steps ?? []
  const statusLabel = loading
    ? 'Syncing…'
    : data
      ? `${steps.length} step${steps.length === 1 ? '' : 's'} · ${formatTimestamp(data.completed_at)}`
      : 'No sync yet'

  return (
    <PrimaryContentLayout
      title="Tally Data"
      breadcrumb={[{ label: 'Transactions' }, { label: 'Tally Data' }]}
      footer={
        <button
          type="button"
          className="win-form__button win-form__button--primary"
          onClick={() => void runSync()}
          disabled={loading}
        >
          {loading ? 'Syncing…' : 'Sync again'}
        </button>
      }
    >
      <div className="tally-data flex min-h-0 flex-1 flex-col gap-2">
        <div className="tally-data__toolbar shrink-0">
          <p className="dc-search-count">{statusLabel}</p>
          {data?.message ? (
            <p className="tally-data__message" title={data.message}>
              {data.message}
            </p>
          ) : null}
        </div>

        <div className="win-form__table-wrap win-form__table-shell">
          <div className="win-form__table-scroll">
            <table className="win-form__table win-form__table--bordered w-full text-sm">
              <thead>
                <tr>
                  <th>Step</th>
                  <th>Source → Target</th>
                  <th className="win-form__table-num">Tally rows</th>
                  <th className="win-form__table-num">Added</th>
                  <th className="win-form__table-num">Updated</th>
                  <th className="win-form__table-num">Unchanged</th>
                  <th className="win-form__table-num">Removed</th>
                  <th className="win-form__table-num">Before</th>
                  <th className="win-form__table-num">After</th>
                </tr>
              </thead>
              <tbody>
                {loading && steps.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="win-form__table-empty">
                      Syncing purchases, sales, and daybook2 from Tally…
                    </td>
                  </tr>
                ) : steps.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="win-form__table-empty">
                      No sync results yet. Click Sync again.
                    </td>
                  </tr>
                ) : (
                  steps.map((step) => (
                    <tr key={step.target_table}>
                      <td>{stepLabel(step)}</td>
                      <td>
                        {step.source_table} → {step.target_table}
                      </td>
                      <td className="win-form__table-num">
                        {formatCount(step.source_count)}
                      </td>
                      <td className="win-form__table-num">{formatCount(step.added)}</td>
                      <td className="win-form__table-num">
                        {formatCount(step.updated)}
                      </td>
                      <td className="win-form__table-num">
                        {formatCount(step.unchanged)}
                      </td>
                      <td className="win-form__table-num">
                        {formatCount(step.removed)}
                      </td>
                      <td className="win-form__table-num">
                        {formatCount(step.target_count_before)}
                      </td>
                      <td className="win-form__table-num">
                        {formatCount(step.target_count_after)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </PrimaryContentLayout>
  )
}
