import { useState } from 'react'
import { FormInput } from './FormPanel'
import { formatCommaNumber } from '../../utils/formatNumber'

function parseQty(value) {
  const n = Number.parseFloat(String(value ?? '').replace(/,/g, ''))
  return Number.isFinite(n) ? n : NaN
}

/** Keep digits only; optional single decimal when decimals allowed. */
function sanitizeNumericInput(value, { allowDecimal = true } = {}) {
  let next = String(value ?? '').replace(/,/g, '')
  next = next.replace(/[^\d.]/g, '')
  if (!allowDecimal) {
    return next.replace(/\./g, '')
  }
  const dot = next.indexOf('.')
  if (dot === -1) return next
  return `${next.slice(0, dot + 1)}${next.slice(dot + 1).replace(/\./g, '')}`
}

/**
 * Stores a raw numeric string (no commas).
 * Focused: plain digits. Blurred: comma-formatted display.
 * Digits only (and one decimal when fractionDigits > 0).
 */
export function FormattedNumberInput({
  value = '',
  onChange,
  fractionDigits = 0,
  className = '',
  inputMode,
  selectOnFocus = false,
  onFocus,
  onBlur,
  ...rest
}) {
  const [focused, setFocused] = useState(false)
  const allowDecimal = Number(fractionDigits) > 0
  const resolvedInputMode = inputMode ?? (allowDecimal ? 'decimal' : 'numeric')
  const raw = String(value ?? '')
  const hasValue = raw.trim() !== ''

  const display = focused
    ? raw
    : hasValue && Number.isFinite(parseQty(raw))
      ? formatCommaNumber(parseQty(raw), fractionDigits)
      : hasValue
        ? raw
        : ''

  return (
    <FormInput
      className={`win-form__control--num ${className}`.trim()}
      inputMode={resolvedInputMode}
      value={display}
      onFocus={(e) => {
        setFocused(true)
        if (selectOnFocus) {
          e.target.select()
        }
        onFocus?.(e)
      }}
      onBlur={(e) => {
        setFocused(false)
        if (!raw.trim()) {
          onChange?.('')
        } else {
          const n = parseQty(raw)
          onChange?.(Number.isFinite(n) ? String(n) : '')
        }
        onBlur?.(e)
      }}
      onChange={(e) => {
        onChange?.(sanitizeNumericInput(e.target.value, { allowDecimal }))
      }}
      {...rest}
    />
  )
}
