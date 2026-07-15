import { ChevronDownIcon, ListBulletIcon, PlusIcon } from '@heroicons/react/24/outline'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { fetchDeliveryQtyByBatch } from '../api/deliveryChallan'
import {
  createOridDhallProduction,
  fetchOpenOridDhallBatches,
  fetchOridDhallProduction,
  fetchUsedProductionVouchers,
  updateOridDhallProduction,
  updateOridDhallProductionStatus,
} from '../api/oridDhallProduction'
import { DeliveryBagsByDateModal } from '../components/orid-dhall-production/DeliveryBagsByDateModal'
import { OridDhallProductionSearchModal } from '../components/orid-dhall-production/OridDhallProductionSearchModal'
import { PurchaseLinePickerModal } from '../components/orid-dhall-production/PurchaseLinePickerModal'
import { FormField, FormInput, FormSelect } from '../components/form/FormPanel'
import { FormDropdown } from '../components/form/FormDropdown'
import { PrimaryContentLayout } from '../components/layout/PrimaryContentLayout'
import { FormattedNumberInput } from '../components/form/FormattedNumberInput'
import { useFormMessage } from '../components/form/FormMessage'
import { toIsoDateInput, todayIsoDate } from '../utils/formatDate'
import {
  aggregatePurchaseLines,
  formatCommaNumber,
  formatQty,
  formatRate,
  formatValue,
} from '../utils/formatNumber'
import {
  getApiErrorMessage,
  validateOridDhallProductionForm,
} from '../utils/formValidation'

const RAW_STOCK_GROUP = 'Orid Raw'
const DHALL_STOCK_GROUP = 'Orid Dhall'
const BAG_KG = 50
const BATCH_NEW = 'new'
const STATUS_OPEN = 'Open'
const STATUS_CLOSED = 'Closed'

function parseQty(value) {
  const n = Number.parseFloat(String(value ?? '').replace(/,/g, ''))
  return Number.isFinite(n) ? n : 0
}

/** 50kg bags → quintal (bags × 50 ÷ 100). */
function bagsToQuintal(bags) {
  return parseQty(bags) * (BAG_KG / 100)
}

/** Value from rate where rate = (value / weight) × 100 → value = rate × quintal. */
function valueFromRateQuintal(rate, quintal) {
  const r = parseQty(rate)
  const q = Number(quintal)
  if (!Number.isFinite(r) || !Number.isFinite(q)) return null
  return r * q
}

function emptyFormState() {
  return {
    date: todayIsoDate(),
    status: STATUS_OPEN,
    wetFlourYield: '',
    splitPctInput: '',
    rawPurchases: [],
    avgPurchases: [],
    openingBags: '',
    openingRate: '',
    previousBatchBags: '',
    previousBatchRate: '',
    deliveryBags: '',
    deliveryRate: '',
    closingBags: '',
    closingRate: '',
    splitBags: '',
    splitRate: '',
    sortexBags: '',
    sortexRate: '',
    huskBags: '',
    huskRate: '',
  }
}

function toPurchaseLinePayload(line) {
  const voucherDate = line?.voucher_date
  return {
    purchase_id: line?.purchase_id ?? line?.id ?? null,
    voucher_no: line?.voucher_no ?? null,
    voucher_date: voucherDate != null ? String(voucherDate).slice(0, 32) : null,
    ledger_name: line?.ledger_name ?? null,
    broker: line?.broker ?? null,
    stock_item: line?.stock_item ?? null,
    brand: line?.brand ?? null,
    packing: line?.packing ?? null,
    qty: line?.qty ?? null,
    weight: line?.weight ?? null,
    rate: line?.rate ?? null,
    amount: line?.amount ?? null,
  }
}

function fromPurchaseLineApi(line) {
  return {
    id: line.purchase_id ?? line.id,
    purchase_id: line.purchase_id ?? line.id,
    voucher_no: line.voucher_no,
    voucher_date: line.voucher_date,
    ledger_name: line.ledger_name,
    broker: line.broker,
    stock_item: line.stock_item,
    brand: line.brand,
    packing: line.packing,
    qty: line.qty,
    weight: line.weight,
    rate: line.rate,
    amount: line.amount,
  }
}

function bagsFromQty(qty) {
  const n = Number(qty)
  if (!Number.isFinite(n) || n === 0) return ''
  const rounded = Math.round(n * 100) / 100
  return String(rounded)
}

function normField(value) {
  if (value == null) return ''
  return String(value)
}

function purchaseSnapshot(lines) {
  return (lines ?? [])
    .map((line) => ({
      purchase_id: line?.purchase_id ?? line?.id ?? null,
      voucher_no: normField(line?.voucher_no),
      qty: line?.qty ?? null,
      weight: line?.weight ?? null,
      rate: line?.rate ?? null,
      amount: line?.amount ?? null,
    }))
    .sort((a, b) => Number(a.purchase_id ?? 0) - Number(b.purchase_id ?? 0))
}

