import { ListBulletIcon } from '@heroicons/react/24/outline'
import { useEffect, useState } from 'react'
import { fetchBrokerageBuyers } from '../../api/brokerage'
import { formatQty, formatValue } from '../../utils/formatNumber'
import { getApiErrorMessage } from '../../utils/formValidation'
import { Modal } from '../common/Modal'

const tableColGroup = (
  <colgroup>
    <col />
    <col className="brokerage-buyers-modal__col-num" />
    <col className="brokerage-buyers-modal__col-num" />
  </colgroup>
)

export function BrokerageBuyersModal({ fyStart, month, broker, onClose }) {
  const [rows, setRows] = useState([])
  const [totalQty, setTotalQty] = useState(0)
  const [totalQuintals, setTotalQuintals] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    async function load() {
      if (!broker) {
        setRows([])
        setTotalQty(0)
        setTotalQuintals(0)
        setLoading(false)
        return
      }
      setLoading(true)
      setError('')
      try {
        const data = await fetchBrokerageBuyers({
          fyStart,
          month,
          broker,
        })
        if (!cancelled) {
          setRows(Array.isArray(data?.rows) ? data.rows : [])
          setTotalQty(Number(data?.total_qty) || 0)
          setTotalQuintals(Number(data?.total_quintals) || 0)
        }
      } catch (err) {
        if (!cancelled) {
          setRows([])
          setTotalQty(0)
          setTotalQuintals(0)
          setError(getApiErrorMessage(err, 'Failed to load buyers'))
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [fyStart, month, broker])

  const showFooter = !loading && rows.length > 0
  const tableClass = 'win-form__table win-form__table--bordered'

  return (
    <Modal
      title="Buyers"
      titleIcon={ListBulletIcon}
      onClose={onClose}
      ariaLabelledBy="brokerage-buyers-modal-title"
      className="brokerage-buyers-modal"
    >
      <div className="brokerage-buyers-modal__body">
        <p className="brokerage-buyers-modal__count">
          {loading
            ? 'Loading…'
            : `${broker} · ${rows.length} buyer${rows.length === 1 ? '' : 's'}`}
        </p>

        {error ? <p className="brokerage-buyers-modal__error">{error}</p> : null}

        <div className="win-form__table-wrap win-form__table-shell">
          <div className="win-form__table-scroll">
            <table className={tableClass}>
              {tableColGroup}
              <thead>
                <tr>
                  <th>Buyer</th>
                  <th className="win-form__table-num">Qty</th>
                  <th className="win-form__table-num">Quintals</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={3} className="win-form__table-empty">
                      Loading…
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="win-form__table-empty">
                      No buyers for this broker in the selected month.
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr key={row.buyer}>
                      <td title={row.buyer}>{row.buyer}</td>
                      <td className="win-form__table-num">{formatQty(row.qty)}</td>
                      <td className="win-form__table-num">{formatValue(row.quintals)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {showFooter ? (
            <div className="win-form__table-foot">
              <table className={tableClass}>
                {tableColGroup}
                <tbody>
                  <tr>
                    <td>
                      <span className="win-form__table-total-label">Total</span>
                    </td>
                    <td className="win-form__table-num">{formatQty(totalQty)}</td>
                    <td className="win-form__table-num">{formatValue(totalQuintals)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      </div>
    </Modal>
  )
}
