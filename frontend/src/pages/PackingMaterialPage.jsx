import { useCallback, useEffect, useMemo, useState } from 'react'
import { ListBulletIcon, ShoppingCartIcon } from '@heroicons/react/24/outline'
import {
  fetchPackingFyStock,
  refreshPackingFyStock,
  setPackingFyFrozen,
  updatePackingFyRows,
} from '../api/packingMaterial'
import { FormattedNumberInput } from '../components/form/FormattedNumberInput'
import { useFormMessage } from '../components/form/FormMessage'
import { FormField, FormSelect } from '../components/form/FormPanel'
import { PrimaryContentLayout } from '../components/layout/PrimaryContentLayout'
import { PackingPurchaseListModal } from '../components/packing-material/PackingPurchaseListModal'
import { PackingPurchaseModal } from '../components/packing-material/PackingPurchaseModal'
import { formatCommaNumber } from '../utils/formatNumber'
import { getApiErrorMessage } from '../utils/formValidation'

const STOCK_GROUPS = ['Orid Dhall', 'Orid Dhall Split', 'Toor Dhall', 'Moong Dhall']

const packingColGroup = (
  <colgroup key="cols">
    <col className="packing-mat-col-fy" />
    <col className="packing-mat-col-item" />
    <col className="packing-mat-col-brand" />
    <col className="packing-mat-col-qty" />
    <col className="packing-mat-col-qty" />
    <col className="packing-mat-col-qty" />
    <col className="packing-mat-col-qty" />
    <col className="packing-mat-col-qty" />
  </colgroup>
)

/** Calendar year in which the FY starts (April). */
function currentFyStartYear() {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  return month >= 4 ? year : year - 1
}

/** FY label, e.g. 2026 → 2026-2027. */
function fyLabelFromStartYear(startYear) {
  const start = Number(startYear)
  return `${start}-${start + 1}`
}

function currentFy() {
  return fyLabelFromStartYear(currentFyStartYear())
}

function formatQtyCell(value) {
  if (value == null || value === '') return ''
  const num = Number(value)
  if (!Number.isFinite(num)) return ''
  return formatCommaNumber(num, Number.isInteger(num) ? 0 : 2)
}

function parseQty(value, { minZero = false } = {}) {
  const raw = String(value ?? '').replace(/,/g, '').trim()
  // Allow typing a leading minus before digits (adjust can be negative).
  if (!minZero && (raw === '-' || raw === '-.')) return raw
  if (!minZero && raw.endsWith('-')) {
    const parsed = Number.parseFloat(raw.slice(0, -1))
    return Number.isFinite(parsed) ? -Math.abs(parsed) : '-'
  }
  const parsed = Number.parseFloat(raw)
  let next = Number.isFinite(parsed) ? parsed : 0
  if (minZero && next < 0) next = 0
  return next
}

