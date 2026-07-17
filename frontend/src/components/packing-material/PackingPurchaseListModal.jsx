import { useCallback, useEffect, useState } from 'react'
import {
  ListBulletIcon,
  PencilSquareIcon,
  TrashIcon,
} from '@heroicons/react/24/outline'
import { deletePackingPurchase, fetchPackingPurchases } from '../../api/packingMaterial'
import { Modal } from '../common/Modal'
import { formatCommaNumber } from '../../utils/formatNumber'
import { getApiErrorMessage } from '../../utils/formValidation'

function formatQty(value) {
  const num = Number(value)
  if (!Number.isFinite(num)) return ''
  return formatCommaNumber(num, Number.isInteger(num) ? 0 : 2)
}

function formatRate(value) {
  if (value == null || value === '') return ''
  const num = Number(value)
  if (!Number.isFinite(num)) return ''
  return formatCommaNumber(num, 2)
}

function formatDate(value) {
  if (!value) return ''
  const raw = String(value)
  // YYYY-MM-DD → DD-MM-YYYY
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return raw
  return `${m[3]}-${m[2]}-${m[1]}`
}

export function PackingPurchaseListModal({
  fy,
  row,
  frozen = false,
  onClose,
  onModify,
  onStockChanged,
  onError,
  onSuccess,
}) {
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState(null)
  const [purchases, setPurchases] = useState([])
  const [meta, setMeta] = useState(null)

  const load = useCallback(async () => {
    if (!row?.sku_id) return
    setLoading(true)
    try {
      const data = await fetchPackingPurchases({ fy, skuId: row.sku_id })
      setMeta(data)
      setPurchases(Array.isArray(data?.rows) ? data.rows : [])
    } catch (err) {
      setPurchases([])
      onError?.(getApiErrorMessage(err, 'Unable to load purchases'))
    } finally {
      setLoading(false)
    }
  }, [fy, row?.sku_id, onError])

  useEffect(() => {
    void load()
  }, [load])

  async function onDelete(purchase) {
    if (frozen || !purchase) return
    const ok = window.confirm(
      `Delete purchase dated ${formatDate(purchase.purchase_date)} · qty ${formatQty(purchase.qty)}?`,
    )
    if (!ok) return

    setBusyId(purchase.id)
    try {
      const stock = await deletePackingPurchase({ fy, purchaseId: purchase.id })
      onStockChanged?.(stock)
      onSuccess?.('Purchase deleted')
      await load()
    } catch (err) {
      onError?.(getApiErrorMessage(err, 'Unable to delete purchase'))
    } finally {
      setBusyId(null)
    }
  }

  const titleSku = meta
    ? `${meta.stock_item} · ${meta.brand}`
    : row
      ? `${row.stock_item} · ${row.brand}`
      : ''

  return (
    <Modal
      title="Purchases"
      titleIcon={ListBulletIcon}
      onClose={onClose}
      ariaLabelledBy="packing-purchase-list-title"
      className="packing-purchase-list-modal"
    >
      <div className="packing-purchase-list">
        <div className="packing-purchase-list__meta">
          <span className="packing-purchase-list__sku">{titleSku}</span>
          <span className="packing-purchase-list__fy">FY {fy}</span>
        </div>

        <div className="packing-purchase-list__table-wrap">
          <table className="packing-purchase-list__table">
            <thead>
              <tr>
                <th>Date</th>
                <th className="is-num">Qty</th>
                <th className="is-num">Rate</th>
                <th>Supplier</th>
                <th className="is-actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="packing-purchase-list__empty">
                    Loading…
                  </td>
                </tr>
              ) : purchases.length === 0 ? (
                <tr>
                  <td colSpan={5} className="packing-purchase-list__empty">
                    No purchases for this SKU in {fy}.
                  </td>
                </tr>
              ) : (
                purchases.map((purchase) => {
                  const busy = busyId === purchase.id
                  return (
                    <tr key={purchase.id}>
                      <td>{formatDate(purchase.purchase_date)}</td>
                      <td className="is-num">{formatQty(purchase.qty)}</td>
                      <td className="is-num">{formatRate(purchase.rate)}</td>
                      <td className="packing-purchase-list__supplier">
                        {purchase.supplier || ''}
                      </td>
                      <td className="is-actions">
                        <button
                          type="button"
                          className="packing-purchase-list__icon-btn"
                          disabled={frozen || busy || busyId != null}
                          title={frozen ? 'Unfreeze to modify' : 'Modify'}
                          aria-label="Modify purchase"
                          onClick={() => onModify?.(purchase)}
                        >
                          <PencilSquareIcon className="size-4" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          className="packing-purchase-list__icon-btn packing-purchase-list__icon-btn--danger"
                          disabled={frozen || busy || busyId != null}
                          title={frozen ? 'Unfreeze to delete' : 'Delete'}
                          aria-label="Delete purchase"
                          onClick={() => void onDelete(purchase)}
                        >
                          <TrashIcon className="size-4" aria-hidden="true" />
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="packing-purchase-list__actions">
          <button type="button" className="win-form__button" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </Modal>
  )
}
