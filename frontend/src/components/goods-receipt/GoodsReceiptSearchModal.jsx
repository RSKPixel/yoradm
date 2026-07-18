import { MagnifyingGlassIcon } from '@heroicons/react/24/outline'
import { useEffect, useState } from 'react'
import { searchGoodsReceipts } from '../../api/goodsReceipt'
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

export function GoodsReceiptSearchModal({ onClose, onSelect }) {
  const [dateFrom, setDateFrom] = useState(monthStartIsoDate)
  const [dateTo, setDateTo] = useState(todayIsoDate)
  const [vendor, setVendor] = useState('')
  const [invoiceNo, setInvoiceNo] = useState('')
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError('')
      try {
        const data = await searchGoodsReceipts({
          dateFrom,
          dateTo,
          vendor: vendor.trim() || undefined,
          invoiceNo: invoiceNo.trim() || undefined,
          pageSize: 100,
        })
        if (!cancelled) setItems(data.items ?? [])
      } catch (err) {
        if (!cancelled) {
          setItems([])
          setError(getApiErrorMessage(err, 'Failed to load goods receipts'))
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [dateFrom, dateTo, vendor, invoiceNo])

  return (
    <Modal
      title="Search Goods Receipt"
      titleIcon={MagnifyingGlassIcon}
      onClose={onClose}
      ariaLabelledBy="gr-search-modal-title"
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
            <FormField label="Vendor" className="dc-search-field">
              <FormInput
                type="text"
                value={vendor}
                onChange={(e) => setVendor(e.target.value)}
                placeholder="Vendor"
              />
            </FormField>
            <FormField label="Invoice No." className="dc-search-field">
              <FormInput
                type="text"
                value={invoiceNo}
                onChange={(e) => setInvoiceNo(e.target.value)}
                placeholder="Invoice"
              />
            </FormField>
          </div>
          <p className="dc-search-count">
            {loading ? 'Loading…' : `${items.length} receipt${items.length === 1 ? '' : 's'}`}
          </p>
        </div>

        {error ? <p className="dc-search-error">{error}</p> : null}

        <div className="dc-search-panel">
          <div className="dc-search-table-wrap">
            <table className="dc-search-table">
              <thead>
                <tr>
                  <th>Receipt No.</th>
                  <th>Date</th>
                  <th>Vendor</th>
                  <th>Stock Item</th>
                  <th>Invoice No.</th>
                  <th className="dc-search-num">Qty</th>
                  <th className="dc-search-num">Weight</th>
                  <th>Unloaded At</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} className="dc-search-empty">
                      Loading…
                    </td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="dc-search-empty">
                      No goods receipts found for this period.
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
                      <td>{formatDate(row.receipt_date)}</td>
                      <td>{row.vendor}</td>
                      <td>{row.stock_item}</td>
                      <td>{row.invoice_no}</td>
                      <td className="dc-search-num">{formatQty(row.qty)}</td>
                      <td className="dc-search-num">{formatQty(row.weight)}</td>
                      <td>{row.unloaded_at}</td>
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
