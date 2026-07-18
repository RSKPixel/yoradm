import { useEffect, useState } from 'react'
import { fetchCompany, updateGeneralSettings } from '../../api/company'
import { useAuth } from '../../auth/AuthContext'
import { getApiErrorMessage } from '../../utils/formValidation'
import { FormattedNumberInput } from '../form/FormattedNumberInput'
import { FormField, FormPanel } from '../form/FormPanel'
import { useFormMessage } from '../form/FormMessage'

const EMPTY_FORM = {
  tds_purchase_pct: '',
  tds_threshold: '',
}

function toFormState(company) {
  return {
    tds_purchase_pct:
      company?.tds_purchase_pct == null || company?.tds_purchase_pct === ''
        ? ''
        : String(company.tds_purchase_pct),
    tds_threshold:
      company?.tds_threshold == null || company?.tds_threshold === ''
        ? ''
        : String(company.tds_threshold),
  }
}

function parseOptionalNumber(value) {
  const trimmed = String(value ?? '').trim().replace(/,/g, '')
  if (!trimmed) return null
  const n = Number.parseFloat(trimmed)
  return Number.isFinite(n) ? n : null
}

export function TdsTab() {
  const { isAdmin } = useAuth()
  const { showError, showErrors, showSuccess } = useFormMessage()
  const [form, setForm] = useState(EMPTY_FORM)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      try {
        const company = await fetchCompany()
        if (!cancelled) setForm(toFormState(company))
      } catch (error) {
        if (!cancelled) {
          showError(getApiErrorMessage(error, 'Could not load TDS settings'))
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

  async function onSave(e) {
    e.preventDefault()
    if (!isAdmin) return

    const pct = parseOptionalNumber(form.tds_purchase_pct)
    const threshold = parseOptionalNumber(form.tds_threshold)
    const errors = []
    if (form.tds_purchase_pct.trim() && (pct == null || pct < 0 || pct > 100)) {
      errors.push('TDS on purchase % must be between 0 and 100.')
    }
    if (form.tds_threshold.trim() && (threshold == null || threshold < 0)) {
      errors.push('TDS threshold must be a non-negative number.')
    }
    if (errors.length) {
      showErrors(errors)
      return
    }

    setSaving(true)
    try {
      const saved = await updateGeneralSettings({
        tds_purchase_pct: pct,
        tds_threshold: threshold,
      })
      setForm(toFormState(saved))
      showSuccess('TDS settings updated')
    } catch (error) {
      showError(getApiErrorMessage(error, 'Could not update TDS settings'))
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <p className="text-sm text-(--muted)">Loading TDS settings…</p>
  }

  return (
    <FormPanel
      title="TDS"
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
      <div className="grid grid-cols-1 gap-x-3 gap-y-2 sm:grid-cols-2">
        <FormField label="TDS on purchase %">
          <FormattedNumberInput
            value={form.tds_purchase_pct}
            onChange={(value) => setForm((prev) => ({ ...prev, tds_purchase_pct: value }))}
            fractionDigits={3}
            selectOnFocus
            disabled={!isAdmin || saving}
            inputMode="decimal"
          />
        </FormField>
        <FormField label="TDS Threshold">
          <FormattedNumberInput
            value={form.tds_threshold}
            onChange={(value) => setForm((prev) => ({ ...prev, tds_threshold: value }))}
            fractionDigits={2}
            selectOnFocus
            disabled={!isAdmin || saving}
            inputMode="decimal"
          />
        </FormField>
      </div>
      {!isAdmin ? (
        <p className="mt-2 text-xs text-(--muted)">Only admins can change TDS settings.</p>
      ) : null}
    </FormPanel>
  )
}
