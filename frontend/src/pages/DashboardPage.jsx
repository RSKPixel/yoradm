import { useEffect, useMemo, useState } from 'react'
import {
  fetchPendingDeliveriesByStockGroup,
  fetchTodayDeliveriesByStockGroup,
} from '../api/deliveryChallan'
import { PendingDeliveriesModal } from '../components/dashboard/PendingDeliveriesModal'
import { FormDropdown } from '../components/form/FormDropdown'
import { getApiErrorMessage } from '../utils/formValidation'
import { formatDate, todayIsoDate, toIsoDateInput } from '../utils/formatDate'

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

function startOfWeekMonday(day) {
  const offset = (day.getDay() + 6) % 7
  return new Date(day.getFullYear(), day.getMonth(), day.getDate() - offset)
}

function deliveryPeriodOptions() {
  const today = new Date()
  const todayIso = toIsoDateInput(today)
  const weekStart = startOfWeekMonday(today)
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
  const prevMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1)
  const prevMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0)

  const options = [
    {
      value: 'week',
      label: 'This Week',
      dateFrom: toIsoDateInput(weekStart),
      dateTo: todayIso,
      title: 'This Week',
      emptyMessage: 'No deliveries this week.',
    },
    {
      value: 'month',
      label: 'This Month',
      dateFrom: toIsoDateInput(monthStart),
      dateTo: todayIso,
      title: 'This Month',
      emptyMessage: 'No deliveries this month.',
    },
    {
      value: 'previous_month',
      label: 'Previous Month',
      dateFrom: toIsoDateInput(prevMonthStart),
      dateTo: toIsoDateInput(prevMonthEnd),
      title: 'Previous Month',
      emptyMessage: 'No deliveries last month.',
    },
    {
      value: 'last_30_days',
      label: 'Last 30 days',
      dateFrom: toIsoDateInput(
        new Date(today.getFullYear(), today.getMonth(), today.getDate() - 29),
      ),
      dateTo: todayIso,
      title: 'Last 30 days',
      emptyMessage: 'No deliveries in the last 30 days.',
    },
  ]

  for (let offset = 0; offset < 7; offset += 1) {
    const day = new Date(today.getFullYear(), today.getMonth(), today.getDate() - offset)
    const value = toIsoDateInput(day)
    const label = offset === 0 ? `Today (${formatDate(day)})` : formatDate(day)
    options.push({
      value,
      label,
      dateFrom: value,
      dateTo: value,
      title: formatDate(day),
      emptyMessage:
        offset === 0 ? 'No deliveries today.' : `No deliveries on ${formatDate(day)}.`,
    })
  }

  return options
}

function DeliveriesSection({
  title,
  ariaLabel,
  data,
  error,
  emptyMessage,
  loadingMessage = 'Loading…',
  onOpen,
  dateSelect = null,
}) {
  const items = data?.items ?? []
  const canOpen = Boolean(data) && items.length > 0

  return (
    <section className="dashboard-section" aria-label={ariaLabel}>
      <div className="dashboard-section__head">
        <button
          type="button"
          className="dashboard-section__title-btn"
          onClick={onOpen}
          disabled={!canOpen}
        >
          {title}
        </button>
        {dateSelect}
      </div>

      {error ? <p className="mt-2 text-sm text-red-400">{error}</p> : null}
      {!data && !error ? <p className="mt-2 text-sm text-(--muted)">{loadingMessage}</p> : null}
      {data && items.length === 0 ? (
        <p className="mt-2 text-sm text-(--muted)">{emptyMessage}</p>
      ) : null}

      {items.length > 0 ? (
        <div className="mt-1.5">
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
  const periodOptions = useMemo(() => deliveryPeriodOptions(), [])
  const [pending, setPending] = useState(null)
  const [pendingError, setPendingError] = useState('')
  const [pendingModalOpen, setPendingModalOpen] = useState(false)

  const [deliveryPeriod, setDeliveryPeriod] = useState(todayIsoDate)
  const [delivery, setDelivery] = useState(null)
  const [deliveryError, setDeliveryError] = useState('')
  const [deliveryModalOpen, setDeliveryModalOpen] = useState(false)

  const selectedPeriod =
    periodOptions.find((option) => option.value === deliveryPeriod) ||
    periodOptions.find((option) => option.value === todayIsoDate()) ||
    periodOptions[0]

  useEffect(() => {
    let cancelled = false
    void fetchPendingDeliveriesByStockGroup()
      .then((data) => {
        if (!cancelled) setPending(data)
      })
      .catch((err) => {
        if (!cancelled) {
          setPendingError(getApiErrorMessage(err, 'Unable to load pending deliveries'))
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!selectedPeriod) return undefined
    let cancelled = false
    setDelivery(null)
    setDeliveryError('')
    void fetchTodayDeliveriesByStockGroup({
      dateFrom: selectedPeriod.dateFrom,
      dateTo: selectedPeriod.dateTo,
    })
      .then((data) => {
        if (!cancelled) setDelivery(data)
      })
      .catch((err) => {
        if (!cancelled) {
          setDeliveryError(getApiErrorMessage(err, 'Unable to load deliveries'))
        }
      })
    return () => {
      cancelled = true
    }
  }, [selectedPeriod])

  return (
    <div>
      <div className="dashboard-grid" aria-label="Dashboard tiles">
        <DeliveriesSection
          title="Pending deliveries"
          ariaLabel="Pending deliveries"
          data={pending}
          error={pendingError}
          emptyMessage="No pending invoices."
          onOpen={() => setPendingModalOpen(true)}
        />
        <DeliveriesSection
          title="Delivery"
          ariaLabel="Delivery"
          data={delivery}
          error={deliveryError}
          emptyMessage={selectedPeriod?.emptyMessage || 'No deliveries.'}
          onOpen={() => setDeliveryModalOpen(true)}
          dateSelect={
            <FormDropdown
              className="dashboard-section__period"
              listClassName="dashboard-section__period-list"
              options={periodOptions}
              value={deliveryPeriod}
              onChange={setDeliveryPeriod}
              placeholder="Select period"
              emptyMessage="No periods"
            />
          }
        />
      </div>

      {pendingModalOpen ? (
        <PendingDeliveriesModal
          items={pending?.items ?? []}
          onClose={() => setPendingModalOpen(false)}
        />
      ) : null}

      {deliveryModalOpen ? (
        <PendingDeliveriesModal
          title={`Delivery · ${selectedPeriod?.title || ''}`}
          emptyMessage={selectedPeriod?.emptyMessage || 'No deliveries.'}
          items={delivery?.items ?? []}
          onClose={() => setDeliveryModalOpen(false)}
        />
      ) : null}
    </div>
  )
}