function buildFormSnapshot({
  date,
  status,
  wetFlourYield,
  splitPctInput,
  rawPurchases,
  avgPurchases,
  openingBags,
  openingRate,
  previousBatchBags,
  previousBatchRate,
  deliveryBags,
  deliveryRate,
  closingBags,
  closingRate,
  splitBags,
  splitRate,
  sortexBags,
  sortexRate,
  huskBags,
  huskRate,
}) {
  return JSON.stringify({
    date: normField(date),
    status: normField(status),
    wetFlourYield: normField(wetFlourYield),
    splitPctInput: normField(splitPctInput),
    rawPurchases: purchaseSnapshot(rawPurchases),
    avgPurchases: purchaseSnapshot(avgPurchases),
    openingBags: normField(openingBags),
    openingRate: normField(openingRate),
    previousBatchBags: normField(previousBatchBags),
    previousBatchRate: normField(previousBatchRate),
    deliveryBags: normField(deliveryBags),
    deliveryRate: normField(deliveryRate),
    closingBags: normField(closingBags),
    closingRate: normField(closingRate),
    splitBags: normField(splitBags),
    splitRate: normField(splitRate),
    sortexBags: normField(sortexBags),
    sortexRate: normField(sortexRate),
    huskBags: normField(huskBags),
    huskRate: normField(huskRate),
  })
}

