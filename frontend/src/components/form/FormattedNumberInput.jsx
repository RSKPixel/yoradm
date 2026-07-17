import { useState } from 'react'
import { FormInput } from './FormPanel'
import { formatCommaNumber } from '../../utils/formatNumber'

function parseQty(value) {
  const n = Number.parseFloat(String(value ?? '').replace(/,/g, ''))
  return Number.isFinite(n) ? n : NaN
}

/**
 * Stores a raw numeric string (no commas).
 * Focused: plain digits. Blurred: comma-formatted display.
 */
export function FormattedNumberInput({
  value = '',
  onChange,
  fractionDigits = 0,
  className = '',
  inputMode = 'decimal',
  selectOnFocus = false,
  onFocus,
  onBlur,
  ...rest
}) {
  const [focused, setFocused] = useState(false)
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
      className={className}
      inputMode={inputMode}
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
        onChange?.(e.target.value.replace(/,/g, ''))
      }}
      {...rest}
    />
  )
}
