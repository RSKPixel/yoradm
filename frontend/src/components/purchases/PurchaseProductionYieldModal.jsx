import { CubeIcon } from '@heroicons/react/24/outline'
import { useMemo } from 'react'
import { formatDate } from '../../utils/formatDate'
import { formatCommaNumber, formatQty, formatValue } from '../../utils/formatNumber'
import { Modal } from '../common/Modal'

function num(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function productWeightKg(rawWeightKg, pct) {
  if (rawWeightKg == null || pct == null) return null
  return (rawWeightKg * pct) / 100
}

function byproductValue(weightKg, rate) {
  if (weightKg == null || rate == null || weightKg <= 0) return null
  return Math.round((weightKg / 100) * rate * 100) / 100
}

function buildYieldRows(row) {
  const yieldInfo = row?.production_yield
  if (!yieldInfo) return []

  const rawWeightKg = num(row.weight)
  const dhallPct = num(yieldInfo.orid_dhall_pct)
  const splitPct = num(yieldInfo.orid_dhall_split_pct)
  const rejectionPct = num(yieldInfo.orid_rejection_pct)
  const huskPct = num(yieldInfo.orid_husk_pct)
  const splitRate = num(yieldInfo.split_rate)
  const rejectionRate = num(yieldInfo.rejection_rate)
  const huskRate = num(yieldInfo.husk_rate)

  const splitWeight = productWeightKg(rawWeightKg, splitPct)
  const rejectionWeight = productWeightKg(rawWeightKg, rejectionPct)
  const huskWeight = productWeightKg(rawWeightKg, huskPct)

  return [
    {
      key: 'dhall',
      label: 'Orid Dhall',
      pct: dhallPct,
      weight: productWeightKg(rawWeightKg, dhallPct),
      rate: num(row.orid_dhall_rate),
      value: num(row.orid_dhall_value),
    },
    {
      key: 'split',
      label: 'Orid Dhall Split',
      pct: splitPct,
      weight: splitWeight,
      rate: splitRate,
      value: byproductValue(splitWeight, splitRate),
    },
    {
      key: 'rejection',
      label: 'Orid Dhall Rejection',
      pct: rejectionPct,
      weight: rejectionWeight,
      rate: rejectionRate,
      value: byproductValue(rejectionWeight, rejectionRate),
    },
    {
      key: 'husk',
      label: 'Orid Husk',
      pct: huskPct,
      weight: huskWeight,
      rate: huskRate,
      value: byproductValue(huskWeight, huskRate),
    },
  ]
}

function formatPct(value) {
  if (value == null) return '—'
  return `${formatCommaNumber(value, 2)}%`
}

export function PurchaseProductionYieldModal({ row, onClose }) {
  const lines = useMemo(() => buildYieldRows(row), [row])
  const totalValue = useMemo(
    () => lines.reduce((sum, line) => sum + (line.value || 0), 0),
    [lines],
  )

  const subtitle = [
    formatDate(row?.voucher_date) || null,
    row?.ledger_name || null,
    row?.stock_item || null,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <Modal
      title="Production yield"
      titleIcon={CubeIcon}
      onClose={onClose}
      className="purchases-yield-modal"
      ariaLabelledBy="purchases-yield-modal-title"
    >
      <div className="purchases-yield-modal__body">
        {subtitle ? <p className="purchases-yield-modal__subtitle">{subtitle}</p> : null}
        <div className="purchases-yield-modal__table-wrap">
          <table className="win-form__table win-form__table--bordered purchases-yield-modal__table w-full text-sm">
            <thead>
              <tr>
                <th>Product</th>
                <th className="win-form__table-num">%</th>
                <th className="win-form__table-num">Weight</th>
                <th className="win-form__table-num">Rate</th>
                <th className="win-form__table-num">Value</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => (
                <tr key={line.key}>
                  <td>{line.label}</td>
                  <td className="win-form__table-num">
                    <span className="win-form__table-readonly">{formatPct(line.pct)}</span>
                  </td>
                  <td className="win-form__table-num">
                    <span className="win-form__table-readonly">
                      {line.weight == null ? '—' : formatQty(line.weight)}
                    </span>
                  </td>
                  <td className="win-form__table-num">
                    <span className="win-form__table-readonly">
                      {line.rate == null ? '—' : formatValue(line.rate)}
                    </span>
                  </td>
                  <td className="win-form__table-num">
                    <span className="win-form__table-readonly">
                      {line.value == null ? '—' : formatValue(line.value)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={4}>
                  <span className="win-form__table-total-label">Total value</span>
                </td>
                <td className="win-form__table-num">
                  <span className="win-form__table-readonly">{formatValue(totalValue)}</span>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <div className="purchases-yield-modal__footer">
        <button type="button" className="win-form__button" onClick={onClose}>
          Close
        </button>
      </div>
    </Modal>
  )
}
