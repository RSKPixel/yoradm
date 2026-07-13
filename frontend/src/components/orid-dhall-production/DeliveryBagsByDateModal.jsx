import { ListBulletIcon } from '@heroicons/react/24/outline'
import { useEffect, useState } from 'react'
import { fetchDeliveryQtyByBatchDates } from '../../api/deliveryChallan'
import { Modal } from '../common/Modal'
import { formatDate } from '../../utils/formatDate'
import { formatQty } from '../../utils/formatNumber'
import { getApiErrorMessage } from '../../utils/formValidation'

export function DeliveryBagsByDateModal({
  batchNo,
  stockGroup = 'Orid Dhall',
  onClose,
}) {
  const [items, setItems] = useState([])
  const [totalQty, setTotalQty] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    async function load() {
      if (!batchNo) {
        setItems([])
        setTotalQty(0)
        setLoading(false)
        return
      }
      setLoading(true)
      setError('')
      try {
        const data = await fetchDeliveryQtyByBatchDates({
          batchNo: String(batchNo),
          stockGroup,
        })
        if (!cancelled) {
          setItems(data.items ?? [])
          setTotalQty(Number(data.total_qty) || 0)
        }
      } catch (err) {
        if (!cancelled) {
          setItems([])
          setTotalQty(0)
          setError(getApiErrorMessage(err, 'Failed to load delivery bags'))
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [batchNo, stockGroup])

  return (
    <Modal
      title="Delivery — 50kg Bags"
      titleIcon={ListBulletIcon}
      onClose={onClose}
      ariaLabelledBy="odp-delivery-bags-modal-title"
      className="dc-search-modal"
    >
      <div className="dc-search-layout">
        <div className="dc-search-toolbar">
          <p className="dc-search-count">
            {loading
              ? 'Loading…'
              : `Lot ${batchNo} · ${items.length} day${items.length === 1 ? '' : 's'}`}
          </p>
        </div>

        {error ? <p className="dc-search-error">{error}</p> : null}

        <div className="dc-search-panel">
          <div className="dc-search-table-wrap">
            <table className="dc-search-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th className="dc-search-num">50kg Bags</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={2} className="dc-search-empty">
                      Loading…
                    </td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={2} className="dc-search-empty">
                      No delivery challans for this lot.
                    </td>
                  </tr>
                ) : (
                  items.map((row) => (
                    <tr key={String(row.challan_date)}>
                      <td>{formatDate(row.challan_date)}</td>
                      <td className="dc-search-num">{formatQty(row.total_qty)}</td>
                    </tr>
                  ))
                )}
              </tbody>
              {!loading && items.length > 0 ? (
                <tfoot>
                  <tr>
                    <td>
                      <span className="win-form__table-total-label">Total</span>
                    </td>
                    <td className="dc-search-num">
                      <strong>{formatQty(totalQty)}</strong>
                    </td>
                  </tr>
                </tfoot>
              ) : null}
            </table>
          </div>
        </div>
      </div>
    </Modal>
  )
}
