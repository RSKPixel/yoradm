import { useEffect, useMemo, useState } from 'react'
import {
  fetchCollectionAnalysis,
  fetchReceivableRepresentatives,
} from '../api/tally'
import { CollectionPartyBillsModal } from '../components/collection-analysis/CollectionPartyBillsModal'
import { FormField, FormSelect } from '../components/form/FormPanel'
import { useFormMessage } from '../components/form/FormMessage'
import { PrimaryContentLayout } from '../components/layout/PrimaryContentLayout'
import { formatCommaNumber, formatValue } from '../utils/formatNumber'
import { getApiErrorMessage } from '../utils/formValidation'

const COL_COUNT = 4
const REP_BLANK = '__blank__'

const DUE_PERIODS = [
  { value: 'this_week', label: 'This Week' },
  { value: 'next_week', label: 'Next Week' },
  { value: 'this_month', label: 'This Month' },
]

const PERIOD_EMPTY = {
  this_week: 'No receivables due this week.',
  next_week: 'No receivables due next week.',
  this_month: 'No receivables due this month.',
}

const PERIOD_MODAL = {
  this_week: 'This week',
  next_week: 'Next week',
  this_month: 'This month',
}

function repLabel(name) {
  if (!name || name === REP_BLANK) return '(Blank)'
  return name
}

function formatAvgDays(value) {
  const num = Number(value)
  if (!Number.isFinite(num)) return '—'
  return formatCommaNumber(num, 1)
}

function groupLinesByParty(lines) {
  const map = new Map()
  for (const line of lines) {
    const key = line.ledger_name || '(No party)'
    let group = map.get(key)
    if (!group) {
      group = {
        ledgerName: key,
        lines: [],
        dueLines: [],
        overdueLines: [],
        dueTotal: 0,
        overdueTotal: 0,
        avgDays: Number(line.avg_days) || 0,
      }
      map.set(key, group)
    }
    group.lines.push(line)
    const amount = Number(line.amount) || 0
    if (line.status === 'due') {
      group.dueLines.push(line)
      group.dueTotal += amount
    } else if (line.status === 'overdue') {
      group.overdueLines.push(line)
      group.overdueTotal += amount
    }
  }
  return Array.from(map.values())
    .filter((group) => group.dueLines.length > 0 || group.overdueLines.length > 0)
    .map((group) => ({
      ...group,
      listCount: group.dueLines.length + group.overdueLines.length,
      listTotal: group.dueTotal + group.overdueTotal,
    }))
    .sort((a, b) => b.listTotal - a.listTotal)
}

