import { ChartBarSquareIcon } from '@heroicons/react/24/outline'
import { useMemo } from 'react'
import {
  buildDeliverySummary,
  formatPackingHeader,
  formatSummaryQty,
} from '../../utils/deliveryChallanSummary'
import { Modal } from '../common/Modal'

export function DeliveryChallanSummaryModal({ lines, onClose }) {
  const { packings, rows, columnTotals, grandTotal } = useMemo(
    () => buildDeliverySummary(lines),
    [lines],
  )
  const colSpan = 2 + packings.length + 1

  return (
    <Modal
      title="Delivery Summary"
      titleIcon={ChartBarSquareIcon}
      onClose={onClose}
      ariaLabelledBy="dc-summary-modal-title"
      className="dc-summary-modal"
    >
      <div className="dc-summary-body">
        <div className="dc-summary-table-wrap">
          <table className="dc-summary-table">
            <thead>
              <tr>
                <th>Stock Item</th>
                <th>Brand</th>
                {packings.map((packing) => (
                  <th key={packing || 'none'} className="dc-summary-num">
                    {formatPackingHeader(packing)}
                  </th>
                ))}
                <th className="dc-summary-num">Total</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={Math.max(colSpan, 3)} className="dc-summary-empty">
                    No delivery items to summarize.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={`${row.stockItem}::${row.brand}`}>
                    <td>{row.stockItem}</td>
                    <td>{row.brand}</td>
                    {packings.map((packing) => (
                      <td key={packing || 'none'} className="dc-summary-num">
                        {formatSummaryQty(row.byPacking[packing])}
                      </td>
                    ))}
                    <td className="dc-summary-num">{formatSummaryQty(row.total)}</td>
                  </tr>
                ))
              )}
            </tbody>
            {rows.length > 0 ? (
              <tfoot>
                <tr>
                  <td colSpan={2}>Total</td>
                  {packings.map((packing) => (
                    <td key={packing || 'none'} className="dc-summary-num">
                      {formatSummaryQty(columnTotals[packing])}
                    </td>
                  ))}
                  <td className="dc-summary-num">{formatSummaryQty(grandTotal)}</td>
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>
      </div>
    </Modal>
  )
}
