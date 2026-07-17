import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { ShoppingCartIcon } from '@heroicons/react/24/outline'
import {
  createPackingPurchase,
  fetchPackingSuppliers,
  updatePackingPurchase,
} from '../../api/packingMaterial'
import { Modal } from '../common/Modal'
import { FormattedNumberInput } from '../form/FormattedNumberInput'
import { FormField, FormInput } from '../form/FormPanel'
import { getApiErrorMessage } from '../../utils/formValidation'

function fyDateBounds(fy) {
  const start = Number(String(fy).split('-')[0])
  if (!Number.isFinite(start)) return { min: '', max: '' }
  return {
    min: `${start}-04-01`,
    max: `${start + 1}-03-31`,
  }
}

function todayInFy(fy) {
  const { min, max } = fyDateBounds(fy)
  const today = new Date()
  const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  if (min && iso < min) return min
  if (max && iso > max) return max
  return iso
}

function parseOptionalNumber(value) {
  const raw = String(value ?? '').replace(/,/g, '').trim()
  if (!raw) return null
  const n = Number.parseFloat(raw)
  return Number.isFinite(n) ? n : null
}

function parseRequiredQty(value) {
  const n = parseOptionalNumber(value)
  return n != null && n > 0 ? n : null
}

function toInputDate(value) {
  if (!value) return ''
  const raw = String(value)
  const m = raw.match(/^(\d{4}-\d{2}-\d{2})/)
  return m ? m[1] : raw
}

