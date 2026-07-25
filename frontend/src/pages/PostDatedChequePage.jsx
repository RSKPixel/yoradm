import { useEffect, useMemo, useRef, useState } from 'react'
import {
  createPostDatedCheque,
  deletePostDatedCheque,
  fetchPostDatedCheque,
  updatePostDatedCheque,
} from '../api/postDatedCheque'
import { fetchPartyPendingBills, fetchReceivableParties } from '../api/tally'
import { ConfirmDeleteModal } from '../components/delivery-challan/ConfirmDeleteModal'
import { FormAutocomplete } from '../components/form/FormAutocomplete'
import { FormattedNumberInput } from '../components/form/FormattedNumberInput'
import { FormDropdown } from '../components/form/FormDropdown'
import { FormField, FormInput } from '../components/form/FormPanel'
import { useFormMessage } from '../components/form/FormMessage'
import { PostDatedChequeSearchModal } from '../components/post-dated-cheque/PostDatedChequeSearchModal'
import { PrimaryContentLayout } from '../components/layout/PrimaryContentLayout'
import { formatDate, todayIsoDate } from '../utils/formatDate'
import { formatValue } from '../utils/formatNumber'
import { getApiErrorMessage, validatePostDatedChequeForm } from '../utils/formValidation'

function parseNum(value) {
  const n = Number.parseFloat(String(value ?? '').replace(/,/g, ''))
  return Number.isFinite(n) ? n : null
}

/** Match all query words anywhere in text (order-independent).
 * Ignores punctuation so "bvk" matches "B.V.K". */
