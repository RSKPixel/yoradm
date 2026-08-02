import { useState } from 'react'
import { FormInput } from './FormPanel'
import { formatCommaNumber } from '../../utils/formatNumber'

function parseQty(value) {
  const n = Number.parseFloat(String(value ?? '').replace(/,/g, ''))
  return Number.isFinite(n) ? n : NaN
}

/** Keep digits only; optional leading minus and single decimal when allowed. */
function sanitizeNumericInput(
  value,
  { allowDecimal = true, allowNegative = false } = {},
) {
  let next = String(value ?? '').replace(/,/g, '')
  const negative = allowNegative && next.trimStart().startsWith('-')
  next = next.replace(/[^\d.]/g, '')
  if (!allowDecimal) {
    next = next.replace(/\./g, '')
  } else {
    const dot = next.indexOf('.')
    if (dot !== -1) {
      next = `${next.slice(0, dot + 1)}${next.slice(dot + 1).replace(/\./g, '')}`
    }
  }
  if (negative) {
    return next ? `-${next}` : '-'
  }
  return next
}

/**
 * Stores a raw numeric string (no commas).
 * Focused: plain digits. Blurred: comma-formatted display.
 * Digits only (and one decimal when fractionDigits > 0).
 * Set allowNegative to accept a leading minus.
 */
export function FormattedNumberInput({
  value = '',
  onChange,
  fractionDigits = 0,
  allowNegative = false,
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
  const hasValue = raw.trim() !== '' && raw.trim() !== '-'

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
        if (!raw.trim() || raw.trim() === '-') {
          onChange?.('')
        } else {
          const n = parseQty(raw)
          onChange?.(Number.isFinite(n) ? String(n) : '')
        }
        onBlur?.(e)
      }}
      onChange={(e) => {
        onChange?.(
          sanitizeNumericInput(e.target.value, { allowDecimal, allowNegative }),
        )
      }}
      {...rest}
    />
  )
}