function toQtyNumber(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function closingQty(row) {
  return (
    toQtyNumber(row.opening_qty) +
    toQtyNumber(row.purchase_qty) -
    toQtyNumber(row.sales_qty) -
    toQtyNumber(row.adjust_qty)
  )
}

function QtyInput({
  value,
  disabled,
  minZero = false,
  blankZero = false,
  onChange,
  ariaLabel,
}) {
  const isTypingNegative = value === '-' || value === '-.'
  const displayValue =
    blankZero && !isTypingNegative && toQtyNumber(value) === 0 ? '' : String(value ?? 0)
  return (
    <FormattedNumberInput
      className="win-form__table-input"
      inputMode={minZero ? 'decimal' : 'text'}
      fractionDigits={0}
      value={displayValue}
      onChange={(next) => onChange(parseQty(next, { minZero }))}
      disabled={disabled}
      readOnly={disabled}
      selectOnFocus
      aria-label={ariaLabel}
    />
  )
}

export function PackingMaterialPage() {
  const { showError, showSuccess } = useFormMessage()
  const [fy, setFy] = useState(currentFy)
  const [stockGroup, setStockGroup] = useState('')
  const [rows, setRows] = useState([])
  const [edits, setEdits] = useState({})
  const [frozen, setFrozen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [purchaseRow, setPurchaseRow] = useState(null)
  const [purchaseEdit, setPurchaseEdit] = useState(null)
  const [purchaseListRow, setPurchaseListRow] = useState(null)

  const fyOptions = useMemo(() => {
    const start = currentFyStartYear()
    return [0, 1, 2].map((i) => fyLabelFromStartYear(start - i))
  }, [])

  const applyStockData = useCallback((data) => {
    setRows(Array.isArray(data?.rows) ? data.rows : [])
    setEdits({})
    setFrozen(Boolean(data?.frozen))
  }, [])

  const loadStock = useCallback(async (fyValue) => {
    setLoading(true)
    try {
      const data = await fetchPackingFyStock({ fy: fyValue })
      applyStockData(data)
      if (data?.fy && data.fy !== fyValue) setFy(data.fy)
    } catch (err) {
      setRows([])
      setEdits({})
      setFrozen(false)
      showError(getApiErrorMessage(err, 'Unable to load packing stock'))
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applyStockData])

  useEffect(() => {
    void loadStock(fy)
  }, [fy, loadStock])

  const displayRows = useMemo(() => {
    return rows.map((row) => {
      const draft = edits[row.sku_id]
      if (!draft) return { ...row, closing_qty: closingQty(row) }
      const merged = {
        ...row,
        adjust_qty: draft.adjust_qty ?? row.adjust_qty,
      }
      return { ...merged, closing_qty: closingQty(merged) }
    })
  }, [rows, edits])

  const filteredRows = useMemo(() => {
    if (!stockGroup) return displayRows
    return displayRows.filter((row) => (row.stock_group || '') === stockGroup)
  }, [displayRows, stockGroup])

  const dirtyRows = useMemo(() => {
    return rows
      .map((row) => {
        const draft = edits[row.sku_id]
        if (!draft) return null
        const adjust = toQtyNumber(draft.adjust_qty ?? row.adjust_qty)
        if (adjust === toQtyNumber(row.adjust_qty)) return null
        return {
          sku_id: row.sku_id,
          adjust_qty: adjust,
        }
      })
      .filter(Boolean)
  }, [rows, edits])

  const hasDirty = dirtyRows.length > 0

  function setAdjust(skuId, value) {
    setEdits((prev) => {
      const row = rows.find((r) => r.sku_id === skuId)
      if (!row) return prev
      const typingMinus = value === '-' || value === '-.'
      if (!typingMinus && toQtyNumber(value) === toQtyNumber(row.adjust_qty)) {
        const next = { ...prev }
        delete next[skuId]
        return next
      }
      return { ...prev, [skuId]: { adjust_qty: value } }
    })
  }

  async function onUpdate() {
    if (!hasDirty || frozen) return
    setBusy(true)
    try {
      const data = await updatePackingFyRows({ fy, rows: dirtyRows })
      applyStockData(data)
      showSuccess(`Updated ${dirtyRows.length} row${dirtyRows.length === 1 ? '' : 's'}`)
    } catch (err) {
      showError(getApiErrorMessage(err, 'Unable to save changes'))
    } finally {
      setBusy(false)
    }
  }

  async function onRefreshFy() {
    if (hasDirty) {
      showError('Save or discard edits before refreshing FY')
      return
    }
    setBusy(true)
    try {
      const data = await refreshPackingFyStock({ fy })
      applyStockData(data)
      showSuccess(`Refreshed ${data?.fy || fy} · ${data?.rows?.length ?? 0} SKUs`)
    } catch (err) {
      showError(getApiErrorMessage(err, 'Unable to refresh FY'))
    } finally {
      setBusy(false)
    }
  }

  async function onToggleFreeze() {
    if (hasDirty) {
      showError('Save or discard edits before freeze/unfreeze')
      return
    }
    setBusy(true)
    try {
      const data = await setPackingFyFrozen({ fy, frozen: !frozen })
      applyStockData(data)
      showSuccess(data?.frozen ? `Frozen ${data.fy}` : `Unfrozen ${data.fy}`)
    } catch (err) {
      showError(getApiErrorMessage(err, frozen ? 'Unable to unfreeze' : 'Unable to freeze'))
    } finally {
      setBusy(false)
    }
  }

  const tableBody = loading ? (
    <tr>
      <td colSpan={8} className="win-form__table-empty">
        Loading…
      </td>
    </tr>
  ) : filteredRows.length === 0 ? (
    <tr>
      <td colSpan={8} className="win-form__table-empty">
        {rows.length === 0
          ? 'No packing stock for this FY. Click Refresh FY to populate.'
          : 'No SKUs for this stock group.'}
      </td>
    </tr>
  ) : (
    filteredRows.map((row) => (
      <tr key={`${row.fy}-${row.sku_id}`}>
        <td className="packing-mat-cell-fy">{row.fy}</td>
        <td className="packing-mat-cell-item">
          <div className="packing-mat__sku-cell">
            <span className="packing-mat__sku-name">{row.stock_item}</span>
            <div className="packing-mat__sku-actions">
              {toQtyNumber(row.purchase_qty) > 0 ? (
                <button
                  type="button"
                  className="packing-mat__purchase-btn"
                  disabled={busy}
                  title="List purchases"
                  aria-label={`List purchases for ${row.stock_item} ${row.brand}`}
                  onClick={() => setPurchaseListRow(row)}
                >
                  <ListBulletIcon className="size-4" aria-hidden="true" />
                </button>
              ) : null}
              <button
                type="button"
                className="packing-mat__purchase-btn"
                disabled={busy || frozen}
                title={frozen ? 'Unfreeze to add purchase' : 'Add purchase'}
                aria-label={`Add purchase for ${row.stock_item} ${row.brand}`}
                onClick={() => {
                  setPurchaseEdit(null)
                  setPurchaseRow(row)
                }}
              >
                <ShoppingCartIcon className="size-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        </td>
        <td className="packing-mat-cell-brand">{row.brand}</td>
        <td className="win-form__table-num">{formatQtyCell(row.opening_qty)}</td>
        <td className="win-form__table-num">{formatQtyCell(row.purchase_qty)}</td>
        <td className="win-form__table-num">{formatQtyCell(row.sales_qty)}</td>
        <td className="win-form__table-num">
          <QtyInput
            value={row.adjust_qty}
            blankZero
            disabled={busy || frozen}
            onChange={(value) => setAdjust(row.sku_id, value)}
            ariaLabel={`Adjust for ${row.stock_item} ${row.brand}`}
          />
        </td>
        <td className="win-form__table-num">{formatQtyCell(row.closing_qty)}</td>
      </tr>
    ))
  )

  return (
    <PrimaryContentLayout
      breadcrumb={[{ label: 'Transactions' }, { label: 'Packing Material' }]}
      title="Packing Material"
      footer={
        <>
          <button
            type="button"
            className="win-form__button win-form__button--primary"
            disabled={busy || loading || frozen || !hasDirty}
            onClick={() => void onUpdate()}
          >
            {busy ? 'Working…' : 'Update'}
          </button>
          <button
            type="button"
            className="win-form__button"
            disabled={busy || loading || frozen || hasDirty}
            onClick={() => void onRefreshFy()}
            title={
              frozen
                ? 'Unfreeze to refresh'
                : hasDirty
                  ? 'Save edits before refresh'
                  : undefined
            }
          >
            Refresh FY
          </button>
          <button
            type="button"
            className="win-form__button"
            disabled={busy || loading || hasDirty || (!frozen && rows.length === 0)}
            onClick={() => void onToggleFreeze()}
            title={hasDirty ? 'Save edits before freeze/unfreeze' : undefined}
          >
            {frozen ? 'Unfreeze' : 'Freeze'}
          </button>
        </>
      }
    >
      <div className={`packing-mat${frozen ? ' packing-mat--frozen' : ''}`}>
        <div className="packing-mat__toolbar shrink-0">
          <div className="grid min-w-0 grid-cols-2 gap-x-3 sm:grid-cols-3 lg:grid-cols-5">
            <FormField label="Financial year" className="packing-mat__field">
              <FormSelect
                value={fy}
                onChange={(e) => setFy(e.target.value)}
                disabled={loading || busy || hasDirty}
              >
                {fyOptions.map((label) => (
                  <option key={label} value={label}>
                    {label}
                  </option>
                ))}
              </FormSelect>
            </FormField>
            <FormField label="Stock group" className="packing-mat__field">
              <FormSelect
                value={stockGroup}
                onChange={(e) => setStockGroup(e.target.value)}
                disabled={loading || busy}
              >
                <option value="">All stock groups</option>
                {STOCK_GROUPS.map((group) => (
                  <option key={group} value={group}>
                    {group}
                  </option>
                ))}
              </FormSelect>
            </FormField>
          </div>
          {frozen ? (
            <span className="packing-mat__frozen-badge" title="Sales and openings are locked">
              Frozen
            </span>
          ) : null}
        </div>

        <div className="win-form__table-wrap win-form__table-shell">
          <div className="win-form__table-scroll">
            <table className="win-form__table win-form__table--bordered packing-mat__table w-full text-sm">
              {[
                packingColGroup,
                <thead key="head">
                  <tr>
                    <th className="packing-mat-cell-fy">FY</th>
                    <th className="packing-mat-cell-item">SKU</th>
                    <th className="packing-mat-cell-brand">Brand</th>
                    <th className="win-form__table-num">Opening</th>
                    <th className="win-form__table-num">Purchase</th>
                    <th className="win-form__table-num">Sales</th>
                    <th className="win-form__table-num">Adjust</th>
                    <th className="win-form__table-num">Closing</th>
                  </tr>
                </thead>,
                <tbody key="body">{tableBody}</tbody>,
              ]}
            </table>
          </div>
        </div>
      </div>
      {purchaseListRow ? (
        <PackingPurchaseListModal
          fy={fy}
          row={purchaseListRow}
          frozen={frozen}
          onClose={() => setPurchaseListRow(null)}
          onStockChanged={(data) => applyStockData(data)}
          onSuccess={(message) => showSuccess(message)}
          onError={(message) => showError(message)}
          onModify={(purchase) => {
            const listRow = purchaseListRow
            setPurchaseListRow(null)
            setPurchaseEdit(purchase)
            setPurchaseRow(listRow)
          }}
        />
      ) : null}
      {purchaseRow ? (
        <PackingPurchaseModal
          fy={fy}
          row={purchaseRow}
          purchase={purchaseEdit}
          frozen={frozen}
          onClose={() => {
            setPurchaseRow(null)
            setPurchaseEdit(null)
          }}
          onSaved={(data, meta) => {
            applyStockData(data)
            setPurchaseRow(null)
            setPurchaseEdit(null)
            showSuccess(meta?.mode === 'update' ? 'Purchase updated' : 'Purchase saved')
          }}
          onError={(message) => showError(message)}
        />
      ) : null}
    </PrimaryContentLayout>
  )
}