export function OridDhallProductionPage() {
  const { showErrors, showError, showSuccess } = useFormMessage()

  const [date, setDate] = useState(() => emptyFormState().date)
  const [status, setStatus] = useState(STATUS_OPEN)
  const [wetFlourYield, setWetFlourYield] = useState('')
  const [splitPctInput, setSplitPctInput] = useState('')
  const [savedId, setSavedId] = useState(null)
  const [persistedStatus, setPersistedStatus] = useState(null)
  const [saving, setSaving] = useState(false)
  const [loadingProduction, setLoadingProduction] = useState(false)
  const [openBatches, setOpenBatches] = useState([])
  const [searchOpen, setSearchOpen] = useState(false)
  const [rawPickerOpen, setRawPickerOpen] = useState(false)
  const [avgPickerOpen, setAvgPickerOpen] = useState(false)
  const [deliveryListOpen, setDeliveryListOpen] = useState(false)
  const [dhallExpanded, setDhallExpanded] = useState(true)
  const [usedVouchers, setUsedVouchers] = useState([])
  const [rawPurchases, setRawPurchases] = useState([])
  const [avgPurchases, setAvgPurchases] = useState([])

  const [openingBags, setOpeningBags] = useState('')
  const [openingRate, setOpeningRate] = useState('')
  const [previousBatchBags, setPreviousBatchBags] = useState('')
  const [previousBatchRate, setPreviousBatchRate] = useState('')
  const [deliveryBags, setDeliveryBags] = useState('')
  const [deliveryRate, setDeliveryRate] = useState('')
  const [deliveryAmount, setDeliveryAmount] = useState(null)
  const [closingBags, setClosingBags] = useState('')
  const [closingRate, setClosingRate] = useState('')
  const [splitBags, setSplitBags] = useState('')
  const [splitRate, setSplitRate] = useState('')
  const [sortexBags, setSortexBags] = useState('')
  const [sortexRate, setSortexRate] = useState('')
  const [huskBags, setHuskBags] = useState('')
  const [huskRate, setHuskRate] = useState('')
  const [baselineSnapshot, setBaselineSnapshot] = useState(null)
  const [baselineEpoch, setBaselineEpoch] = useState(0)

  const lotNo = savedId != null ? String(savedId) : ''
  const batchSelectValue = savedId != null ? String(savedId) : BATCH_NEW
  const isModifyMode = savedId != null
  const isClosedLocked = persistedStatus === STATUS_CLOSED
  const busy = saving || loadingProduction

  const currentSnapshot = useMemo(
    () =>
      buildFormSnapshot({
        date,
        status,
        wetFlourYield,
        splitPctInput,
        rawPurchases,
        avgPurchases,
        openingBags,
        openingRate,
        previousBatchBags,
        previousBatchRate,
        deliveryBags,
        deliveryRate,
        closingBags,
        closingRate,
        splitBags,
        splitRate,
        sortexBags,
        sortexRate,
        huskBags,
        huskRate,
      }),
    [
      date,
      status,
      wetFlourYield,
      splitPctInput,
      rawPurchases,
      avgPurchases,
      openingBags,
      openingRate,
      previousBatchBags,
      previousBatchRate,
      deliveryBags,
      deliveryRate,
      closingBags,
      closingRate,
      splitBags,
      splitRate,
      sortexBags,
      sortexRate,
      huskBags,
      huskRate,
    ],
  )

  const isDirty = isModifyMode && baselineSnapshot != null && currentSnapshot !== baselineSnapshot
  const saveDisabled = busy || isClosedLocked || (isModifyMode && !isDirty)
  const formSnapshotRef = useRef(currentSnapshot)
  formSnapshotRef.current = currentSnapshot

  const batchOptions = useMemo(
    () =>
      [...openBatches].sort((a, b) => Number(b.id) - Number(a.id)),
    [openBatches],
  )

  const batchDropdownOptions = useMemo(
    () => [
      { value: BATCH_NEW, label: 'New' },
      ...batchOptions.map((row) => ({
        value: String(row.id),
        label: row.lot_no || String(row.id),
      })),
    ],
    [batchOptions],
  )

  async function refreshOpenBatches() {
    try {
      const rows = await fetchOpenOridDhallBatches()
      setOpenBatches(rows ?? [])
    } catch {
      setOpenBatches([])
    }
  }

  const refreshUsedVouchers = useCallback(async () => {
    try {
      const used = await fetchUsedProductionVouchers({
        excludeProductionId: savedId || undefined,
      })
      setUsedVouchers(used ?? [])
    } catch {
      setUsedVouchers([])
    }
  }, [savedId])

  useEffect(() => {
    void refreshOpenBatches()
  }, [])

  useEffect(() => {
    void refreshUsedVouchers()
  }, [refreshUsedVouchers])

  useEffect(() => {
    if (savedId == null) {
      setDeliveryBags('')
      setDeliveryRate('')
      setDeliveryAmount(null)
      return undefined
    }

    let cancelled = false
    async function loadDeliveryFromSales() {
      try {
        const data = await fetchDeliveryQtyByBatch({
          batchNo: String(savedId),
          stockGroup: DHALL_STOCK_GROUP,
        })
        if (cancelled) return
        const bags = bagsFromQty(data.total_qty)
        setDeliveryBags(bags)
        const quintal = bagsToQuintal(bags)
        const amount = Number(data.total_amount)
        if (Number.isFinite(amount) && amount !== 0) {
          setDeliveryAmount(amount)
          if (quintal > 0) {
            const rate = Math.round((amount / quintal) * 100) / 100
            setDeliveryRate(String(rate))
          } else {
            setDeliveryRate('')
          }
        } else {
          setDeliveryAmount(null)
          setDeliveryRate('')
        }
      } catch {
        if (!cancelled) {
          setDeliveryBags('')
          setDeliveryRate('')
          setDeliveryAmount(null)
        }
      } finally {
        if (!cancelled) setBaselineEpoch((n) => n + 1)
      }
    }

    void loadDeliveryFromSales()
    return () => {
      cancelled = true
    }
  }, [savedId])

  useEffect(() => {
    if (baselineEpoch === 0 || savedId == null) return
    setBaselineSnapshot(formSnapshotRef.current)
  }, [baselineEpoch, savedId])

  const rawTotals = useMemo(
    () => aggregatePurchaseLines(rawPurchases),
    [rawPurchases],
  )

  const avgTotals = useMemo(
    () => aggregatePurchaseLines(avgPurchases),
    [avgPurchases],
  )

  const averageQuintal = avgPurchases.length ? avgTotals.quintal : 0
  const openingQuintal = bagsToQuintal(openingBags)
  const previousBatchQuintal = bagsToQuintal(previousBatchBags)
  const deliveryQuintal = bagsToQuintal(deliveryBags)
  const closingQuintal = bagsToQuintal(closingBags)
  const splitQuintal = bagsToQuintal(splitBags)
  const sortexQuintal = bagsToQuintal(sortexBags)
  const huskQuintal = bagsToQuintal(huskBags)

  const openingValue = valueFromRateQuintal(openingRate, openingQuintal)
  const previousBatchValue = valueFromRateQuintal(
    previousBatchRate,
    previousBatchQuintal,
  )
  const deliveryValue =
    deliveryAmount != null
      ? deliveryAmount
      : valueFromRateQuintal(deliveryRate, deliveryQuintal)
  const closingValue = valueFromRateQuintal(closingRate, closingQuintal)
  const splitValue = valueFromRateQuintal(splitRate, splitQuintal)
  const sortexValue = valueFromRateQuintal(sortexRate, sortexQuintal)
  const huskValue = valueFromRateQuintal(huskRate, huskQuintal)

  const oridDhallQuintal = useMemo(() => {
    return (
      deliveryQuintal +
      closingQuintal -
      openingQuintal -
      averageQuintal -
      previousBatchQuintal
    )
  }, [
    deliveryQuintal,
    closingQuintal,
    openingQuintal,
    averageQuintal,
    previousBatchQuintal,
  ])

  const oridDhallBags = useMemo(() => {
    return (
      parseQty(deliveryBags) +
      parseQty(closingBags) -
      parseQty(openingBags) -
      (avgPurchases.length ? avgTotals.totalQty : 0) -
      parseQty(previousBatchBags)
    )
  }, [
    deliveryBags,
    closingBags,
    openingBags,
    avgPurchases.length,
    avgTotals.totalQty,
    previousBatchBags,
  ])

  const oridDhallValue = useMemo(() => {
    return (
      (deliveryValue || 0) +
      (closingValue || 0) -
      (openingValue || 0) -
      (avgPurchases.length ? avgTotals.totalValue : 0) -
      (previousBatchValue || 0)
    )
  }, [
    deliveryValue,
    closingValue,
    openingValue,
    avgPurchases.length,
    avgTotals.totalValue,
    previousBatchValue,
  ])

  /** Rate = (value / weight) × 100 = value / quintal */
  const oridDhallRate = useMemo(() => {
    if (oridDhallQuintal === 0) return null
    return oridDhallValue / oridDhallQuintal
  }, [oridDhallQuintal, oridDhallValue])

  const oridDhallPct = useMemo(() => {
    if (!rawPurchases.length || rawTotals.quintal === 0) return null
    return (oridDhallQuintal / rawTotals.quintal) * 100
  }, [rawPurchases.length, rawTotals.quintal, oridDhallQuintal])

  const splitPct = useMemo(() => {
    if (!rawPurchases.length || rawTotals.quintal === 0 || String(splitBags).trim() === '')
      return null
    return (splitQuintal / rawTotals.quintal) * 100
  }, [rawPurchases.length, rawTotals.quintal, splitBags, splitQuintal])

  const sortexPct = useMemo(() => {
    if (
      !rawPurchases.length ||
      rawTotals.quintal === 0 ||
      String(sortexBags).trim() === ''
    )
      return null
    return (sortexQuintal / rawTotals.quintal) * 100
  }, [rawPurchases.length, rawTotals.quintal, sortexBags, sortexQuintal])

  const huskPct = useMemo(() => {
    if (!rawPurchases.length || rawTotals.quintal === 0 || String(huskBags).trim() === '')
      return null
    return (huskQuintal / rawTotals.quintal) * 100
  }, [rawPurchases.length, rawTotals.quintal, huskBags, huskQuintal])

  function resetForm() {
    const next = emptyFormState()
    setSavedId(null)
    setPersistedStatus(null)
    setBaselineSnapshot(null)
    setDate(next.date)
    setStatus(next.status)
    setWetFlourYield(next.wetFlourYield)
    setSplitPctInput(next.splitPctInput)
    setRawPurchases(next.rawPurchases)
    setAvgPurchases(next.avgPurchases)
    setOpeningBags(next.openingBags)
    setOpeningRate(next.openingRate)
    setPreviousBatchBags(next.previousBatchBags)
    setPreviousBatchRate(next.previousBatchRate)
    setDeliveryBags(next.deliveryBags)
    setDeliveryRate(next.deliveryRate)
    setDeliveryAmount(null)
    setClosingBags(next.closingBags)
    setClosingRate(next.closingRate)
    setSplitBags(next.splitBags)
    setSplitRate(next.splitRate)
    setSortexBags(next.sortexBags)
    setSortexRate(next.sortexRate)
    setHuskBags(next.huskBags)
    setHuskRate(next.huskRate)
    showSuccess('Form cleared.')
  }

  function onFormKeyDown(e) {
    if (e.key !== 'Enter') return
    e.preventDefault()
  }

  function buildPayload() {
    return {
      production_date: date,
      status,
      wet_flour_yield: wetFlourYield || null,
      split_pct: splitPctInput || null,
      opening_bags: openingBags || null,
      opening_rate: openingRate || null,
      previous_batch_bags: previousBatchBags || null,
      previous_batch_rate: previousBatchRate || null,
      delivery_bags: deliveryBags || null,
      delivery_rate: deliveryRate || null,
      closing_bags: closingBags || null,
      closing_rate: closingRate || null,
      split_bags: splitBags || null,
      split_rate: splitRate || null,
      sortex_bags: sortexBags || null,
      sortex_rate: sortexRate || null,
      husk_bags: huskBags || null,
      husk_rate: huskRate || null,
      raw_purchases: rawPurchases.map(toPurchaseLinePayload),
      avg_purchases: avgPurchases.map(toPurchaseLinePayload),
    }
  }

  function applyProduction(row) {
    const nextStatus = row.status === STATUS_CLOSED ? STATUS_CLOSED : STATUS_OPEN
    setBaselineSnapshot(null)
    setSavedId(row.id)
    setPersistedStatus(nextStatus)
    setDate(toIsoDateInput(row.production_date) || todayIsoDate())
    setStatus(nextStatus)
    setWetFlourYield(row.wet_flour_yield ?? '')
    setSplitPctInput(row.split_pct ?? '')
    setRawPurchases((row.raw_purchases ?? []).map(fromPurchaseLineApi))
    setAvgPurchases((row.avg_purchases ?? []).map(fromPurchaseLineApi))
    setOpeningBags(row.opening_bags ?? '')
    setOpeningRate(row.opening_rate ?? '')
    setPreviousBatchBags(row.previous_batch_bags ?? '')
    setPreviousBatchRate(row.previous_batch_rate ?? '')
    setDeliveryBags(row.delivery_bags ?? '')
    setDeliveryRate(row.delivery_rate ?? '')
    setClosingBags(row.closing_bags ?? '')
    setClosingRate(row.closing_rate ?? '')
    setSplitBags(row.split_bags ?? '')
    setSplitRate(row.split_rate ?? '')
    setSortexBags(row.sortex_bags ?? '')
    setSortexRate(row.sortex_rate ?? '')
    setHuskBags(row.husk_bags ?? '')
    setHuskRate(row.husk_rate ?? '')
  }

  async function onSelectProduction(productionId) {
    setSearchOpen(false)
    setLoadingProduction(true)
    try {
      const row = await fetchOridDhallProduction(productionId)
      applyProduction(row)
      showSuccess(`Loaded lot ${row.lot_no || row.id}.`)
    } catch (error) {
      showError(getApiErrorMessage(error, 'Could not load production'))
    } finally {
      setLoadingProduction(false)
    }
  }

  async function onStatusChange(e) {
    const nextStatus = e.target.value === STATUS_CLOSED ? STATUS_CLOSED : STATUS_OPEN
    const previousStatus = status
    setStatus(nextStatus)
    if (savedId == null) return
    if (nextStatus === persistedStatus) return

    setSaving(true)
    try {
      await updateOridDhallProductionStatus(savedId, nextStatus)
      setPersistedStatus(nextStatus)
      setBaselineEpoch((n) => n + 1)
      await refreshOpenBatches()
      showSuccess(
        nextStatus === STATUS_CLOSED
          ? `Lot ${savedId} closed.`
          : `Lot ${savedId} reopened.`,
      )
    } catch (error) {
      setStatus(previousStatus)
      showError(getApiErrorMessage(error, 'Could not update status'))
    } finally {
      setSaving(false)
    }
  }

  async function onBatchSelectChange(e) {
    const value = e.target.value
    if (value === BATCH_NEW) {
      resetForm()
      return
    }
    const id = Number(value)
    if (!Number.isFinite(id) || id === savedId) return
    await onSelectProduction(id)
  }

  async function onSave(e) {
    e.preventDefault()
    if (isClosedLocked) return
    const validationErrors = validateOridDhallProductionForm({ date })
    if (validationErrors.length) {
      showErrors(validationErrors)
      return
    }
    setSaving(true)
    try {
      const payload = buildPayload()
      if (savedId) {
        await updateOridDhallProduction(savedId, payload)
        await refreshOpenBatches()
        await refreshUsedVouchers()
        setBaselineSnapshot(currentSnapshot)
        showSuccess('Orid dhall production updated.')
      } else {
        const saved = await createOridDhallProduction(payload)
        const nextStatus = saved.status === STATUS_CLOSED ? STATUS_CLOSED : STATUS_OPEN
        setBaselineSnapshot(null)
        setSavedId(saved.id)
        setStatus(nextStatus)
        setPersistedStatus(nextStatus)
        await refreshOpenBatches()
        showSuccess('Orid dhall production saved.')
      }
    } catch (error) {
      showError(getApiErrorMessage(error, 'Could not save orid dhall production'))
    } finally {
      setSaving(false)
    }
  }

  function voucherNosFromLines(lines) {
    return (lines ?? [])
      .map((line) => String(line?.voucher_no ?? '').trim())
      .filter(Boolean)
  }

  const usedInRawPicker = useMemo(
    () => [...new Set([...usedVouchers, ...voucherNosFromLines(avgPurchases)])],
    [usedVouchers, avgPurchases],
  )

  const usedInAvgPicker = useMemo(
    () => [...new Set([...usedVouchers, ...voucherNosFromLines(rawPurchases)])],
    [usedVouchers, rawPurchases],
  )

  async function openRawPicker() {
    await refreshUsedVouchers()
    setRawPickerOpen(true)
  }

  async function openAvgPicker() {
    await refreshUsedVouchers()
    setAvgPickerOpen(true)
  }

  function onCloseRawPicker(lines) {
    setRawPurchases(lines ?? [])
    setRawPickerOpen(false)
  }

  function onCloseAvgPicker(lines) {
    setAvgPurchases(lines ?? [])
    setAvgPickerOpen(false)
  }

  const hasDhallInput =
    avgPurchases.length > 0 ||
    [openingBags, previousBatchBags, deliveryBags, closingBags].some(
      (v) => String(v).trim() !== '',
    )

  const hasSplit = String(splitBags).trim() !== ''
  const hasSortex = String(sortexBags).trim() !== ''
  const hasHusk = String(huskBags).trim() !== ''

  const pctSum =
    (oridDhallPct ?? 0) + (splitPct ?? 0) + (sortexPct ?? 0) + (huskPct ?? 0)

  const footerPct =
    oridDhallPct != null || splitPct != null || sortexPct != null || huskPct != null
      ? pctSum
      : 0

  const footerValue =
    (hasDhallInput ? oridDhallValue : 0) +
    (hasSplit && String(splitRate).trim() !== '' ? splitValue || 0 : 0) +
    (hasSortex && String(sortexRate).trim() !== '' ? sortexValue || 0 : 0) +
    (hasHusk && String(huskRate).trim() !== '' ? huskValue || 0 : 0) -
    (rawPurchases.length ? rawTotals.totalValue : 0)

  const showFooterTotals =
    rawPurchases.length > 0 ||
    avgPurchases.length > 0 ||
    (String(openingBags).trim() !== '' && String(openingRate).trim() !== '') ||
    (String(previousBatchBags).trim() !== '' &&
      String(previousBatchRate).trim() !== '') ||
    (String(deliveryBags).trim() !== '' && String(deliveryRate).trim() !== '') ||
    (String(closingBags).trim() !== '' && String(closingRate).trim() !== '') ||
    (hasSplit && String(splitRate).trim() !== '') ||
    (hasSortex && String(sortexRate).trim() !== '') ||
    (hasHusk && String(huskRate).trim() !== '') ||
    oridDhallPct != null ||
    splitPct != null ||
    sortexPct != null ||
    huskPct != null

  const odpColGroup = (
    <colgroup>
      <col className="odp-col-stock" />
      <col className="odp-col-bags" />
      <col className="odp-col-quintal" />
      <col className="odp-col-pct" />
      <col className="odp-col-rate" />
      <col className="odp-col-value" />
    </colgroup>
  )

  return (
    <div className="flex h-full min-h-0 max-w-full flex-col">
      {searchOpen ? (
        <OridDhallProductionSearchModal
          onClose={() => setSearchOpen(false)}
          onSelect={(id) => void onSelectProduction(id)}
          onStatusChange={(productionId, nextStatus) => {
            void refreshOpenBatches()
            if (savedId === productionId) {
              const status =
                nextStatus === STATUS_CLOSED ? STATUS_CLOSED : STATUS_OPEN
              setStatus(status)
              setPersistedStatus(status)
            }
          }}
        />
      ) : null}
      {deliveryListOpen && savedId != null ? (
        <DeliveryBagsByDateModal
          batchNo={savedId}
          stockGroup={DHALL_STOCK_GROUP}
          onClose={() => setDeliveryListOpen(false)}
        />
      ) : null}
      {rawPickerOpen ? (
        <PurchaseLinePickerModal
          stockGroup={RAW_STOCK_GROUP}
          title="Orid Raw Material"
          initialLines={rawPurchases}
          usedVoucherNos={usedInRawPicker}
          onClose={onCloseRawPicker}
        />
      ) : null}
      {avgPickerOpen ? (
        <PurchaseLinePickerModal
          stockGroup={DHALL_STOCK_GROUP}
          title="Orid Dhall Average"
          initialLines={avgPurchases}
          usedVoucherNos={usedInAvgPicker}
          onClose={onCloseAvgPicker}
        />
      ) : null}
      <PrimaryContentLayout
        title="Orid Dhall Production"
        breadcrumb={[
          { label: 'Transactions' },
          { label: 'Orid Dhall Production' },
        ]}
        onSubmit={onSave}
        onKeyDown={onFormKeyDown}
        footer={
          <>
              <button
                type="button"
                className="win-form__button"
                onClick={() => setSearchOpen(true)}
                disabled={busy}
              >
                Search
              </button>
              <button
                type="button"
                className="win-form__button"
                onClick={resetForm}
                disabled={busy}
              >
                New
              </button>
              <button
                type="submit"
                className="win-form__button win-form__button--primary"
                disabled={saveDisabled}
                title={isClosedLocked ? 'Closed productions cannot be saved' : undefined}
              >
                {saving ? 'Saving…' : isModifyMode ? 'Update' : 'Save'}
              </button>
          </>
        }
      >
        <div className="shrink-0">
          <div className="grid grid-cols-2 gap-x-3 lg:grid-cols-5">
            <FormField label="Lot / Batch No.">
              {isClosedLocked ? (
                <FormInput readOnly value={lotNo} title={lotNo} />
              ) : (
                <FormDropdown
                  value={batchSelectValue}
                  options={batchDropdownOptions}
                  disabled={busy}
                  onChange={(next) => void onBatchSelectChange({ target: { value: next } })}
                />
              )}
            </FormField>
            <FormField label="Production Date">
              <FormInput
                required
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                disabled={busy}
              />
            </FormField>
            <FormField label="Wet Flour Yield">
              <FormattedNumberInput
                value={wetFlourYield}
                onChange={setWetFlourYield}
                fractionDigits={2}
                disabled={busy}
                className="win-form__control--num"
              />
            </FormField>
            <FormField label="Split %">
              <FormattedNumberInput
                value={splitPctInput}
                onChange={setSplitPctInput}
                fractionDigits={2}
                disabled={busy}
                className="win-form__control--num"
              />
            </FormField>
            <FormField label="Status">
              <FormSelect
                value={status}
                disabled={busy}
                onChange={(e) => void onStatusChange(e)}
              >
                <option value={STATUS_OPEN}>{STATUS_OPEN}</option>
                <option value={STATUS_CLOSED}>{STATUS_CLOSED}</option>
              </FormSelect>
            </FormField>
          </div>
        </div>

        <div className="win-form__table-wrap win-form__table-shell mt-3">
          <div className="win-form__table-scroll">
            <table className="win-form__table win-form__table--bordered win-form__table--odp w-full text-sm">
              {odpColGroup}
              <thead>
                <tr>
                  <th>Stock Item</th>
                  <th className="win-form__table-num">No of 50kg Bags</th>
                  <th className="win-form__table-num">In Quintal</th>
                  <th className="win-form__table-num">%</th>
                  <th className="win-form__table-num">Rate</th>
                  <th className="win-form__table-num">Value</th>
                </tr>
              </thead>
              <tbody>
              <tr>
                <td>
                  <span className="win-form__stock-item-cell">
                    Orid Raw Material (Input)
                    <button
                      type="button"
                      className="win-form__icon-button"
                      aria-label="Add Orid raw material"
                      onClick={() => void openRawPicker()}
                    >
                      <PlusIcon />
                    </button>
                  </span>
                </td>
                <td className="win-form__table-num" />
                <td className="win-form__table-num">
                  {rawPurchases.length
                    ? formatCommaNumber(rawTotals.quintal, 2)
                    : ''}
                </td>
                <td className="win-form__table-num">
                  {rawPurchases.length ? formatCommaNumber(100, 2) : ''}
                </td>
                <td className="win-form__table-num">
                  {rawTotals.rate != null ? (
                    <span className="win-form__table-readonly">{formatRate(rawTotals.rate)}</span>
                  ) : (
                    ''
                  )}
                </td>
                <td className="win-form__table-num">
                  {rawPurchases.length ? (
                    <span className="win-form__table-readonly">
                      {formatValue(rawTotals.totalValue)}
                    </span>
                  ) : (
                    ''
                  )}
                </td>
              </tr>

              <tr className="win-form__table-row--group">
                <td>
                  <span className="win-form__stock-item-cell">
                    <button
                      type="button"
                      className="win-form__row-toggle"
                      aria-expanded={dhallExpanded}
                      aria-label={
                        dhallExpanded
                          ? 'Collapse Orid Dhall details'
                          : 'Expand Orid Dhall details'
                      }
                      onClick={() => setDhallExpanded((open) => !open)}
                    >
                      Orid Dhall
                      <ChevronDownIcon
                        className={`win-form__row-toggle-icon${
                          dhallExpanded ? '' : ' win-form__row-toggle-icon--closed'
                        }`}
                      />
                    </button>
                  </span>
                </td>
                <td className="win-form__table-num">
                  {hasDhallInput ? (
                    <span className="win-form__table-readonly win-form__table-readonly--field">
                      {formatQty(oridDhallBags)}
                    </span>
                  ) : (
                    ''
                  )}
                </td>
                <td className="win-form__table-num">
                  {hasDhallInput ? (
                    <span className="win-form__table-readonly win-form__table-readonly--field">
                      {formatCommaNumber(oridDhallQuintal, 2)}
                    </span>
                  ) : (
                    ''
                  )}
                </td>
                <td className="win-form__table-num">
                  {oridDhallPct != null ? (
                    <span className="win-form__table-readonly win-form__table-readonly--field">
                      {formatCommaNumber(oridDhallPct, 2)}
                    </span>
                  ) : (
                    ''
                  )}
                </td>
                <td className="win-form__table-num">
                  {hasDhallInput && oridDhallRate != null ? (
                    <span className="win-form__table-readonly win-form__table-readonly--field">
                      {formatRate(oridDhallRate)}
                    </span>
                  ) : (
                    ''
                  )}
                </td>
                <td className="win-form__table-num">
                  {hasDhallInput ? (
                    <span className="win-form__table-readonly win-form__table-readonly--field">
                      {formatValue(oridDhallValue)}
                    </span>
                  ) : (
                    ''
                  )}
                </td>
              </tr>

              {dhallExpanded ? (
                <>
              <tr className="win-form__table-row--splash win-form__table-row--splash-1">
                <td>
                  <span className="win-form__stock-item-cell win-form__stock-item-cell--sub">
                    Opening
                  </span>
                </td>
                <td className="win-form__table-num">
                  <FormattedNumberInput
                    className="win-form__table-input"
                    inputMode="numeric"
                    fractionDigits={0}
                    value={openingBags}
                    onChange={setOpeningBags}
                  />
                </td>
                <td className="win-form__table-num">
                  {String(openingBags).trim() !== ''
                    ? formatCommaNumber(openingQuintal, 2)
                    : ''}
                </td>
                <td className="win-form__table-num" />
                <td className="win-form__table-num">
                  <FormattedNumberInput
                    className="win-form__table-input"
                    inputMode="decimal"
                    fractionDigits={2}
                    value={openingRate}
                    onChange={setOpeningRate}
                  />
                </td>
                <td className="win-form__table-num">
                  {String(openingBags).trim() !== '' && String(openingRate).trim() !== '' ? (
                    <span className="win-form__table-readonly">{formatValue(openingValue)}</span>
                  ) : (
                    ''
                  )}
                </td>
              </tr>

              <tr className="win-form__table-row--splash win-form__table-row--splash-2">
                <td>
                  <span className="win-form__stock-item-cell win-form__stock-item-cell--sub">
                    Average
                    <button
                      type="button"
                      className="win-form__icon-button"
                      aria-label="Add Orid Dhall average"
                      onClick={() => void openAvgPicker()}
                    >
                      <PlusIcon />
                    </button>
                  </span>
                </td>
                <td className="win-form__table-num">
                  {avgPurchases.length ? (
                    <span className="win-form__table-readonly">
                      {formatQty(avgTotals.totalQty)}
                    </span>
                  ) : (
                    ''
                  )}
                </td>
                <td className="win-form__table-num">
                  {avgPurchases.length
                    ? formatCommaNumber(avgTotals.quintal, 2)
                    : ''}
                </td>
                <td className="win-form__table-num" />
                <td className="win-form__table-num">
                  {avgTotals.rate != null ? (
                    <span className="win-form__table-readonly">{formatRate(avgTotals.rate)}</span>
                  ) : (
                    ''
                  )}
                </td>
                <td className="win-form__table-num">
                  {avgPurchases.length ? (
                    <span className="win-form__table-readonly">
                      {formatValue(avgTotals.totalValue)}
                    </span>
                  ) : (
                    ''
                  )}
                </td>
              </tr>

              <tr className="win-form__table-row--splash win-form__table-row--splash-3">
                <td>
                  <span className="win-form__stock-item-cell win-form__stock-item-cell--sub">
                    Previous Batch Average
                  </span>
                </td>
                <td className="win-form__table-num">
                  <FormattedNumberInput
                    className="win-form__table-input"
                    inputMode="numeric"
                    fractionDigits={0}
                    value={previousBatchBags}
                    onChange={setPreviousBatchBags}
                  />
                </td>
                <td className="win-form__table-num">
                  {String(previousBatchBags).trim() !== ''
                    ? formatCommaNumber(previousBatchQuintal, 2)
                    : ''}
                </td>
                <td className="win-form__table-num" />
                <td className="win-form__table-num">
                  <FormattedNumberInput
                    className="win-form__table-input"
                    inputMode="decimal"
                    fractionDigits={2}
                    value={previousBatchRate}
                    onChange={setPreviousBatchRate}
                  />
                </td>
                <td className="win-form__table-num">
                  {String(previousBatchBags).trim() !== '' &&
                  String(previousBatchRate).trim() !== '' ? (
                    <span className="win-form__table-readonly">
                      {formatValue(previousBatchValue)}
                    </span>
                  ) : (
                    ''
                  )}
                </td>
              </tr>

              <tr className="win-form__table-row--splash win-form__table-row--splash-4">
                <td>
                  <span className="win-form__stock-item-cell win-form__stock-item-cell--sub">
                    Delivery
                    <button
                      type="button"
                      className="win-form__icon-button"
                      aria-label="View delivery bags by date"
                      disabled={savedId == null || busy}
                      onClick={() => setDeliveryListOpen(true)}
                    >
                      <ListBulletIcon />
                    </button>
                  </span>
                </td>
                <td className="win-form__table-num">
                  {String(deliveryBags).trim() !== '' ? (
                    <span className="win-form__table-readonly win-form__table-readonly--field">
                      {formatQty(parseQty(deliveryBags))}
                    </span>
                  ) : (
                    ''
                  )}
                </td>
                <td className="win-form__table-num">
                  {String(deliveryBags).trim() !== ''
                    ? formatCommaNumber(deliveryQuintal, 2)
                    : ''}
                </td>
                <td className="win-form__table-num" />
                <td className="win-form__table-num">
                  {String(deliveryRate).trim() !== '' ? (
                    <span className="win-form__table-readonly">
                      {formatRate(parseQty(deliveryRate))}
                    </span>
                  ) : (
                    ''
                  )}
                </td>
                <td className="win-form__table-num">
                  {String(deliveryBags).trim() !== '' && String(deliveryRate).trim() !== '' ? (
                    <span className="win-form__table-readonly">{formatValue(deliveryValue)}</span>
                  ) : (
                    ''
                  )}
                </td>
              </tr>

              <tr className="win-form__table-row--splash win-form__table-row--splash-5">
                <td>
                  <span className="win-form__stock-item-cell win-form__stock-item-cell--sub">
                    Closing Stock
                  </span>
                </td>
                <td className="win-form__table-num">
                  <FormattedNumberInput
                    className="win-form__table-input"
                    inputMode="numeric"
                    fractionDigits={0}
                    value={closingBags}
                    onChange={setClosingBags}
                  />
                </td>
                <td className="win-form__table-num">
                  {String(closingBags).trim() !== ''
                    ? formatCommaNumber(closingQuintal, 2)
                    : ''}
                </td>
                <td className="win-form__table-num" />
                <td className="win-form__table-num">
                  <FormattedNumberInput
                    className="win-form__table-input"
                    inputMode="decimal"
                    fractionDigits={2}
                    value={closingRate}
                    onChange={setClosingRate}
                  />
                </td>
                <td className="win-form__table-num">
                  {String(closingBags).trim() !== '' && String(closingRate).trim() !== '' ? (
                    <span className="win-form__table-readonly">{formatValue(closingValue)}</span>
                  ) : (
                    ''
                  )}
                </td>
              </tr>
                </>
              ) : null}

              <tr className="win-form__table-row--group">
                <td>
                  <span className="win-form__stock-item-cell">Orid Dhall Split</span>
                </td>
                <td className="win-form__table-num">
                  <FormattedNumberInput
                    className="win-form__table-input"
                    inputMode="numeric"
                    fractionDigits={0}
                    value={splitBags}
                    onChange={setSplitBags}
                  />
                </td>
                <td className="win-form__table-num">
                  {hasSplit ? formatCommaNumber(splitQuintal, 2) : ''}
                </td>
                <td className="win-form__table-num">
                  {splitPct != null ? formatCommaNumber(splitPct, 2) : ''}
                </td>
                <td className="win-form__table-num">
                  <FormattedNumberInput
                    className="win-form__table-input"
                    inputMode="decimal"
                    fractionDigits={2}
                    value={splitRate}
                    onChange={setSplitRate}
                  />
                </td>
                <td className="win-form__table-num">
                  {hasSplit && String(splitRate).trim() !== '' ? (
                    <span className="win-form__table-readonly">{formatValue(splitValue)}</span>
                  ) : (
                    ''
                  )}
                </td>
              </tr>

              <tr className="win-form__table-row--group">
                <td>
                  <span className="win-form__stock-item-cell">
                    Orid Dhall Sortex Rejection
                  </span>
                </td>
                <td className="win-form__table-num">
                  <FormattedNumberInput
                    className="win-form__table-input"
                    inputMode="numeric"
                    fractionDigits={0}
                    value={sortexBags}
                    onChange={setSortexBags}
                  />
                </td>
                <td className="win-form__table-num">
                  {hasSortex ? formatCommaNumber(sortexQuintal, 2) : ''}
                </td>
                <td className="win-form__table-num">
                  {sortexPct != null ? formatCommaNumber(sortexPct, 2) : ''}
                </td>
                <td className="win-form__table-num">
                  <FormattedNumberInput
                    className="win-form__table-input"
                    inputMode="decimal"
                    fractionDigits={2}
                    value={sortexRate}
                    onChange={setSortexRate}
                  />
                </td>
                <td className="win-form__table-num">
                  {hasSortex && String(sortexRate).trim() !== '' ? (
                    <span className="win-form__table-readonly">{formatValue(sortexValue)}</span>
                  ) : (
                    ''
                  )}
                </td>
              </tr>

              <tr className="win-form__table-row--group">
                <td>
                  <span className="win-form__stock-item-cell">Orid Dhall Husk</span>
                </td>
                <td className="win-form__table-num">
                  <FormattedNumberInput
                    className="win-form__table-input"
                    inputMode="numeric"
                    fractionDigits={0}
                    value={huskBags}
                    onChange={setHuskBags}
                  />
                </td>
                <td className="win-form__table-num">
                  {hasHusk ? formatCommaNumber(huskQuintal, 2) : ''}
                </td>
                <td className="win-form__table-num">
                  {huskPct != null ? formatCommaNumber(huskPct, 2) : ''}
                </td>
                <td className="win-form__table-num">
                  <FormattedNumberInput
                    className="win-form__table-input"
                    inputMode="decimal"
                    fractionDigits={2}
                    value={huskRate}
                    onChange={setHuskRate}
                  />
                </td>
                <td className="win-form__table-num">
                  {hasHusk && String(huskRate).trim() !== '' ? (
                    <span className="win-form__table-readonly">{formatValue(huskValue)}</span>
                  ) : (
                    ''
                  )}
                </td>
              </tr>
              </tbody>
            </table>
          </div>
          <div className="win-form__table-foot">
            <table className="win-form__table win-form__table--odp w-full text-sm">
              {odpColGroup}
              <tbody>
                <tr>
                  <td>
                    <span className="win-form__table-total-label">Total</span>
                  </td>
                  <td className="win-form__table-num" />
                  <td className="win-form__table-num" />
                  <td className="win-form__table-num">
                    {showFooterTotals && footerPct !== 0 ? (
                      <span className="win-form__table-readonly">
                        {formatCommaNumber(footerPct, 2)}
                      </span>
                    ) : (
                      ''
                    )}
                  </td>
                  <td className="win-form__table-num" />
                  <td className="win-form__table-num">
                    {showFooterTotals ? (
                      <span className="win-form__table-readonly">
                        {formatValue(footerValue)}
                      </span>
                    ) : (
                      ''
                    )}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </PrimaryContentLayout>
    </div>
  )
}
