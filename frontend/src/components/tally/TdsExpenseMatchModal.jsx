import { LinkIcon } from '@heroicons/react/24/outline'
import { useRef } from 'react'
import { Modal } from '../common/Modal'
import { formatDate } from '../../utils/formatDate'
import { formatValue } from '../../utils/formatNumber'

const expenseColGroup = (
  <colgroup>
    <col className="tds-expense-match__col-date" />
    <col className="tds-expense-match__col-type" />
    <col className="tds-expense-match__col-voucher" />
    <col className="tds-expense-match__col-bill" />
    <col className="tds-expense-match__col-amount" />
  </colgroup>
)

function ExpenseTableHeaderRow() {
  return (
    <tr>
      <th className="tds-expense-match__col-date">Date</th>
      <th className="tds-expense-match__col-type">Type</th>
      <th className="tds-expense-match__col-voucher">Voucher</th>
      <th className="tds-expense-match__col-bill">Bill</th>
      <th className="tds-expense-match__col-amount win-form__table-num">Amount</th>
    </tr>
  )
}

export function TdsExpenseMatchModal({
  open,
  loading,
  match,
  applying,
  onClose,
  onApply,
  onSelectCandidate,
}) {
  const headRef = useRef(null)
  const bodyRef = useRef(null)
  const syncing = useRef(false)

  if (!open) return null

  const title = 'Match expenses'
  const matched = Boolean(match?.matched)
  const candidates = Array.isArray(match?.candidates) ? match.candidates : []

  function syncHorizontalScroll(source) {
    if (syncing.current) return
    syncing.current = true
    const left = source.scrollLeft
    if (headRef.current && headRef.current !== source) headRef.current.scrollLeft = left
    if (bodyRef.current && bodyRef.current !== source) bodyRef.current.scrollLeft = left
    syncing.current = false
  }

  return (
    <Modal
      title={title}
      titleIcon={LinkIcon}
      ariaLabelledBy="tds-expense-match-title"
      className="tds-expense-match-modal"
      onClose={onClose}
    >
      <div className="tds-expense-match-modal__layout">
        <div className="tds-expense-match-modal__body">
          {loading ? (
            <p className="tds-expense-match-modal__status">Finding expenses transactions…</p>
          ) : match ? (
            <>
              <dl className="tds-expense-match-modal__summary">
                <div className="tds-expense-match-modal__summary-item">
                  <dt>TDS date</dt>
                  <dd>{match.tds_voucher_date ? formatDate(match.tds_voucher_date) : '—'}</dd>
                </div>
                <div className="tds-expense-match-modal__summary-item">
                  <dt>Party</dt>
                  <dd title={match.party || ''}>{match.party || '—'}</dd>
                </div>
                <div className="tds-expense-match-modal__summary-item">
                  <dt>TDS head</dt>
                  <dd title={match.tds_head || ''}>{match.tds_head || '—'}</dd>
                </div>
                <div className="tds-expense-match-modal__summary-item">
                  <dt>Expenses date</dt>
                  <dd>
                    {matched && match.expenses_date ? formatDate(match.expenses_date) : '—'}
                  </dd>
                </div>
                <div className="tds-expense-match-modal__summary-item">
                  <dt>Expenses amount</dt>
                  <dd className="tds-expense-match-modal__num">
                    {matched &&
                    match.expenses_amount != null &&
                    Number.isFinite(Number(match.expenses_amount))
                      ? formatValue(match.expenses_amount)
                      : '—'}
                  </dd>
                </div>
                <div className="tds-expense-match-modal__summary-item">
                  <dt>TDS amount</dt>
                  <dd className="tds-expense-match-modal__num">
                    {formatValue(match.tds_amount ?? 0)}
                  </dd>
                </div>
              </dl>

              <section className="tds-expense-match-modal__section">
                <h2 className="tds-expense-match-modal__heading">
                  Expenses transactions ({candidates.length})
                </h2>
                {candidates.length === 0 ? (
                  <p className="tds-expense-match-modal__muted">
                    No expenses transactions for this party in the search window.
                  </p>
                ) : (
                  <div className="tds-expense-match-modal__table-wrap">
                    <div
                      className="tds-expense-match-modal__table-head"
                      ref={headRef}
                      onScroll={(event) => syncHorizontalScroll(event.currentTarget)}
                    >
                      <table className="tds-expense-match-modal__table">
                        {expenseColGroup}
                        <thead>
                          <ExpenseTableHeaderRow />
                        </thead>
                      </table>
                    </div>
                    <div
                      className="tds-expense-match-modal__table-scroll"
                      ref={bodyRef}
                      onScroll={(event) => syncHorizontalScroll(event.currentTarget)}
                    >
                      <table className="tds-expense-match-modal__table">
                        {expenseColGroup}
                        <thead aria-hidden="true" className="tds-expense-match-modal__table-spacer">
                          <ExpenseTableHeaderRow />
                        </thead>
                        <tbody>
                          {candidates.map((row) => (
                            <tr
                              key={row.source_id}
                              className={
                                row.selected
                                  ? 'tds-expense-match-modal__row--selected'
                                  : 'tds-expense-match-modal__row--click'
                              }
                              onClick={() => onSelectCandidate?.(row)}
                              title={row.selected ? 'Selected match' : 'Use this line'}
                            >
                              <td className="tds-expense-match__col-date">
                                {row.voucher_date ? formatDate(row.voucher_date) : '—'}
                              </td>
                              <td className="tds-expense-match__col-type">{row.voucher_type || '—'}</td>
                              <td className="tds-expense-match__col-voucher">{row.voucher_no || '—'}</td>
                              <td className="tds-expense-match__col-bill">
                                {row.bill_no || '—'}
                                {row.bill_type ? ` (${row.bill_type})` : ''}
                              </td>
                              <td className="tds-expense-match__col-amount win-form__table-num">
                                {formatValue(row.amount)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </section>
            </>
          ) : (
            <p className="tds-expense-match-modal__status">No match data.</p>
          )}
        </div>

        <footer className="tds-expense-match-modal__footer">
          <button type="button" className="win-form__button" disabled={applying} onClick={onClose}>
            Close
          </button>
          <button
            type="button"
            className="win-form__button win-form__button--primary"
            disabled={loading || applying || !matched}
            title={matched ? 'Apply expenses to this row' : 'No match to apply'}
            onClick={() => onApply?.()}
          >
            {applying ? 'Applying…' : 'Apply match'}
          </button>
        </footer>
      </div>
    </Modal>
  )
}
