import { MagnifyingGlassIcon, TrashIcon } from '@heroicons/react/24/outline'
import { useEffect, useMemo, useRef, useState } from 'react'
import { fetchPurchaseLines } from '../../api/tally'
import { Modal } from '../common/Modal'
import { FormAutocomplete } from '../form/FormAutocomplete'
import { FormField } from '../form/FormPanel'
import { formatDate } from '../../utils/formatDate'
import {
  aggregatePurchaseLines,
  formatQty,
  formatRate,
  formatValue,
  formatWeight,
  rateFromValueWeight,
} from '../../utils/formatNumber'
import { getApiErrorMessage } from '../../utils/formValidation'
import { isLegacyBlockedPurchaseVoucher } from '../../config/oridDhallPurchaseVouchers'

function lineWeight(line) {
  const w = Number(line?.weight)
  if (Number.isFinite(w)) return w
  const q = Number(line?.qty)
  return Number.isFinite(q) ? q : NaN
}

function purchaseOptionLabel(line) {
  const weight = lineWeight(line)
  const qty = Number(line?.qty)
  return [
    line.voucher_no,
    line.ledger_name,
    line.stock_item,
    Number.isFinite(qty) ? `Qty ${formatQty(qty)}` : null,
    Number.isFinite(weight) ? `${formatWeight(weight)} kg` : null,
    formatVoucherDate(line),
  ]
    .filter(Boolean)
    .join(' — ')
}

function formatVoucherDate(line) {
  return formatDate(line?.voucher_date) || String(line?.voucher_date ?? '').slice(0, 10)
}

function renderPurchaseOption(line) {
  const weight = lineWeight(line)
  const qty = Number(line?.qty)
  const voucherDate = formatVoucherDate(line)
  return (
    <div className="win-form__autocomplete-option-body win-form__autocomplete-option-body--purchase">
      <span className="win-form__autocomplete-v win-form__autocomplete-v--stack">
        <span>{line.voucher_no}</span>
        {voucherDate ? (
          <span className="win-form__autocomplete-v--muted">{voucherDate}</span>
        ) : null}
      </span>
      <span className="win-form__autocomplete-v">{line.ledger_name ?? ''}</span>
      <span className="win-form__autocomplete-v win-form__autocomplete-v--muted">
        {line.stock_item ?? ''}
      </span>
      <span className="win-form__autocomplete-v win-form__autocomplete-v--num">
        {Number.isFinite(qty) ? formatQty(qty) : ''}
      </span>
      <span className="win-form__autocomplete-v win-form__autocomplete-v--num">
        {Number.isFinite(weight) ? `${formatWeight(weight)} kg` : ''}
      </span>
    </div>
  )
}

function filterByVoucherNo(line, query) {
  return String(line.voucher_no ?? '')
    .toLowerCase()
    .includes(query)
}

