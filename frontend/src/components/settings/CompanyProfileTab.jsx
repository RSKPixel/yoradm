import { useEffect, useState } from 'react'
import { fetchCompany, updateCompany } from '../../api/company'
import { getApiErrorMessage, validateCompanyProfileForm } from '../../utils/formValidation'
import { FormField, FormInput, FormPanel } from '../form/FormPanel'
import { useFormMessage } from '../form/FormMessage'

const EMPTY_FORM = {
  company_name: '',
  address: '',
  area: '',
  city: '',
  state: '',
  pincode: '',
  country: 'India',
  email: '',
  mobile: '',
  gstin: '',
  pan: '',
}

function toFormState(company) {
  return {
    company_name: company?.company_name ?? '',
    address: company?.address ?? '',
    area: company?.area ?? '',
    city: company?.city ?? '',
    state: company?.state ?? '',
    pincode: company?.pincode ?? '',
    country: company?.country || 'India',
    email: company?.email ?? '',
    mobile: company?.mobile ?? '',
    gstin: company?.gstin ?? '',
    pan: company?.pan ?? '',
  }
}

function optionalValue(value) {
  const trimmed = value?.trim() ?? ''
  return trimmed || null
}

export function CompanyProfileTab() {
  const { showError, showErrors, showSuccess } = useFormMessage()
  const [form, setForm] = useState(EMPTY_FORM)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function loadCompany() {
      setLoading(true)
      try {
        const company = await fetchCompany()
        if (!cancelled) setForm(toFormState(company))
      } catch (error) {
        if (!cancelled) {
          showError(getApiErrorMessage(error, 'Could not load company profile'))
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void loadCompany()
    return () => {
      cancelled = true
    }
  }, [])

  function setField(field) {
    return (event) => {
      setForm((prev) => ({ ...prev, [field]: event.target.value }))
    }
  }

  async function onSave(e) {
    e.preventDefault()

    const validationErrors = validateCompanyProfileForm(form)
    if (validationErrors.length) {
      showErrors(validationErrors)
      return
    }

    setSaving(true)
    try {
      const saved = await updateCompany({
        company_name: form.company_name.trim(),
        address: form.address.trim(),
        area: optionalValue(form.area),
        city: form.city.trim(),
        state: form.state.trim(),
        pincode: optionalValue(form.pincode),
        country: 'India',
        email: optionalValue(form.email),
        mobile: optionalValue(form.mobile),
        gstin: optionalValue(form.gstin),
        pan: optionalValue(form.pan),
      })
      setForm(toFormState(saved))
      showSuccess('Company profile updated successfully')
    } catch (error) {
      showError(getApiErrorMessage(error, 'Could not update company profile'))
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <p className="text-sm text-(--muted)">Loading company profile…</p>
  }

  return (
    <FormPanel
      title="Company profile"
      onSubmit={onSave}
      footer={
        <button
          type="submit"
          className="win-form__button win-form__button--primary"
          disabled={saving}
        >
          {saving ? 'Saving…' : 'Save company profile'}
        </button>
      }
    >
      <div className="grid gap-x-3 sm:grid-cols-2 lg:grid-cols-3">
        <FormField label="Company name" className="sm:col-span-2 lg:col-span-3">
          <FormInput required value={form.company_name} onChange={setField('company_name')} />
        </FormField>
        <FormField label="Address" className="sm:col-span-2 lg:col-span-3">
          <FormInput required value={form.address} onChange={setField('address')} />
        </FormField>

        <FormField label="Area">
          <FormInput value={form.area} onChange={setField('area')} />
        </FormField>
        <FormField label="City">
          <FormInput required value={form.city} onChange={setField('city')} />
        </FormField>
        <FormField label="State">
          <FormInput required value={form.state} onChange={setField('state')} />
        </FormField>
        <FormField label="Pincode">
          <FormInput value={form.pincode} onChange={setField('pincode')} />
        </FormField>
        <FormField label="Email">
          <FormInput type="text" inputMode="email" value={form.email} onChange={setField('email')} />
        </FormField>
        <FormField label="Mobile">
          <FormInput value={form.mobile} onChange={setField('mobile')} />
        </FormField>

        <FormField label="GSTIN">
          <FormInput value={form.gstin} onChange={setField('gstin')} />
        </FormField>
        <FormField label="PAN">
          <FormInput value={form.pan} onChange={setField('pan')} />
        </FormField>
      </div>
    </FormPanel>
  )
}
