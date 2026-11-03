import { ChevronDownIcon, ListBulletIcon } from '@heroicons/react/24/outline'
import { Fragment, useEffect, useState } from 'react'
import { fetchDeliveryQtyByBatchDates } from '../../api/deliveryChallan'
import { Modal } from '../common/Modal'
import { formatDate } from '../../utils/formatDate'
import { formatQty, formatRate } from '../../utils/formatNumber'
import { getApiErrorMessage } from '../../utils/formValidation'

const COLUMN_COUNT = 5

/** Rate per quintal from gross amount and 50kg bags (1 bag = 0.5 qtl). */
function ratePerQuintal(amount, bags50) {
  const quintal = Number(bags50) * 0.5
  const value = Number(amount)
  if (!Number.isFinite(quintal) || quintal <= 0 || !Number.isFinite(value)) return ''
  return formatRate(value / quintal)
}

export function DeliveryBagsByDateModal({
  batchNo,
  stockGroup = 'Orid Dhall',
  onClose,
}) {
  const [items, setItems] = useState([])
  const [totalQty, setTotalQty] = useState(0)
  const [totalAmount, setTotalAmount] = useState(0)
  const [expanded, setExpanded] = useState(() => new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    async function load() {
      if (!batchNo) {
        setItems([])
        setTotalQty(0)
        setTotalAmount(0)
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
          setTotalAmount(Number(data.total_amount) || 0)
          setExpanded(new Set())
        }
      } catch (err) {
        if (!cancelled) {
          setItems([])
          setTotalQty(0)
          setTotalAmount(0)
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

  function toggleDate(key) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  return (
    <Modal
      title="Delivery — 50kg Bags"
      titleIcon={ListBulletIcon}
      onClose={onClose}
      ariaLabelledBy="odp-delivery-bags-modal-title"
      className="dc-search-modal odp-delivery-modal"
    >
      <div className="dc-search-layout">
        {error ? <p className="dc-search-error">{error}</p> : null}

        <div className="dc-search-panel">
          <div className="dc-search-table-wrap">
            <table className="dc-search-table odp-delivery-dates-table">
              <colgroup>
                <col className="col-date" />
                <col className="col-item" />
                <col className="col-qty" />
                <col className="col-bags" />
                <col className="col-rate" />
              </colgroup>
              <thead>
                <tr>
                  <th>Date / Invoice</th>
                  <th>Stock Item</th>
                  <th className="dc-search-num">Qty</th>
                  <th className="dc-search-num">Qty in 50kg</th>
                  <th className="dc-search-num">Rate / Qtl</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={COLUMN_COUNT} className="dc-search-empty">
                      Loading…
                    </td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={COLUMN_COUNT} className="dc-search-empty">
                      No delivery challans for this lot.
                    </td>
                  </tr>
                ) : (
                  items.map((row) => {
                    const key = String(row.challan_date)
                    const isOpen = expanded.has(key)
                    const invoices = row.invoices ?? []
                    return (
                      <Fragment key={key}>
                        <tr className="odp-delivery-date-row">
                          <td>
                            <button
                              type="button"
                              className="win-form__row-toggle"
                              aria-expanded={isOpen}
                              aria-label={
                                isOpen
                                  ? `Hide invoices for ${formatDate(row.challan_date)}`
                                  : `Show invoices for ${formatDate(row.challan_date)}`
                              }
                              onClick={() => toggleDate(key)}
                            >
                              <ChevronDownIcon
                                className={`win-form__row-toggle-icon${
                                  isOpen ? '' : ' win-form__row-toggle-icon--closed'
                                }`}
                              />
                              {formatDate(row.challan_date)}
                            </button>
                          </td>
                          <td className="odp-delivery-muted">
                            {invoices.length} invoice{invoices.length === 1 ? '' : 's'}
                          </td>
                          <td />
                          <td className="dc-search-num">{formatQty(row.total_qty)}</td>
                          <td className="dc-search-num">
                            {ratePerQuintal(row.total_amount, row.total_qty)}
                          </td>
                        </tr>
                        {isOpen
                          ? invoices.flatMap((inv) =>
                              (inv.lines ?? []).map((line, idx) => (
                                <tr
                                  key={`${key}-${inv.voucher_no}-${line.stock_item}-${line.packing}`}
                                  className={`odp-delivery-invoice-row${
                                    idx === 0 ? ' odp-delivery-invoice-row--first' : ''
                                  }`}
                                >
                                  <td title={inv.ledger_name || ''}>
                                    {idx === 0 ? (
                                      <>
                                        <span className="odp-delivery-vno">{inv.voucher_no}</span>
                                        {inv.ledger_name ? (
                                          <span className="odp-delivery-party">
                                            {inv.ledger_name}
                                          </span>
                                        ) : null}
                                      </>
                                    ) : null}
                                  </td>
                                  <td title={line.stock_item || ''}>{line.stock_item}</td>
                                  <td className="dc-search-num">{formatQty(line.qty)}</td>
                                  <td className="dc-search-num">{formatQty(line.total_qty)}</td>
                                  <td className="dc-search-num">
                                    {ratePerQuintal(line.total_amount, line.total_qty)}
                                  </td>
                                </tr>
                              )),
                            )
                          : null}
                      </Fragment>
                    )
                  })
                )}
              </tbody>
              {!loading && items.length > 0 ? (
                <tfoot>
                  <tr>
                    <td colSpan={3}>
                      <span className="win-form__table-total-label">Total</span>
                    </td>
                    <td className="dc-search-num">
                      <strong>{formatQty(totalQty)}</strong>
                    </td>
                    <td className="dc-search-num">
                      <strong>{ratePerQuintal(totalAmount, totalQty)}</strong>
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
