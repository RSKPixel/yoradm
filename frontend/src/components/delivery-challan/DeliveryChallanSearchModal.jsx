import { MagnifyingGlassIcon } from '@heroicons/react/24/outline'
import { useEffect, useState } from 'react'
import { searchDeliveryChallans } from '../../api/deliveryChallan'
import { Modal } from '../common/Modal'
import { FormField, FormInput } from '../form/FormPanel'
import { formatDate, todayIsoDate } from '../../utils/formatDate'
import { getApiErrorMessage } from '../../utils/formValidation'

function monthStartIsoDate() {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  return `${now.getFullYear()}-${month}-01`
}

function formatQty(value) {
  const num = Number(value)
  if (!Number.isFinite(num)) return '0'
  return Number.isInteger(num) ? String(num) : num.toLocaleString(undefined, { maximumFractionDigits: 3 })
}

export function DeliveryChallanSearchModal({ onClose, onSelect }) {
  const [dateFrom, setDateFrom] = useState(monthStartIsoDate)
  const [dateTo, setDateTo] = useState(todayIsoDate)
  const [batchNo, setBatchNo] = useState('')
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError('')
      try {
        const data = await searchDeliveryChallans({
          dateFrom,
          dateTo,
          batchNo: batchNo.trim() || undefined,
          pageSize: 100,
        })
        if (!cancelled) setItems(data.items ?? [])
      } catch (err) {
        if (!cancelled) {
          setItems([])
          setError(getApiErrorMessage(err, 'Failed to load delivery challans'))
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [dateFrom, dateTo, batchNo])

  return (
    <Modal
      title="Search Delivery Challan"
      titleIcon={MagnifyingGlassIcon}
      onClose={onClose}
      ariaLabelledBy="dc-search-modal-title"
      className="dc-search-modal"
    >
      <div className="dc-search-layout">
        <div className="dc-search-toolbar">
          <div className="dc-search-period dc-search-period--3">
            <FormField label="From" className="dc-search-field">
              <FormInput type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </FormField>
            <FormField label="To" className="dc-search-field">
              <FormInput type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </FormField>
            <FormField label="Batch No." className="dc-search-field">
              <FormInput
                type="text"
                value={batchNo}
                onChange={(e) => setBatchNo(e.target.value)}
                placeholder="Lot / batch"
              />
            </FormField>
          </div>
          <p className="dc-search-count">
            {loading ? 'Loading…' : `${items.length} challan${items.length === 1 ? '' : 's'}`}
          </p>
        </div>

        {error ? <p className="dc-search-error">{error}</p> : null}

        <div className="dc-search-panel">
          <div className="dc-search-table-wrap">
            <table className="dc-search-table">
              <thead>
                <tr>
                  <th>DC No.</th>
                  <th>Date</th>
                  <th>Lot No.</th>
                  <th>Vehicle</th>
                  <th>Driver</th>
                  <th className="dc-search-num">Invoices</th>
                  <th className="dc-search-num">Total Qty</th>
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
                      No delivery challans found for this period.
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
                      <td>{formatDate(row.challan_date)}</td>
                      <td>{row.batch_no || '—'}</td>
                      <td>{row.vehicle_no}</td>
                      <td>{row.driver_name}</td>
                      <td className="dc-search-num">{row.invoice_count ?? 0}</td>
                      <td className="dc-search-num">{formatQty(row.total_qty)}</td>
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
