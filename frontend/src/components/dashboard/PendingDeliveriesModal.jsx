import { TruckIcon } from '@heroicons/react/24/outline'
import { useMemo, useRef, useState } from 'react'
import {
  formatPackingHeader,
  formatSummaryQty,
} from '../../utils/deliveryChallanSummary'
import { formatDate } from '../../utils/formatDate'
import { Modal } from '../common/Modal'

const ALL_GROUPS = ''

function packingSortKey(value) {
  if (value === '') return Number.POSITIVE_INFINITY
  const num = Number(value)
  return Number.isFinite(num) ? num : Number.POSITIVE_INFINITY
}

function buildPendingDetailRows(items, stockGroupFilter) {
  const groups = (items ?? []).filter((item) =>
    stockGroupFilter ? item.stock_group === stockGroupFilter : true,
  )

  const packingKeys = new Set()
  const map = new Map()

  for (const group of groups) {
    for (const invoice of group.invoices ?? []) {
      for (const line of invoice.lines ?? []) {
        const stockItem = line.stock_item?.trim() || '—'
        const brand = line.brand?.trim() || '—'
        const packingKey = line.packing == null || line.packing === '' ? '' : String(line.packing)
        packingKeys.add(packingKey)

        const key = `${invoice.voucher_no}::${stockItem}::${brand}`
        const qty = Number(line.qty)
        const add = Number.isFinite(qty) ? qty : 0
        let row = map.get(key)
        if (!row) {
          row = {
            voucherNo: invoice.voucher_no,
            voucherDate: invoice.voucher_date,
            ledgerName: invoice.ledger_name,
            stockItem,
            brand,
            byPacking: {},
            total: 0,
          }
          map.set(key, row)
        }
        row.byPacking[packingKey] = (row.byPacking[packingKey] || 0) + add
        row.total += add
      }
    }
  }

  const packings = [...packingKeys].sort((a, b) => packingSortKey(a) - packingSortKey(b))
  const rows = [...map.values()].sort((a, b) => {
    const byDate = String(b.voucherDate || '').localeCompare(String(a.voucherDate || ''))
    if (byDate !== 0) return byDate
    const byVoucher = a.voucherNo.localeCompare(b.voucherNo)
    if (byVoucher !== 0) return byVoucher
    const byItem = a.stockItem.localeCompare(b.stockItem)
    if (byItem !== 0) return byItem
    return a.brand.localeCompare(b.brand)
  })

  const columnTotals = Object.fromEntries(packings.map((p) => [p, 0]))
  let grandTotal = 0
  for (const row of rows) {
    for (const p of packings) {
      columnTotals[p] += row.byPacking[p] || 0
    }
    grandTotal += row.total
  }

  return { packings, rows, columnTotals, grandTotal }
}

function ColGroup({ packings }) {
  return (
    <colgroup>
      <col className="pd-col-invoice" />
      <col className="pd-col-date" />
      <col className="pd-col-party" />
      <col className="pd-col-item" />
      <col className="pd-col-brand" />
      {packings.map((packing) => (
        <col key={packing || 'none'} className="pd-col-pack" />
      ))}
      <col className="pd-col-total" />
    </colgroup>
  )
}

function TableHeaderRow({ packings }) {
  return (
    <tr>
      <th>Invoice</th>
      <th>Date</th>
      <th>Party</th>
      <th>Stock item</th>
      <th>Brand</th>
      {packings.map((packing) => (
        <th key={packing || 'none'} className="pending-deliveries-num">
          {formatPackingHeader(packing)}
        </th>
      ))}
      <th className="pending-deliveries-num">Total</th>
    </tr>
  )
}

function TotalRow({ packings, columnTotals, grandTotal }) {
  return (
    <tr>
      <td>Total</td>
      <td />
      <td />
      <td />
      <td />
      {packings.map((packing) => (
        <td key={packing || 'none'} className="pending-deliveries-num">
          {formatSummaryQty(columnTotals[packing])}
        </td>
      ))}
      <td className="pending-deliveries-num">{formatSummaryQty(grandTotal)}</td>
    </tr>
  )
}

