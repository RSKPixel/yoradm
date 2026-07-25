import { MagnifyingGlassIcon } from '@heroicons/react/24/outline'
import { useEffect, useState } from 'react'
import {
  searchPostDatedCheques,
  updatePostDatedChequeStatus,
} from '../../api/postDatedCheque'
import { Modal } from '../common/Modal'
import { FormDropdown } from '../form/FormDropdown'
import { FormField, FormInput } from '../form/FormPanel'
import { formatDate, todayIsoDate } from '../../utils/formatDate'
import { formatValue } from '../../utils/formatNumber'
import { getApiErrorMessage } from '../../utils/formValidation'

const CHEQUE_STATUS_OPTIONS = [
  { value: 'Postdated', label: 'Postdated' },
  { value: 'Cleared', label: 'Cleared' },
  { value: 'Returned', label: 'Returned' },
]

function monthStartIsoDate() {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  return `${now.getFullYear()}-${month}-01`
}

export function PostDatedChequeSearchModal({ onClose, onSelect, onStatusChange }) {
  const [dateFrom, setDateFrom] = useState(monthStartIsoDate)
  const [dateTo, setDateTo] = useState(todayIsoDate)
  const [party, setParty] = useState('')
  const [chequeNo, setChequeNo] = useState('')
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [statusSavingId, setStatusSavingId] = useState(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError('')
      try {
        const data = await searchPostDatedCheques({
          dateFrom,
          dateTo,
          party: party.trim() || undefined,
          chequeNo: chequeNo.trim() || undefined,
          pageSize: 100,
        })
        if (!cancelled) setItems(data.items ?? [])
      } catch (err) {
        if (!cancelled) {
          setItems([])
          setError(getApiErrorMessage(err, 'Failed to load post dated cheques'))
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [dateFrom, dateTo, party, chequeNo])

  async function onRowStatusChange(row, nextStatus) {
    const status = String(nextStatus || '').trim()
    if (!CHEQUE_STATUS_OPTIONS.some((opt) => opt.value === status)) return
    if ((row.status || 'Postdated') === status) return

    setStatusSavingId(row.id)
    setError('')
    try {
      const saved = await updatePostDatedChequeStatus(row.id, status)
      const resolved = saved.status || status
      setItems((prev) =>
        prev.map((item) => (item.id === row.id ? { ...item, status: resolved } : item)),
      )
      onStatusChange?.(row.id, resolved)
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not update status'))
    } finally {
      setStatusSavingId(null)
    }
  }

  return (
    <Modal
      title="Search Post Dated Cheque"
      titleIcon={MagnifyingGlassIcon}
      onClose={onClose}
      ariaLabelledBy="pdc-search-modal-title"
      className="dc-search-modal"
    >
      <div className="dc-search-layout">
        <div className="dc-search-toolbar">
          <div className="dc-search-period dc-search-period--4">
            <FormField label="From" className="dc-search-field">
              <FormInput type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </FormField>
            <FormField label="To" className="dc-search-field">
              <FormInput type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </FormField>
            <FormField label="Party" className="dc-search-field">
              <FormInput
                type="text"
                value={party}
                onChange={(e) => setParty(e.target.value)}
                autoComplete="new-password"
                data-1p-ignore
                data-lpignore="true"
              />
            </FormField>
            <FormField label="Cheque No." className="dc-search-field">
              <FormInput
                type="text"
                value={chequeNo}
                onChange={(e) => setChequeNo(e.target.value)}
                autoComplete="new-password"
                data-1p-ignore
                data-lpignore="true"
              />
            </FormField>
          </div>
          <p className="dc-search-count">
            {loading ? 'Loading…' : `${items.length} cheque${items.length === 1 ? '' : 's'}`}
          </p>
        </div>

        {error ? <p className="dc-search-error">{error}</p> : null}

        <div className="dc-search-panel">
          <div className="dc-search-table-wrap">
            <table className="dc-search-table pdc-search-table">
              <colgroup>
                <col className="pdc-search-col-id" />
                <col className="pdc-search-col-party" />
                <col className="pdc-search-col-cheque" />
                <col className="pdc-search-col-date" />
                <col className="pdc-search-col-date" />
                <col className="pdc-search-col-status" />
                <col className="pdc-search-col-amount" />
              </colgroup>
              <thead>
                <tr>
                  <th>No.</th>
                  <th>Party</th>
                  <th>Cheque No.</th>
                  <th>Cheque Date</th>
                  <th>Present Date</th>
                  <th>Status</th>
                  <th className="dc-search-num">Amount</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="dc-search-empty">
                      Loading…
                    </td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="dc-search-empty">
                      No post dated cheques found for this period.
                    </td>
                  </tr>
                ) : (
                  items.map((row) => (
                    <tr
                      key={row.id}
                      className="dc-search-row"
                      tabIndex={0}
                      onClick={() => onSelect(row.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          onSelect(row.id)
                        }
                      }}
                    >
                      <td>
                        <span className="dc-search-id">{row.id}</span>
                      </td>
                      <td className="pdc-search-party" title={row.party || ''}>
                        {row.party}
                      </td>
                      <td>{row.cheque_no}</td>
                      <td>{formatDate(row.cheque_date)}</td>
                      <td>
                        {row.cheque_present_date ? formatDate(row.cheque_present_date) : '—'}
                      </td>
                      <td
                        className="pdc-search-status"
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                      >
                        <FormDropdown
                          options={CHEQUE_STATUS_OPTIONS}
                          value={row.status || 'Postdated'}
                          disabled={statusSavingId === row.id}
                          onChange={(status) => void onRowStatusChange(row, status)}
                          placeholder="Status"
                        />
                      </td>
                      <td className="dc-search-num">{formatValue(row.cheque_amount)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Modal>
  )
}
