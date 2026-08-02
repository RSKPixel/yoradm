import { useEffect, useState } from 'react'
import { fetchCompany, updateGeneralSettings } from '../../api/company'
import { updateCollectionPerformance } from '../../api/tally'
import { useAuth } from '../../auth/AuthContext'
import { getApiErrorMessage } from '../../utils/formValidation'
import { FormattedNumberInput } from '../form/FormattedNumberInput'
import { FormPanel } from '../form/FormPanel'
import { useFormMessage } from '../form/FormMessage'

function parseOptionalNumber(value) {
  const trimmed = String(value ?? '').trim().replace(/,/g, '')
  if (!trimmed) return null
  const n = Number.parseFloat(trimmed)
  return Number.isFinite(n) ? n : null
}

export function GeneralTab() {
  const { isAdmin } = useAuth()
  const { showError, showErrors, showSuccess } = useFormMessage()
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [brokerageTdsPct, setBrokerageTdsPct] = useState('')

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      try {
        const company = await fetchCompany()
        if (cancelled) return
        setBrokerageTdsPct(
          company?.brokerage_tds_pct == null || company?.brokerage_tds_pct === ''
            ? ''
            : String(company.brokerage_tds_pct),
        )
      } catch (error) {
        if (!cancelled) {
          showError(getApiErrorMessage(error, 'Could not load general settings'))
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [])

  async function onUpdateCollection() {
    if (!isAdmin || busy) return
    setBusy(true)
    try {
      await updateCollectionPerformance()
      showSuccess('Collection performance updated')
    } catch (error) {
      showError(getApiErrorMessage(error, 'Could not update collection performance'))
    } finally {
      setBusy(false)
    }
  }

  async function onSave(e) {
    e.preventDefault()
    if (!isAdmin || saving) return

    const pct = parseOptionalNumber(brokerageTdsPct)
    if (brokerageTdsPct.trim() && (pct == null || pct < 0 || pct > 100)) {
      showErrors(['Brokerage TDS % must be between 0 and 100.'])
      return
    }

    setSaving(true)
    try {
      const saved = await updateGeneralSettings({
        brokerage_tds_pct: pct,
      })
      setBrokerageTdsPct(
        saved?.brokerage_tds_pct == null || saved?.brokerage_tds_pct === ''
          ? ''
          : String(saved.brokerage_tds_pct),
      )
      showSuccess('General settings updated')
    } catch (error) {
      showError(getApiErrorMessage(error, 'Could not update general settings'))
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <p className="text-sm text-(--muted)">Loading general settings…</p>
  }

  return (
    <FormPanel
      wide
      onSubmit={isAdmin ? onSave : undefined}
      footer={
        isAdmin ? (
          <button
            type="submit"
            className="win-form__button win-form__button--primary"
            disabled={saving}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        ) : null
      }
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="text-sm text-(--ink)">Party Collection performance</span>
        {isAdmin ? (
          <button
            type="button"
            className="win-form__button"
            disabled={busy || saving}
            onClick={() => void onUpdateCollection()}
          >
            {busy ? 'Updating…' : 'Update'}
          </button>
        ) : null}
      </div>

      <label className="flex items-center justify-between gap-3">
        <span className="shrink-0 text-sm text-(--ink)">Brokerage TDS %</span>
        <span className="inline-block w-28">
          <FormattedNumberInput
            value={brokerageTdsPct}
            fractionDigits={2}
            selectOnFocus
            disabled={!isAdmin || saving}
            inputMode="decimal"
            onChange={setBrokerageTdsPct}
          />
        </span>
      </label>
      {!isAdmin ? (
        <p className="mt-2 text-xs text-(--muted)">Only admins can change general settings.</p>
      ) : null}
    </FormPanel>
  )
}