export function PendingDeliveriesModal({ items, onClose }) {
  const groupOptions = useMemo(
    () =>
      [...new Set((items ?? []).map((item) => item.stock_group).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b),
      ),
    [items],
  )

  const [stockGroupFilter, setStockGroupFilter] = useState(ALL_GROUPS)

  const { packings, rows, columnTotals, grandTotal } = useMemo(
    () => buildPendingDetailRows(items, stockGroupFilter || null),
    [items, stockGroupFilter],
  )

  const displayRows = useMemo(
    () =>
      rows.map((row, index) => {
        const prev = rows[index - 1]
        const isInvoiceStart = !prev || prev.voucherNo !== row.voucherNo
        return { ...row, isInvoiceStart }
      }),
    [rows],
  )

  const invoiceGroups = useMemo(() => {
    const groups = []
    for (const row of displayRows) {
      const last = groups[groups.length - 1]
      if (!last || last.voucherNo !== row.voucherNo) {
        groups.push({ voucherNo: row.voucherNo, rows: [row] })
      } else {
        last.rows.push(row)
      }
    }
    return groups
  }, [displayRows])

  const colSpan = 5 + packings.length + 1
  const invoiceCount = new Set(rows.map((row) => row.voucherNo)).size

  const headRef = useRef(null)
  const bodyRef = useRef(null)
  const footRef = useRef(null)
  const syncing = useRef(false)

  function syncHorizontalScroll(source) {
    if (syncing.current) return
    syncing.current = true
    const left = source.scrollLeft
    if (headRef.current && headRef.current !== source) headRef.current.scrollLeft = left
    if (bodyRef.current && bodyRef.current !== source) bodyRef.current.scrollLeft = left
    if (footRef.current && footRef.current !== source) footRef.current.scrollLeft = left
    syncing.current = false
  }

  return (
    <Modal
      title="Pending deliveries"
      titleIcon={TruckIcon}
      onClose={onClose}
      ariaLabelledBy="pending-deliveries-modal-title"
      className="pending-deliveries-modal"
    >
      <div className="pending-deliveries-body">
        <div className="pending-deliveries-toolbar">
          <div
            className="pending-deliveries-segments"
            role="group"
            aria-label="Filter by stock group"
          >
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
                key={group}
                type="button"
                className={`pending-deliveries-segment${stockGroupFilter === group ? ' is-active' : ''}`}
                aria-pressed={stockGroupFilter === group}
                onClick={() => setStockGroupFilter(group)}
              >
                {group}
              </button>
            ))}
          </div>
          <p className="pending-deliveries-meta">
            {invoiceCount} invoice{invoiceCount === 1 ? '' : 's'}
            <span aria-hidden="true"> · </span>
            {rows.length} row{rows.length === 1 ? '' : 's'}
          </p>
        </div>

        <div className="pending-deliveries-table-wrap">
          <div
            className="pending-deliveries-table-head"
            ref={headRef}
            onScroll={(event) => syncHorizontalScroll(event.currentTarget)}
          >
            <table className="pending-deliveries-table">
              <ColGroup packings={packings} />
              <thead>
                <TableHeaderRow packings={packings} />
              </thead>
            </table>
          </div>

          <div
            className="pending-deliveries-table-scroll"
            ref={bodyRef}
            onScroll={(event) => syncHorizontalScroll(event.currentTarget)}
          >
            <table className="pending-deliveries-table">
              <ColGroup packings={packings} />
              <thead aria-hidden="true" className="pending-deliveries-table-spacer">
                <TableHeaderRow packings={packings} />
              </thead>
              {invoiceGroups.length === 0 ? (
                <tbody>
                  <tr>
                    <td colSpan={Math.max(colSpan, 3)} className="pending-deliveries-empty">
                      No pending invoices.
                    </td>
                  </tr>
                </tbody>
              ) : (
                invoiceGroups.map((group) => (
                  <tbody key={group.voucherNo} className="pending-deliveries-invoice">
                    {group.rows.map((row) => (
                      <tr
                        key={`${row.voucherNo}::${row.stockItem}::${row.brand}`}
                        className={row.isInvoiceStart ? 'is-invoice-start' : 'is-invoice-cont'}
                      >
                        <td>{row.isInvoiceStart ? row.voucherNo : ''}</td>
                        <td>{row.isInvoiceStart ? formatDate(row.voucherDate) || '—' : ''}</td>
                        <td>{row.isInvoiceStart ? row.ledgerName || '—' : ''}</td>
                        <td>{row.stockItem}</td>
                        <td>{row.brand}</td>
                        {packings.map((packing) => (
                          <td key={packing || 'none'} className="pending-deliveries-num">
                            {formatSummaryQty(row.byPacking[packing])}
                          </td>
                        ))}
                        <td className="pending-deliveries-num">{formatSummaryQty(row.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                ))
              )}
            </table>
          </div>

          {displayRows.length > 0 ? (
            <div
              className="pending-deliveries-table-foot"
              ref={footRef}
              onScroll={(event) => syncHorizontalScroll(event.currentTarget)}
            >
              <table className="pending-deliveries-table">
                <ColGroup packings={packings} />
                <thead aria-hidden="true" className="pending-deliveries-table-spacer">
                  <TableHeaderRow packings={packings} />
                </thead>
                <tbody>
                  <TotalRow
                    packings={packings}
                    columnTotals={columnTotals}
                    grandTotal={grandTotal}
                  />
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      </div>
    </Modal>
  )
}
