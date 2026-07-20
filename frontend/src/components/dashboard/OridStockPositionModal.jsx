import { CubeTransparentIcon } from '@heroicons/react/24/outline'
import { useMemo, useState } from 'react'
import { formatDate } from '../../utils/formatDate'
import { Modal } from '../common/Modal'

const ALL_GROUPS = ''

function formatWhole(value) {
  const num = Number(value)
  if (!Number.isFinite(num)) return '—'
  return Math.round(num).toLocaleString()
}

function formatAmount(value) {
  const num = Number(value)
  if (!Number.isFinite(num)) return '—'
  return Math.round(num).toLocaleString()
}

function lineRate(row) {
  const amount = Number(row?.amount)
  const weight = Number(row?.weight)
  if (!Number.isFinite(amount) || !Number.isFinite(weight) || weight <= 0) return null
  return (amount / weight) * 100
}

export function OridStockPositionModal({ items, onClose }) {
  const groupOptions = useMemo(
    () =>
      (items ?? []).map((item) => ({
        value: item.stock_group,
        label: item.label || item.stock_group,
      })),
    [items],
  )

  const [stockGroupFilter, setStockGroupFilter] = useState(ALL_GROUPS)

  const rows = useMemo(() => {
    const groups = (items ?? []).filter((item) =>
      stockGroupFilter ? item.stock_group === stockGroupFilter : true,
    )
    const list = []
    for (const group of groups) {
      for (const line of group.lines ?? []) {
        list.push({
          ...line,
          stock_group: group.stock_group,
          label: group.label || group.stock_group,
        })
      }
    }
    return list
  }, [items, stockGroupFilter])

  const displayRows = useMemo(
    () =>
      rows.map((row, index) => {
        const prev = rows[index - 1]
        const isVoucherStart = !prev || prev.voucher_no !== row.voucher_no
        return { ...row, isVoucherStart }
      }),
    [rows],
  )

  const voucherGroups = useMemo(() => {
    const groups = []
    for (const row of displayRows) {
      const last = groups[groups.length - 1]
      if (!last || last.voucherNo !== row.voucher_no) {
        groups.push({ voucherNo: row.voucher_no, rows: [row] })
      } else {
        last.rows.push(row)
      }
    }
    return groups
  }, [displayRows])

  const voucherCount = useMemo(
    () => new Set(rows.map((row) => row.voucher_no).filter(Boolean)).size,
    [rows],
  )

  const totals = useMemo(() => {
    let qty = 0
    let weight = 0
    let amount = 0
    for (const row of rows) {
      qty += Number(row.qty) || 0
      weight += Number(row.weight) || 0
      amount += Number(row.amount) || 0
    }
    const avgRate = weight > 0 ? (amount / weight) * 100 : 0
    return {
      qty,
      weight,
      amount,
      avg_rate: avgRate,
    }
  }, [rows])

  return (
    <Modal
      title="Orid Stock Position"
      titleIcon={CubeTransparentIcon}
      onClose={onClose}
      ariaLabelledBy="orid-stock-modal-title"
      className="orid-stock-modal"
    >
      <div className="orid-stock-modal__body">
        <div className="orid-stock-modal__toolbar">
          <div className="pending-deliveries-segments" role="group" aria-label="Filter by stock">
            <button
              type="button"
              className={`pending-deliveries-segment${stockGroupFilter === ALL_GROUPS ? ' is-active' : ''}`}
              aria-pressed={stockGroupFilter === ALL_GROUPS}
              onClick={() => setStockGroupFilter(ALL_GROUPS)}
            >
              All
            </button>
            {groupOptions.map((group) => (
              <button
                key={group.value}
                type="button"
                className={`pending-deliveries-segment${stockGroupFilter === group.value ? ' is-active' : ''}`}
                aria-pressed={stockGroupFilter === group.value}
                onClick={() => setStockGroupFilter(group.value)}
              >
                {group.label}
              </button>
            ))}
          </div>
          <p className="pending-deliveries-meta">
            {voucherCount} voucher{voucherCount === 1 ? '' : 's'}
            <span aria-hidden="true"> · </span>
            {rows.length} line{rows.length === 1 ? '' : 's'}
          </p>
        </div>

        <div className="orid-stock-modal__table-shell">
          <table className="orid-stock-modal__table">
            <colgroup>
              <col className="orid-stock-col-voucher" />
              <col className="orid-stock-col-date" />
              <col className="orid-stock-col-party" />
              <col className="orid-stock-col-stock" />
              <col className="orid-stock-col-num" />
              <col className="orid-stock-col-num" />
              <col className="orid-stock-col-num" />
              <col className="orid-stock-col-num" />
            </colgroup>
            <thead>
              <tr>
                <th>Voucher</th>
                <th className="orid-stock-modal__date">Date</th>
                <th>Party</th>
                <th>Stock</th>
                <th className="pending-deliveries-num">Qty</th>
                <th className="pending-deliveries-num">Weight</th>
                <th className="pending-deliveries-num">Rate</th>
                <th className="pending-deliveries-num">Amount</th>
              </tr>
            </thead>
            {voucherGroups.length === 0 ? (
              <tbody>
                <tr>
                  <td colSpan={8} className="pending-deliveries-empty">
                    No unselected Orid stock.
                  </td>
                </tr>
              </tbody>
            ) : (
              voucherGroups.map((group) => (
                <tbody key={group.voucherNo} className="orid-stock-modal__voucher">
                  {group.rows.map((row, index) => (
                    <tr
                      key={`${row.voucher_no}-${row.stock_item}-${index}`}
                      className={row.isVoucherStart ? 'is-voucher-start' : 'is-voucher-cont'}
                    >
                      <td>{row.isVoucherStart ? row.voucher_no : ''}</td>
                      <td className="orid-stock-modal__date">
                        {row.isVoucherStart ? formatDate(row.voucher_date) || '—' : ''}
                      </td>
                      <td className="orid-stock-modal__fit">
                        {row.isVoucherStart ? row.ledger_name || '—' : ''}
                      </td>
                      <td className="orid-stock-modal__fit">{row.stock_item || '—'}</td>
                      <td className="pending-deliveries-num">{formatWhole(row.qty)}</td>
                      <td className="pending-deliveries-num">{formatWhole(row.weight)}</td>
                      <td className="pending-deliveries-num">{formatWhole(lineRate(row))}</td>
                      <td className="pending-deliveries-num">{formatAmount(row.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              ))
            )}
            {rows.length > 0 ? (
              <tfoot>
                <tr>
                  <td colSpan={4}>Total</td>
                  <td className="pending-deliveries-num">{formatWhole(totals.qty)}</td>
                  <td className="pending-deliveries-num">{formatWhole(totals.weight)}</td>
                  <td className="pending-deliveries-num">{formatWhole(totals.avg_rate)}</td>
                  <td className="pending-deliveries-num">{formatAmount(totals.amount)}</td>
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>
      </div>
    </Modal>
  )
}