export function CollectionAnalysisPage() {
  const { showError } = useFormMessage()
  const [representative, setRepresentative] = useState('')
  const [period, setPeriod] = useState('this_week')
  const [reps, setReps] = useState([])
  const [analysis, setAnalysis] = useState(null)
  const [loading, setLoading] = useState(true)
  const [selectedParty, setSelectedParty] = useState(null)

  useEffect(() => {
    let cancelled = false
    void fetchReceivableRepresentatives()
      .then((data) => {
        if (!cancelled) setReps(Array.isArray(data) ? data : [])
      })
      .catch(() => {
        if (!cancelled) setReps([])
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void fetchCollectionAnalysis({
      period,
      representative: representative || undefined,
    })
      .then((data) => {
        if (!cancelled) {
          setAnalysis(data)
          setSelectedParty(null)
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setAnalysis(null)
          showError(getApiErrorMessage(err, 'Unable to load collection analysis'))
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [period, representative, showError])

  const lines = analysis?.lines ?? []
  const partyGroups = useMemo(() => groupLinesByParty(lines), [lines])
  const listTotals = useMemo(
    () =>
      partyGroups.reduce(
        (acc, group) => {
          acc.parties += 1
          acc.invoices += group.listCount
          acc.amount += group.listTotal
          return acc
        },
        { parties: 0, invoices: 0, amount: 0 },
      ),
    [partyGroups],
  )
  const showFooter = !loading && partyGroups.length > 0
  const activePeriod = analysis?.period || period

  return (
    <PrimaryContentLayout
      breadcrumb={[{ label: 'Reports' }, { label: 'Collection Analysis' }]}
      title="Collection Analysis"
    >
      <div className="recv-toolbar shrink-0">
        <div className="grid min-w-0 flex-1 grid-cols-2 gap-x-3 lg:grid-cols-5">
          <FormField label="Representative">
            <FormSelect
              value={representative}
              onChange={(e) => setRepresentative(e.target.value)}
              disabled={loading}
            >
              <option value="">All representatives</option>
              {reps.map((rep) => (
                <option key={rep.name} value={rep.name}>
                  {repLabel(rep.name)}
                </option>
              ))}
            </FormSelect>
          </FormField>
          <FormField label="Due">
            <FormSelect
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              disabled={loading}
            >
              {DUE_PERIODS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </FormSelect>
          </FormField>
        </div>
      </div>

      <div className="win-form__table-wrap win-form__table-shell mt-1">
        <div className="win-form__table-scroll">
          <table className="win-form__table win-form__table--bordered collection-analysis__table w-full text-sm">
            <colgroup>
              <col />
              <col className="w-[6rem]" />
              <col className="w-[6rem]" />
              <col className="w-[9rem]" />
            </colgroup>
            <thead>
              <tr>
                <th>Party</th>
                <th className="win-form__table-num">Invoices</th>
                <th className="win-form__table-num">Avg days</th>
                <th className="win-form__table-num">Amount</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={COL_COUNT} className="win-form__table-empty">
                    Loading…
                  </td>
                </tr>
              ) : null}
              {!loading && analysis?.performance_count === 0 ? (
                <tr>
                  <td colSpan={COL_COUNT} className="win-form__table-empty">
                    No party performance yet. Update it in Settings → General first.
                  </td>
                </tr>
              ) : null}
              {!loading && analysis?.performance_count > 0 && partyGroups.length === 0 ? (
                <tr>
                  <td colSpan={COL_COUNT} className="win-form__table-empty">
                    {PERIOD_EMPTY[activePeriod] || PERIOD_EMPTY.this_week}
                  </td>
                </tr>
              ) : null}
              {partyGroups.map((group) => (
                <tr
                  key={group.ledgerName}
                  className="collection-analysis__summary"
                  onClick={() => setSelectedParty(group)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      setSelectedParty(group)
                    }
                  }}
                  tabIndex={0}
                  role="button"
                >
                  <td>
                    <span className="recv-party-head__name">{group.ledgerName}</span>
                  </td>
                  <td className="win-form__table-num">
                    <span className="win-form__table-readonly">
                      {formatCommaNumber(group.listCount, 0)}
                    </span>
                  </td>
                  <td className="win-form__table-num">
                    <span className="win-form__table-readonly">
                      {formatAvgDays(group.avgDays)}
                    </span>
                  </td>
                  <td className="win-form__table-num">
                    <span className="win-form__table-readonly">
                      {formatValue(group.listTotal)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {showFooter ? (
          <div className="win-form__table-foot collection-analysis__table-foot">
            <table className="win-form__table win-form__table--bordered collection-analysis__table w-full text-sm">
              <colgroup>
                <col />
                <col className="w-[6rem]" />
                <col className="w-[6rem]" />
                <col className="w-[9rem]" />
              </colgroup>
              <tbody>
                <tr>
                  <td>
                    <span className="win-form__table-total-label">
                      Total ({formatCommaNumber(listTotals.parties, 0)} parties ·{' '}
                      {formatCommaNumber(listTotals.invoices, 0)} invoices)
                    </span>
                  </td>
                  <td className="win-form__table-num" />
                  <td className="win-form__table-num" />
                  <td className="win-form__table-num">
                    <span className="win-form__table-readonly">
                      {formatValue(listTotals.amount)}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        ) : null}
      </div>

      {selectedParty ? (
        <CollectionPartyBillsModal
          partyName={selectedParty.ledgerName}
          lines={selectedParty.lines}
          periodLabel={PERIOD_MODAL[activePeriod] || PERIOD_MODAL.this_week}
          weekFrom={analysis?.week_from}
          weekTo={analysis?.week_to}
          onClose={() => setSelectedParty(null)}
        />
      ) : null}
    </PrimaryContentLayout>
  )
}