export function PurchaseLinePickerModal({
  stockItem,
  stockGroup,
  title = 'Select purchase line',
  initialLines = [],
  usedVoucherNos = [],
  onClose,
}) {
  const searchRef = useRef(null)
  const [options, setOptions] = useState([])
  const [addedLines, setAddedLines] = useState(() => initialLines ?? [])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedId, setSelectedId] = useState('')
  const [focusAfterAdd, setFocusAfterAdd] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError('')
      try {
        const data = await fetchPurchaseLines({ stockItem, stockGroup })
        if (!cancelled) setOptions(data ?? [])
      } catch (err) {
        if (!cancelled) {
          setOptions([])
          setError(getApiErrorMessage(err, 'Failed to load purchase lines'))
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [stockItem, stockGroup])

  const usedElsewhere = useMemo(
    () =>
      new Set(
        (usedVoucherNos ?? []).map((no) => String(no).trim()).filter(Boolean),
      ),
    [usedVoucherNos],
  )

  // Vouchers already on this production (present system) are not legacy-blocked.
  const ownProductionVouchers = useMemo(
    () =>
      new Set(
        (initialLines ?? [])
          .map((line) => String(line?.voucher_no ?? '').trim())
          .filter(Boolean),
      ),
    [initialLines],
  )

  const legacyUsedVouchers = useMemo(() => {
    const nos = new Set()
    for (const line of options) {
      const voucherNo = String(line?.voucher_no ?? '').trim()
      if (!voucherNo) continue
      if (ownProductionVouchers.has(voucherNo)) continue
      if (isLegacyBlockedPurchaseVoucher(voucherNo)) nos.add(voucherNo)
    }
    return nos
  }, [options, ownProductionVouchers])

  const usedInModal = useMemo(() => {
    const nos = new Set(usedElsewhere)
    for (const voucherNo of legacyUsedVouchers) nos.add(voucherNo)
    for (const line of addedLines) {
      const voucherNo = String(line?.voucher_no ?? '').trim()
      if (voucherNo) nos.add(voucherNo)
    }
    return nos
  }, [usedElsewhere, legacyUsedVouchers, addedLines])

  const availableOptions = useMemo(() => {
    const addedIds = new Set(addedLines.map((line) => String(line.id)))
    return options.filter((line) => {
      if (addedIds.has(String(line.id))) return false
      const voucherNo = String(line?.voucher_no ?? '').trim()
      if (voucherNo && usedInModal.has(voucherNo)) return false
      return true
    })
  }, [options, addedLines, usedInModal])

  const totals = useMemo(() => {
    let totalQty = 0
    for (const line of addedLines) {
      const qty = Number(line?.qty)
      if (Number.isFinite(qty)) totalQty += qty
    }
    const { totalWeight, totalValue, rate } = aggregatePurchaseLines(addedLines)
    return { totalQty, totalWeight, totalValue, rate }
  }, [addedLines])

  useEffect(() => {
    if (!focusAfterAdd || loading) return
    setFocusAfterAdd(false)
    searchRef.current?.focus()
  }, [focusAfterAdd, loading])

  function closeWithSelection() {
    onClose?.(addedLines)
  }

  function addLine(line) {
    if (!line) return
    const voucherNo = String(line?.voucher_no ?? '').trim()
    if (voucherNo && usedElsewhere.has(voucherNo)) {
      setError(`Voucher ${voucherNo} is already used in another production.`)
      return
    }
    if (
      voucherNo &&
      !ownProductionVouchers.has(voucherNo) &&
      isLegacyBlockedPurchaseVoucher(voucherNo)
    ) {
      setError(`Voucher ${voucherNo} is already used in the legacy system.`)
      return
    }
    if (
      voucherNo &&
      addedLines.some((row) => String(row?.voucher_no ?? '').trim() === voucherNo)
    ) {
      setError(`Voucher ${voucherNo} is already added.`)
      return
    }
    setError('')
    setAddedLines((prev) => {
      if (prev.some((row) => String(row.id) === String(line.id))) return prev
      if (
        voucherNo &&
        prev.some((row) => String(row?.voucher_no ?? '').trim() === voucherNo)
      ) {
        return prev
      }
      return [...prev, line]
    })
    setSelectedId('')
    setFocusAfterAdd(true)
  }

  function removeLine(lineId) {
    setAddedLines((prev) => prev.filter((row) => String(row.id) !== String(lineId)))
  }

  function onConfirmSearch(id, line) {
    if (line) {
      addLine(line)
      return
    }
    const match = availableOptions.find((row) => String(row.id) === String(id))
    if (match) addLine(match)
  }

  return (
    <Modal
      title={title}
      titleIcon={MagnifyingGlassIcon}
      onClose={closeWithSelection}
      ariaLabelledBy="purchase-line-picker-title"
      className="dc-search-modal"
    >
      <div className="dc-search-layout">
        <div className="dc-search-toolbar odp-purchase-toolbar">
          <FormField label="Voucher No." className="dc-search-field odp-purchase-search">
            <FormAutocomplete
              ref={searchRef}
              options={availableOptions}
              value={selectedId}
              onChange={setSelectedId}
              onConfirm={onConfirmSearch}
              getOptionValue={(line) => String(line.id)}
              getOptionLabel={purchaseOptionLabel}
              getInputLabel={(line) => line.voucher_no ?? ''}
              renderOption={renderPurchaseOption}
              filterOption={filterByVoucherNo}
              disabled={loading}
              emptyMessage={loading ? 'Loading…' : 'No matching voucher nos'}
            />
          </FormField>
          <p className="dc-search-count">
            {loading ? 'Loading…' : `${addedLines.length} added`}
          </p>
        </div>

        {error ? <p className="dc-search-error">{error}</p> : null}

        <div className="dc-search-panel">
          <div className="dc-search-table-shell">
            <div className="dc-search-table-scroll">
              <table className="dc-search-table">
                <colgroup>
                  <col className="col-vno" />
                  <col className="col-party" />
                  <col className="col-stock" />
                  <col className="col-qty" />
                  <col className="col-weight" />
                  <col className="col-rate" />
                  <col className="col-value" />
                  <col className="col-action" />
                </colgroup>
                <thead>
                  <tr>
                    <th>Voucher No</th>
                    <th>Party Name</th>
                    <th>Stock Item</th>
                    <th className="dc-search-num">Qty</th>
                    <th className="dc-search-num">Weight</th>
                    <th className="dc-search-num">Rate</th>
                    <th className="dc-search-num">Value</th>
                    <th aria-label="Actions" className="dc-search-action" />
                  </tr>
                </thead>
                <tbody>
                  {addedLines.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="dc-search-empty">
                        Search a voucher no. and press Enter to add.
                      </td>
                    </tr>
                  ) : (
                    addedLines.map((line) => {
                      const rate = rateFromValueWeight(line)
                      const voucherDate = formatVoucherDate(line)
                      return (
                        <tr key={line.id}>
                          <td>
                            <div className="dc-search-vno-stack">
                              <span>{line.voucher_no ?? ''}</span>
                              {voucherDate ? (
                                <span className="dc-search-vno-date">{voucherDate}</span>
                              ) : null}
                            </div>
                          </td>
                          <td>{line.ledger_name ?? ''}</td>
                          <td>{line.stock_item ?? ''}</td>
                          <td className="dc-search-num">{formatQty(line.qty)}</td>
                          <td className="dc-search-num">{formatWeight(line.weight)}</td>
                          <td className="dc-search-num">
                            {rate != null ? formatRate(rate) : ''}
                          </td>
                          <td className="dc-search-num">{formatValue(line.amount)}</td>
                          <td className="dc-search-action">
                            <button
                              type="button"
                              className="win-form__icon-button"
                              aria-label={`Remove ${line.voucher_no ?? 'line'}`}
                              onClick={() => removeLine(line.id)}
                            >
                              <TrashIcon />
                            </button>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
            {addedLines.length > 0 ? (
              <div className="dc-search-table-foot">
                <table className="dc-search-table">
                  <colgroup>
                    <col className="col-vno" />
                    <col className="col-party" />
                    <col className="col-stock" />
                    <col className="col-qty" />
                    <col className="col-weight" />
                    <col className="col-rate" />
                    <col className="col-value" />
                    <col className="col-action" />
                  </colgroup>
                  <tbody>
                    <tr className="dc-search-total-row">
                      <td colSpan={3}>Total</td>
                      <td className="dc-search-num">{formatQty(totals.totalQty)}</td>
                      <td className="dc-search-num">{formatWeight(totals.totalWeight)}</td>
                      <td className="dc-search-num">
                        {totals.rate != null ? formatRate(totals.rate) : ''}
                      </td>
                      <td className="dc-search-num">{formatValue(totals.totalValue)}</td>
                      <td className="dc-search-action" />
                    </tr>
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </Modal>
  )
}
