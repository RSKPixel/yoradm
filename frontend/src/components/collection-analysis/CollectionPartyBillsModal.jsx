import { BanknotesIcon } from '@heroicons/react/24/outline'
import { useMemo } from 'react'
import { formatDate } from '../../utils/formatDate'
import { formatCommaNumber, formatValue } from '../../utils/formatNumber'
import { Modal } from '../common/Modal'

const STATUS_LABEL = {
  overdue: 'Overdue',
  due: 'Due',
  upcoming: 'No due',
}

function formatAvgDays(value) {
  const num = Number(value)
  if (!Number.isFinite(num)) return '—'
  return formatCommaNumber(num, 1)
}

export function CollectionPartyBillsModal({
  partyName,
  lines,
  periodLabel,
  weekFrom,
  weekTo,
  onClose,
}) {
  const rows = useMemo(() => {
    const list = [...(lines ?? [])]
    list.sort((a, b) => {
      const order = { overdue: 0, due: 1, upcoming: 2 }
      const ao = order[a.status] ?? 9
      const bo = order[b.status] ?? 9
      if (ao !== bo) return ao - bo
      return String(a.expected_date || '').localeCompare(String(b.expected_date || ''))
    })
    return list
  }, [lines])

  const totals = useMemo(() => {
    let overdue = 0
    let due = 0
    let upcoming = 0
    for (const row of rows) {
      const amount = Number(row.amount) || 0
      if (row.status === 'overdue') overdue += amount
      else if (row.status === 'due') due += amount
      else upcoming += amount
    }
    return {
      overdue,
      due,
      upcoming,
      all: overdue + due + upcoming,
      count: rows.length,
    }
  }, [rows])

  const rangeLabel =
    weekFrom && weekTo ? `${formatDate(weekFrom)} – ${formatDate(weekTo)}` : '—'

  return (
    <Modal
      title={partyName || 'Party bills'}
      titleIcon={BanknotesIcon}
      onClose={onClose}
      className="collection-party-modal"
      ariaLabelledBy="collection-party-modal-title"
    >
      <div className="collection-party-modal__body">
        <p className="collection-party-modal__week">
          {periodLabel || 'Due'} {rangeLabel}
        </p>
        <div className="collection-party-modal__legend" aria-label="Status legend">
          <span className="collection-party-modal__chip collection-party-modal__chip--overdue">
            Overdue {formatValue(totals.overdue)}
          </span>
          <span className="collection-party-modal__chip collection-party-modal__chip--due">
            Due {formatValue(totals.due)}
          </span>
          <span className="collection-party-modal__chip collection-party-modal__chip--upcoming">
            No due {formatValue(totals.upcoming)}
          </span>
        </div>

        <div className="collection-party-modal__table-wrap">
          <table className="win-form__table win-form__table--bordered collection-party-modal__table w-full text-sm">
            <thead>
              <tr>
                <th>Invoice No</th>
                <th>Invoice Date</th>
                <th className="win-form__table-num">Avg days</th>
                <th>Expected</th>
                <th>Status</th>
                <th className="win-form__table-num">Amount</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="win-form__table-empty">
                    No pending bills.
                  </td>
                </tr>
              ) : null}
              {rows.map((row, index) => (
                <tr
                  key={`${row.invoice_no}-${row.expected_date}-${index}`}
                  className={`collection-party-modal__row collection-party-modal__row--${row.status || 'upcoming'}`}
                >
                  <td>{row.invoice_no ?? '—'}</td>
                  <td>{formatDate(row.invoice_date) || '—'}</td>
                  <td className="win-form__table-num">
                    <span className="win-form__table-readonly">{formatAvgDays(row.avg_days)}</span>
                  </td>
                  <td>{formatDate(row.expected_date) || '—'}</td>
                  <td>{STATUS_LABEL[row.status] || 'No due'}</td>
                  <td className="win-form__table-num">
                    <span className="win-form__table-readonly">{formatValue(row.amount)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="collection-party-modal__footer">
        <span className="text-sm text-(--muted)">
          {formatCommaNumber(totals.count, 0)} bills · Total {formatValue(totals.all)}
        </span>
        <button type="button" className="win-form__button" onClick={onClose}>
          Close
        </button>
      </div>
    </Modal>
  )
}
