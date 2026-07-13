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
      onFocus={() => setFocused(true)}
      onBlur={() => {
        setFocused(false)
        if (!raw.trim()) {
          onChange?.('')
          return
        }
        const n = parseQty(raw)
        onChange?.(Number.isFinite(n) ? String(n) : '')
      }}
      onChange={(e) => {
        onChange?.(e.target.value.replace(/,/g, ''))
      }}
      {...rest}
    />
  )
}