/** Free-text supplier field with selectable previous suppliers. */
function SupplierCombobox({ value, options, onChange, disabled }) {
  const listId = useId()
  const rootRef = useRef(null)
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(0)

  const filtered = useMemo(() => {
    const q = String(value || '').trim().toLowerCase()
    if (!q) return options
    return options.filter((name) => name.toLowerCase().includes(q))
  }, [options, value])

  useEffect(() => {
    if (!open) return undefined
    function onDocPointerDown(event) {
      if (!rootRef.current?.contains(event.target)) setOpen(false)
    }
    document.addEventListener('pointerdown', onDocPointerDown)
    return () => document.removeEventListener('pointerdown', onDocPointerDown)
  }, [open])

  useEffect(() => {
    setHighlight(0)
  }, [value, open])

  function choose(name) {
    onChange(name)
    setOpen(false)
  }

  return (
    <div className="win-form__autocomplete packing-purchase__supplier" ref={rootRef}>
      <FormInput
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        value={value}
        disabled={disabled}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          onChange(e.target.value)
          setOpen(true)
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') {
            event.preventDefault()
            setOpen(true)
            if (!filtered.length) return
            setHighlight((i) => Math.min(i + 1, filtered.length - 1))
            return
          }
          if (event.key === 'ArrowUp') {
            event.preventDefault()
            if (!filtered.length) return
            setHighlight((i) => Math.max(i - 1, 0))
            return
          }
          if (event.key === 'Enter' && open && filtered[highlight]) {
            event.preventDefault()
            choose(filtered[highlight])
            return
          }
          if (event.key === 'Escape') setOpen(false)
        }}
      />
      {open && options.length > 0 ? (
        <ul id={listId} className="win-form__autocomplete-list" role="listbox">
          {filtered.length === 0 ? (
            <li className="win-form__autocomplete-empty">No matching suppliers</li>
          ) : (
            filtered.map((name, index) => (
              <li key={name} role="option" aria-selected={name === value}>
                <button
                  type="button"
                  className={`win-form__autocomplete-option${index === highlight ? ' is-active' : ''}`}
                  onMouseEnter={() => setHighlight(index)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => choose(name)}
                >
                  {name}
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  )
}

export function PackingPurchaseModal({
  fy,
  row,
  purchase = null,
  frozen = false,
  onClose,
  onSaved,
  onError,
}) {
  const isEdit = Boolean(purchase?.id)
  const bounds = useMemo(() => fyDateBounds(fy), [fy])
  const [purchaseDate, setPurchaseDate] = useState(() =>
    isEdit ? toInputDate(purchase.purchase_date) : todayInFy(fy),
  )
  const [qty, setQty] = useState(() =>
    isEdit && purchase.qty != null ? String(purchase.qty) : '',
  )
  const [rate, setRate] = useState(() =>
    isEdit && purchase.rate != null ? String(purchase.rate) : '',
  )
  const [supplier, setSupplier] = useState(() =>
    isEdit ? purchase.supplier || '' : '',
  )
  const [suppliers, setSuppliers] = useState([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const names = await fetchPackingSuppliers()
        if (!cancelled) setSuppliers(Array.isArray(names) ? names : [])
      } catch {
        if (!cancelled) setSuppliers([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const skuLabel = row ? `${row.stock_item} · ${row.brand}` : ''

  async function onSave(event) {
    event.preventDefault()
    if (frozen || !row) return

    const qtyNum = parseRequiredQty(qty)
    if (qtyNum == null) {
      onError?.('Enter a purchase quantity greater than zero')
      return
    }
    if (!purchaseDate || purchaseDate < bounds.min || purchaseDate > bounds.max) {
      onError?.(`Purchase date must be within ${fy}`)
      return
    }
    const rateNum = parseOptionalNumber(rate)
    if (rate !== '' && rateNum == null) {
      onError?.('Rate must be a valid number')
      return
    }
    if (rateNum != null && rateNum < 0) {
      onError?.('Rate cannot be negative')
      return
    }

    const payload = {
      purchase_date: purchaseDate,
      qty: qtyNum,
      rate: rateNum,
      supplier: supplier.trim() || null,
    }

    setSaving(true)
    try {
      const stock = isEdit
        ? await updatePackingPurchase({
            fy,
            purchaseId: purchase.id,
            ...payload,
          })
        : await createPackingPurchase({
            fy,
            sku_id: row.sku_id,
            ...payload,
          })
      onSaved?.(stock, { mode: isEdit ? 'update' : 'create' })
    } catch (err) {
      onError?.(getApiErrorMessage(err, isEdit ? 'Unable to update purchase' : 'Unable to save purchase'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title={isEdit ? 'Update purchase' : 'Add purchase'}
      titleIcon={ShoppingCartIcon}
      onClose={onClose}
      ariaLabelledBy="packing-purchase-title"
      className="packing-purchase-modal"
    >
      <form className="packing-purchase-form" onSubmit={(e) => void onSave(e)} autoComplete="off">
        <div className="packing-purchase-form__grid">
          <FormField label="Purchase date">
            <FormInput
              type="date"
              value={purchaseDate}
              min={bounds.min}
              max={bounds.max}
              disabled={saving || frozen}
              onChange={(e) => setPurchaseDate(e.target.value)}
              required
            />
          </FormField>
          <FormField label="SKU" className="packing-purchase-form__sku">
            <div className="win-form__control packing-purchase-form__sku-value" aria-readonly="true">
              {skuLabel}
            </div>
          </FormField>
          <FormField label="Qty">
            <FormattedNumberInput
              value={qty}
              fractionDigits={0}
              inputMode="decimal"
              disabled={saving || frozen}
              selectOnFocus
              onChange={setQty}
              required
            />
          </FormField>
          <FormField label="Rate (optional)">
            <FormattedNumberInput
              value={rate}
              fractionDigits={2}
              inputMode="decimal"
              disabled={saving || frozen}
              selectOnFocus
              onChange={setRate}
            />
          </FormField>
          <FormField label="Supplier (optional)" className="packing-purchase-form__supplier">
            <SupplierCombobox
              value={supplier}
              options={suppliers}
              disabled={saving || frozen}
              onChange={setSupplier}
            />
          </FormField>
        </div>
        <div className="packing-purchase-form__actions">
          <button type="button" className="win-form__button" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button
            type="submit"
            className="win-form__button win-form__button--primary"
            disabled={saving || frozen}
          >
            {saving ? 'Saving…' : isEdit ? 'Update' : 'Save'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