function matchesFullText(text, query) {
  const normalize = (value) =>
    String(value ?? '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()

  const compact = (value) => String(value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')

  const haystack = normalize(text)
  const haystackCompact = compact(text)
  const rawQuery = String(query ?? '').toLowerCase().trim()
  if (!rawQuery) return true

  const tokens = normalize(rawQuery).split(' ').filter(Boolean)
  if (tokens.every((token) => haystack.includes(token))) return true

  const queryCompact = compact(rawQuery)
  return Boolean(queryCompact) && haystackCompact.includes(queryCompact)
}

const CHEQUE_STATUS_OPTIONS = [
  { value: 'Postdated', label: 'Postdated' },
  { value: 'Cleared', label: 'Cleared' },
  { value: 'Returned', label: 'Returned' },
]

function emptyFormState() {
  const today = todayIsoDate()
  return {
    party: '',
    chequeNo: '',
    chequeDate: today,
    chequePresentDate: today,
    chequeAmount: '',
    status: 'Postdated',
  }
}

function toIsoDateOrEmpty(value) {
  if (!value) return ''
  return String(value).slice(0, 10)
}

function numToForm(value) {
  if (value == null || value === '') return ''
  return String(value)
}

function snapshotState(form, thisChequeAlloc) {
  return JSON.stringify({
    party: String(form.party ?? '').trim(),
    chequeNo: String(form.chequeNo ?? '').trim(),
    chequeDate: String(form.chequeDate ?? ''),
    chequePresentDate: String(form.chequePresentDate ?? ''),
    chequeAmount: String(form.chequeAmount ?? '').trim(),
    status: String(form.status ?? '').trim(),
    allocations: Object.fromEntries(
      Object.entries(thisChequeAlloc || {})
        .map(([id, amount]) => [String(id), String(amount ?? '').trim()])
        .filter(([, amount]) => amount)
        .sort(([a], [b]) => a.localeCompare(b)),
    ),
  })
}

function billBalance(row) {
  const amount = Number(row.amount)
  const received = Number(row.cheque_received)
  const bill = Number.isFinite(amount) ? amount : 0
  const got = Number.isFinite(received) ? received : 0
  return Math.max(0, bill - got)
}

function billDiff(row, thisChequeAmount) {
  const amount = Number(row.amount)
  const received = Number(row.cheque_received)
  const thisAmt = Number(thisChequeAmount)
  const bill = Number.isFinite(amount) ? amount : 0
  const got = Number.isFinite(received) ? received : 0
  const allocated = Number.isFinite(thisAmt) ? thisAmt : 0
  return bill - (got + allocated)
}

function formatDiffPct(diff, amount) {
  const bill = Number(amount)
  if (!Number.isFinite(bill) || bill === 0) return '—'
  const pct = (Number(diff) / bill) * 100
  if (!Number.isFinite(pct)) return '—'
  return `${formatValue(pct)}%`
}

const PENDING_COLGROUP = (
  <colgroup>
    <col className="pdc-pending__col-invoice" />
    <col className="pdc-pending__col-date" />
    <col className="pdc-pending__col-amount" />
    <col className="pdc-pending__col-received" />
    <col className="pdc-pending__col-this" />
    <col className="pdc-pending__col-diff" />
    <col className="pdc-pending__col-diff-pct" />
  </colgroup>
)

const PENDING_HEADER_CELLS = (
  <>
    <th>Invoice No.</th>
    <th className="pdc-pending__date">Invoice Date</th>
    <th className="win-form__table-num">Amount</th>
    <th className="win-form__table-num">Cheque received</th>
    <th className="win-form__table-num">This cheque</th>
    <th className="win-form__table-num">Diff</th>
    <th className="win-form__table-num">Diff %</th>
  </>
)

export function PostDatedChequePage() {
  const { showErrors, showSuccess, showError } = useFormMessage()

  const [parties, setParties] = useState([])
  const [loadingLookups, setLoadingLookups] = useState(true)
  const [pendingBills, setPendingBills] = useState([])
  const [loadingBills, setLoadingBills] = useState(false)
  const [selectedBillIds, setSelectedBillIds] = useState(() => new Set())
  const [thisChequeAlloc, setThisChequeAlloc] = useState({})
  const [billsReloadToken, setBillsReloadToken] = useState(0)
  const restoreAllocationsRef = useRef(null)
  const snapshotFormRef = useRef(null)

  const [form, setForm] = useState(emptyFormState)
  const [savedSnapshot, setSavedSnapshot] = useState(() => snapshotState(emptyFormState(), {}))
  const [savedChequeId, setSavedChequeId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [loadingCheque, setLoadingCheque] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)

  const isModifyMode = savedChequeId != null
  const chequeIdLabel = savedChequeId != null ? String(savedChequeId) : ''
  const isDirty = useMemo(
    () => snapshotState(form, thisChequeAlloc) !== savedSnapshot,
    [form, thisChequeAlloc, savedSnapshot],
  )

  const partyOptions = useMemo(() => {
    const list = [...parties]
    const current = form.party.trim()
    if (current && !list.some((row) => row.ledger_name === current)) {
      list.unshift({ ledger_name: current, primary_group: null })
    }
    return list
  }, [parties, form.party])

  const pendingTotal = useMemo(
    () =>
      pendingBills.reduce((sum, row) => {
        const amount = Number(row.amount)
        return Number.isFinite(amount) ? sum + amount : sum
      }, 0),
    [pendingBills],
  )

  const chequeReceivedTotal = useMemo(
    () =>
      pendingBills.reduce((sum, row) => {
        const amount = Number(row.cheque_received)
        return Number.isFinite(amount) ? sum + amount : sum
      }, 0),
    [pendingBills],
  )

  const thisChequeTotal = useMemo(
    () =>
      [...selectedBillIds].reduce((sum, id) => {
        const amount = parseNum(thisChequeAlloc[id])
        return amount != null ? sum + amount : sum
      }, 0),
    [selectedBillIds, thisChequeAlloc],
  )

  const diffTotal = useMemo(
    () => pendingTotal - chequeReceivedTotal - thisChequeTotal,
    [pendingTotal, chequeReceivedTotal, thisChequeTotal],
  )

  const chequeAmountNum = parseNum(form.chequeAmount)
  const allocationMatchesCheque =
    chequeAmountNum != null &&
    chequeAmountNum > 0 &&
    Math.abs(thisChequeTotal - chequeAmountNum) < 0.005

  useEffect(() => {
    let cancelled = false

    async function loadLookups() {
      setLoadingLookups(true)
      try {
        const data = await fetchReceivableParties()
        if (!cancelled) setParties(Array.isArray(data) ? data : [])
      } catch (error) {
        if (!cancelled) {
          setParties([])
          showError(getApiErrorMessage(error, 'Could not load parties'))
        }
      } finally {
        if (!cancelled) setLoadingLookups(false)
      }
    }

    void loadLookups()
    return () => {
      cancelled = true
    }
  }, [showError])

  useEffect(() => {
    const party = form.party.trim()
    if (!party) {
      setPendingBills([])
      setSelectedBillIds(new Set())
      setThisChequeAlloc({})
      setLoadingBills(false)
      return undefined
    }

    let cancelled = false
    const timer = window.setTimeout(() => {
      setLoadingBills(true)
      void fetchPartyPendingBills(party, { excludeChequeId: savedChequeId })
        .then((data) => {
          if (cancelled) return
          const bills = Array.isArray(data) ? data : []
          setPendingBills(bills)

          const pendingRestore = restoreAllocationsRef.current
          restoreAllocationsRef.current = null
          if (pendingRestore) {
            const nextIds = new Set()
            const nextAlloc = {}
            for (const item of pendingRestore) {
              const bill = bills.find(
                (row) =>
                  (item.receivable_id != null && row.id === item.receivable_id) ||
                  ((item.invoice_no || '').trim() &&
                    (row.invoice_no || '').trim() === String(item.invoice_no).trim()),
              )
              if (!bill) continue
              nextIds.add(bill.id)
              nextAlloc[bill.id] = numToForm(item.allocated_amount)
            }
            setSelectedBillIds(nextIds)
            setThisChequeAlloc(nextAlloc)
            if (snapshotFormRef.current) {
              setSavedSnapshot(snapshotState(snapshotFormRef.current, nextAlloc))
              snapshotFormRef.current = null
            }
          } else if (!savedChequeId) {
            setSelectedBillIds(new Set())
            setThisChequeAlloc({})
          }
        })
        .catch(() => {
          if (!cancelled) {
            setPendingBills([])
            setSelectedBillIds(new Set())
            setThisChequeAlloc({})
          }
        })
        .finally(() => {
          if (!cancelled) setLoadingBills(false)
        })
    }, 200)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [form.party, savedChequeId, billsReloadToken])

  function setField(key, value) {
    setForm((prev) => {
      if (key === 'chequeDate') {
        return { ...prev, chequeDate: value, chequePresentDate: value }
      }
      return { ...prev, [key]: value }
    })
  }

  function toggleBillSelection(billId) {
    const next = new Set(selectedBillIds)
    const nextAlloc = { ...thisChequeAlloc }
    if (next.has(billId)) {
      next.delete(billId)
      delete nextAlloc[billId]
    } else {
      next.add(billId)
      const bill = pendingBills.find((row) => row.id === billId)
      const balance = bill ? billBalance(bill) : 0
      nextAlloc[billId] = balance > 0 ? numToForm(balance) : ''
    }
    setSelectedBillIds(next)
    setThisChequeAlloc(nextAlloc)
  }

  function setBillAllocation(billId, value) {
    setThisChequeAlloc((prev) => ({ ...prev, [billId]: value }))
    setSelectedBillIds((prev) => {
      const next = new Set(prev)
      if (String(value ?? '').trim()) next.add(billId)
      else next.delete(billId)
      return next
    })
  }

  function resetForm() {
    setSavedChequeId(null)
    restoreAllocationsRef.current = null
    const next = emptyFormState()
    setForm(next)
    setThisChequeAlloc({})
    setSelectedBillIds(new Set())
    setPendingBills([])
    setSavedSnapshot(snapshotState(next, {}))
  }

  function onFormKeyDown(event) {
    if (event.key === 'Enter') {
      event.preventDefault()
    }
  }

  function buildAllocationsPayload() {
    const items = []
    for (const billId of selectedBillIds) {
      const bill = pendingBills.find((row) => row.id === billId)
      if (!bill) continue
      const amount = parseNum(thisChequeAlloc[billId])
      if (amount == null || amount <= 0) continue
      items.push({
        receivable_id: bill.id,
        invoice_no: (bill.invoice_no || '').trim() || String(bill.id),
        allocated_amount: amount,
      })
    }
    return items
  }

  async function onSave(event) {
    event.preventDefault()
    const errors = validatePostDatedChequeForm(form)
    const allocations = buildAllocationsPayload()
    for (const billId of selectedBillIds) {
      const amount = parseNum(thisChequeAlloc[billId])
      if (amount == null || amount <= 0) {
        errors.push('Enter a positive This cheque amount for each selected bill.')
        break
      }
    }
    const chequeAmount = parseNum(form.chequeAmount)
    if (!allocations.length) {
      errors.push('Allocate this cheque to at least one bill.')
    } else if (
      chequeAmount != null &&
      Math.abs(thisChequeTotal - chequeAmount) >= 0.005
    ) {
      errors.push(
        `This cheque total (${formatValue(thisChequeTotal)}) must match cheque amount (${formatValue(chequeAmount)}).`,
      )
    }
    if (errors.length) {
      showErrors(errors)
      return
    }

    const payload = {
      party: form.party.trim(),
      cheque_no: form.chequeNo.trim(),
      cheque_date: form.chequeDate,
      cheque_present_date: form.chequePresentDate || null,
      cheque_amount: parseNum(form.chequeAmount),
      status: form.status,
      allocations,
    }

    setSaving(true)
    try {
      const saved = isModifyMode
        ? await updatePostDatedCheque(savedChequeId, payload)
        : await createPostDatedCheque(payload)
      const next = {
        party: saved.party || '',
        chequeNo: saved.cheque_no || '',
        chequeDate: toIsoDateOrEmpty(saved.cheque_date),
        chequePresentDate: toIsoDateOrEmpty(saved.cheque_present_date),
        chequeAmount: numToForm(saved.cheque_amount),
        status: saved.status || 'Postdated',
      }
      restoreAllocationsRef.current = saved.allocations || []
      snapshotFormRef.current = next
      setForm(next)
      setSavedChequeId(saved.id)
      setBillsReloadToken((token) => token + 1)
      showSuccess(isModifyMode ? 'Post dated cheque updated.' : 'Post dated cheque saved.')
    } catch (error) {
      showError(getApiErrorMessage(error, 'Could not save post dated cheque'))
    } finally {
      setSaving(false)
    }
  }

  async function onSelectCheque(id) {
    setSearchOpen(false)
    setLoadingCheque(true)
    try {
      const saved = await fetchPostDatedCheque(id)
      const next = {
        party: saved.party || '',
        chequeNo: saved.cheque_no || '',
        chequeDate: toIsoDateOrEmpty(saved.cheque_date),
        chequePresentDate: toIsoDateOrEmpty(saved.cheque_present_date),
        chequeAmount: numToForm(saved.cheque_amount),
        status: saved.status || 'Postdated',
      }
      restoreAllocationsRef.current = saved.allocations || []
      snapshotFormRef.current = next
      setForm(next)
      setSavedChequeId(saved.id)
      setBillsReloadToken((token) => token + 1)
    } catch (error) {
      showError(getApiErrorMessage(error, 'Could not load post dated cheque'))
    } finally {
      setLoadingCheque(false)
    }
  }

  function onDelete() {
    if (!isModifyMode) return
    setDeleteConfirmOpen(true)
  }

  async function confirmDelete() {
    if (!isModifyMode) return
    setDeleting(true)
    try {
      await deletePostDatedCheque(savedChequeId)
      setDeleteConfirmOpen(false)
      resetForm()
      showSuccess('Post dated cheque deleted.')
    } catch (error) {
      showError(getApiErrorMessage(error, 'Could not delete post dated cheque'))
    } finally {
      setDeleting(false)
    }
  }

  const busy = saving || deleting || loadingCheque
  const colSpan = 7

  return (
    <div className="pdc-page flex h-full min-h-0 max-w-full flex-col overflow-hidden">
      {searchOpen ? (
        <PostDatedChequeSearchModal
          onClose={() => setSearchOpen(false)}
          onSelect={(id) => void onSelectCheque(id)}
          onStatusChange={(id, status) => {
            if (savedChequeId !== id) return
            setForm((prev) => ({ ...prev, status }))
            setSavedSnapshot((oldSnap) => {
              try {
                const parsed = JSON.parse(oldSnap)
                return JSON.stringify({ ...parsed, status })
              } catch {
                return oldSnap
              }
            })
          }}
        />
      ) : null}
      {deleteConfirmOpen ? (
        <ConfirmDeleteModal
          title="Delete post dated cheque"
          message="Delete this post dated cheque permanently? This cannot be undone."
          confirming={deleting}
          onCancel={() => {
            if (!deleting) setDeleteConfirmOpen(false)
          }}
          onConfirm={() => void confirmDelete()}
        />
      ) : null}

      <PrimaryContentLayout
        className="pdc-page__layout"
        title={
          isModifyMode
            ? `Post Dated Cheque — ${chequeIdLabel}`
            : 'Post Dated Cheque — New'
        }
        breadcrumb={[
          { label: 'Transactions' },
          {
            label: isModifyMode
              ? `Post Dated Cheque — ${chequeIdLabel}`
              : 'Post Dated Cheque — New',
          },
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
            <span className="win-form__footer-divider" aria-hidden="true" />
            <button
              type="button"
              className="win-form__button win-form__button--danger"
              onClick={() => void onDelete()}
              disabled={!isModifyMode || busy}
            >
              Delete
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
              disabled={busy || (isModifyMode && !isDirty)}
            >
              {saving ? 'Saving…' : isModifyMode ? 'Update' : 'Save'}
            </button>
          </>
        }
      >
        <div className="pdc-page__body">
          <div className="pdc-page__form">
            <div className="pdc-page__fields grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5">
              <FormField label="Party" className="sm:col-span-2 lg:col-span-5">
                <FormAutocomplete
                  options={partyOptions}
                  value={form.party}
                  onChange={(value) => setField('party', value)}
                  getOptionValue={(row) => row.ledger_name}
                  getOptionLabel={(row) => row.ledger_name}
                  filterOption={(row, query) => matchesFullText(row.ledger_name, query)}
                  openOnFocus={false}
                  disabled={loadingLookups || busy}
                  emptyMessage="No receivable parties"
                />
              </FormField>
              <FormField label="Cheque No.">
                <FormInput
                  required
                  value={form.chequeNo}
                  onChange={(e) => setField('chequeNo', e.target.value)}
                  disabled={busy}
                />
              </FormField>
              <FormField label="Cheque Amount">
                <FormattedNumberInput
                  required
                  value={form.chequeAmount}
                  onChange={(value) => setField('chequeAmount', value)}
                  fractionDigits={2}
                  disabled={busy}
                />
              </FormField>
              <FormField label="Cheque Date">
                <FormInput
                  required
                  type="date"
                  value={form.chequeDate}
                  onChange={(e) => setField('chequeDate', e.target.value)}
                  disabled={busy}
                />
              </FormField>
              <FormField label="Cheque Present Date">
                <FormInput
                  type="date"
                  value={form.chequePresentDate}
                  onChange={(e) => setField('chequePresentDate', e.target.value)}
                  disabled={busy}
                />
              </FormField>
              <FormField label="Status">
                <FormDropdown
                  options={CHEQUE_STATUS_OPTIONS}
                  value={form.status}
                  onChange={(status) => setField('status', status)}
                  disabled={busy}
                  placeholder="Status"
                />
              </FormField>
            </div>
          </div>

          <section className="pdc-pending">
            <div className="pdc-pending__header">
              <h2 className="pdc-pending__title">Pending bills</h2>
              <p className="pdc-pending__meta">
                {!form.party.trim()
                  ? 'Select a party'
                  : loadingBills
                    ? 'Loading…'
                    : selectedBillIds.size > 0
                      ? `${selectedBillIds.size} linked · This cheque total must match cheque amount`
                      : `${pendingBills.length} bill${pendingBills.length === 1 ? '' : 's'} · enter This cheque or click to allocate`}
              </p>
            </div>
            <div className="pdc-pending__table-shell">
              <div className="pdc-pending__table-head">
                <table className="win-form__table win-form__table--bordered pdc-pending__table">
                  {PENDING_COLGROUP}
                  <thead>
                    <tr>{PENDING_HEADER_CELLS}</tr>
                  </thead>
                </table>
              </div>
              <div className="pdc-pending__table-scroll">
                <table className="win-form__table win-form__table--bordered pdc-pending__table">
                  {PENDING_COLGROUP}
                  <thead aria-hidden="true" className="pdc-pending__table-spacer">
                    <tr>{PENDING_HEADER_CELLS}</tr>
                  </thead>
                  <tbody>
                    {!form.party.trim() ? (
                      <tr>
                        <td colSpan={colSpan} className="win-form__table-empty">
                          Select a party to view pending bills.
                        </td>
                      </tr>
                    ) : loadingBills ? (
                      <tr>
                        <td colSpan={colSpan} className="win-form__table-empty">
                          Loading…
                        </td>
                      </tr>
                    ) : pendingBills.length === 0 ? (
                      <tr>
                        <td colSpan={colSpan} className="win-form__table-empty">
                          No pending bills for this party.
                        </td>
                      </tr>
                    ) : (
                      pendingBills.map((row) => {
                        const selected = selectedBillIds.has(row.id)
                        const received = Number(row.cheque_received)
                        const thisAmt = parseNum(thisChequeAlloc[row.id]) ?? 0
                        const diff = billDiff(row, thisAmt)
                        return (
                          <tr
                            key={row.id}
                            className={`pdc-pending__row${selected ? ' is-selected' : ''}`}
                            onClick={() => toggleBillSelection(row.id)}
                          >
                            <td>{row.invoice_no || '—'}</td>
                            <td className="pdc-pending__date">
                              {row.invoice_date ? formatDate(row.invoice_date) : '—'}
                            </td>
                            <td className="win-form__table-num">
                              {row.amount != null && Number.isFinite(Number(row.amount))
                                ? formatValue(row.amount)
                                : '—'}
                            </td>
                            <td className="win-form__table-num">
                              {Number.isFinite(received) && received > 0
                                ? formatValue(received)
                                : '—'}
                            </td>
                            <td
                              className="win-form__table-num pdc-pending__this-cell"
                              onMouseDown={(event) => event.stopPropagation()}
                              onClick={(event) => event.stopPropagation()}
                            >
                              <FormattedNumberInput
                                value={thisChequeAlloc[row.id] ?? ''}
                                onChange={(value) => setBillAllocation(row.id, value)}
                                fractionDigits={2}
                                disabled={busy}
                                selectOnFocus
                              />
                            </td>
                            <td className="win-form__table-num">
                              {formatValue(diff)}
                            </td>
                            <td className="win-form__table-num">
                              {formatDiffPct(diff, row.amount)}
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
              <div className="pdc-pending__table-foot">
                <table className="win-form__table win-form__table--bordered pdc-pending__table">
                  {PENDING_COLGROUP}
                  <thead aria-hidden="true" className="pdc-pending__table-spacer">
                    <tr>{PENDING_HEADER_CELLS}</tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td colSpan={2} className="pdc-pending__total-label">
                        <span className="win-form__table-total-label">Total</span>
                      </td>
                      <td className="win-form__table-num">
                        {form.party.trim() && !loadingBills && pendingBills.length > 0
                          ? formatValue(pendingTotal)
                          : '—'}
                      </td>
                      <td className="win-form__table-num">
                        {form.party.trim() && !loadingBills && pendingBills.length > 0
                          ? formatValue(chequeReceivedTotal)
                          : '—'}
                      </td>
                      <td
                        className={`win-form__table-num${
                          selectedBillIds.size > 0 &&
                          chequeAmountNum != null &&
                          chequeAmountNum > 0
                            ? allocationMatchesCheque
                              ? ' pdc-pending__alloc-ok'
                              : ' pdc-pending__alloc-mismatch'
                            : ''
                        }`}
                      >
                        {selectedBillIds.size > 0 ? formatValue(thisChequeTotal) : '—'}
                      </td>
                      <td className="win-form__table-num">
                        {form.party.trim() && !loadingBills && pendingBills.length > 0
                          ? formatValue(diffTotal)
                          : '—'}
                      </td>
                      <td className="win-form__table-num">
                        {form.party.trim() && !loadingBills && pendingBills.length > 0
                          ? formatDiffPct(diffTotal, pendingTotal)
                          : '—'}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </div>
      </PrimaryContentLayout>
    </div>
  )
}
