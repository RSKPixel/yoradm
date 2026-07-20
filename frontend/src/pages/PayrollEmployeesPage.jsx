import { useMemo, useState } from 'react'
import {
  createPayrollEmployee,
  deletePayrollEmployee,
  fetchPayrollEmployee,
  updatePayrollEmployee,
} from '../api/payrollEmployee'
import { ConfirmDeleteModal } from '../components/delivery-challan/ConfirmDeleteModal'
import { FormattedNumberInput } from '../components/form/FormattedNumberInput'
import { FormField, FormInput, FormSelect } from '../components/form/FormPanel'
import { useFormMessage } from '../components/form/FormMessage'
import { PrimaryContentLayout } from '../components/layout/PrimaryContentLayout'
import { EmployeeSearchModal } from '../components/payroll/EmployeeSearchModal'
import { getApiErrorMessage } from '../utils/formValidation'

function emptyFormState() {
  return {
    empCode: '',
    name: '',
    designation: '',
    joinDate: '',
    phone: '',
    monthlySalary: '',
    isActive: true,
    remarks: '',
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

function parseNum(value) {
  const n = Number.parseFloat(String(value ?? '').replace(/,/g, ''))
  return Number.isFinite(n) ? n : null
}

function snapshotForm(state) {
  return JSON.stringify({
    name: String(state.name ?? '').trim(),
    designation: String(state.designation ?? '').trim(),
    joinDate: String(state.joinDate ?? ''),
    phone: String(state.phone ?? '').trim(),
    monthlySalary: String(state.monthlySalary ?? '').trim(),
    isActive: Boolean(state.isActive),
    remarks: String(state.remarks ?? '').trim(),
  })
}

function validateEmployeeForm(form) {
  const errors = []
  if (!String(form.name ?? '').trim()) {
    errors.push('Name is required.')
  }
  const salaryRaw = String(form.monthlySalary ?? '').trim()
  if (salaryRaw) {
    const salary = parseNum(salaryRaw)
    if (salary == null || salary < 0) {
      errors.push('Monthly salary must be a non-negative number.')
    }
  }
  return errors
}

function rowToForm(row) {
  return {
    empCode: row.emp_code ?? '',
    name: row.name ?? '',
    designation: row.designation ?? '',
    joinDate: toIsoDateOrEmpty(row.join_date),
    phone: row.phone ?? '',
    monthlySalary: numToForm(row.monthly_salary),
    isActive: Boolean(row.is_active),
    remarks: row.remarks ?? '',
  }
}

function formToPayload(form) {
  const salaryRaw = String(form.monthlySalary ?? '').trim()
  return {
    name: String(form.name ?? '').trim(),
    designation: String(form.designation ?? '').trim() || null,
    join_date: form.joinDate || null,
    phone: String(form.phone ?? '').trim() || null,
    monthly_salary: salaryRaw ? parseNum(salaryRaw) : null,
    is_active: Boolean(form.isActive),
    remarks: String(form.remarks ?? '').trim() || null,
  }
}

export function PayrollEmployeesPage() {
  const { showErrors, showSuccess, showError } = useFormMessage()

  const [form, setForm] = useState(emptyFormState)
  const [savedSnapshot, setSavedSnapshot] = useState(() => snapshotForm(emptyFormState()))
  const [savedEmployeeId, setSavedEmployeeId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [loadingEmployee, setLoadingEmployee] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)

  const isModifyMode = savedEmployeeId != null
  const isDirty = useMemo(
    () => snapshotForm(form) !== savedSnapshot,
    [form, savedSnapshot],
  )

  function setField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function resetForm() {
    const next = emptyFormState()
    setForm(next)
    setSavedSnapshot(snapshotForm(next))
    setSavedEmployeeId(null)
  }

  function applyEmployee(row) {
    const next = rowToForm(row)
    setForm(next)
    setSavedSnapshot(snapshotForm(next))
    setSavedEmployeeId(row.id)
  }

  async function onSave(e) {
    e?.preventDefault?.()
    const errors = validateEmployeeForm(form)
    if (errors.length) {
      showErrors(errors)
      return
    }
    setSaving(true)
    try {
      const payload = formToPayload(form)
      if (isModifyMode) {
        const updated = await updatePayrollEmployee(savedEmployeeId, payload)
        applyEmployee(updated)
        showSuccess('Employee updated.')
      } else {
        const created = await createPayrollEmployee(payload)
        applyEmployee(created)
        showSuccess('Employee saved.')
      }
    } catch (err) {
      showError(getApiErrorMessage(err, 'Failed to save employee'))
    } finally {
      setSaving(false)
    }
  }

  async function loadEmployee(id) {
    setLoadingEmployee(true)
    try {
      const row = await fetchPayrollEmployee(id)
      applyEmployee(row)
      setSearchOpen(false)
    } catch (err) {
      showError(getApiErrorMessage(err, 'Failed to load employee'))
    } finally {
      setLoadingEmployee(false)
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
      await deletePayrollEmployee(savedEmployeeId)
      resetForm()
      setDeleteConfirmOpen(false)
      showSuccess('Employee deleted.')
    } catch (err) {
      showError(getApiErrorMessage(err, 'Failed to delete employee'))
    } finally {
      setDeleting(false)
    }
  }

  function onFormKeyDown(e) {
    if (e.key === 'Enter' && e.target?.tagName !== 'TEXTAREA') {
      const tag = e.target?.tagName
      if (tag === 'BUTTON') return
      e.preventDefault()
    }
  }

  return (
    <>
      {searchOpen ? (
        <EmployeeSearchModal
          onClose={() => setSearchOpen(false)}
          onSelect={(id) => void loadEmployee(id)}
        />
      ) : null}
      {deleteConfirmOpen ? (
        <ConfirmDeleteModal
          title="Delete employee"
          message="Delete this employee permanently? This cannot be undone."
          confirming={deleting}
          onCancel={() => {
            if (!deleting) setDeleteConfirmOpen(false)
          }}
          onConfirm={() => void confirmDelete()}
        />
      ) : null}

      <PrimaryContentLayout
        title={isModifyMode ? `Employee — ${form.empCode}` : 'Employee — New'}
        breadcrumb={[
          { label: 'Payroll' },
          { label: isModifyMode ? `Employee — ${form.empCode}` : 'Employee — New' },
        ]}
        onSubmit={onSave}
        onKeyDown={onFormKeyDown}
        footer={
          <>
            <button
              type="button"
              className="win-form__button"
              onClick={() => setSearchOpen(true)}
              disabled={saving || deleting || loadingEmployee}
            >
              Search
            </button>
            <span className="win-form__footer-divider" aria-hidden="true" />
            <button
              type="button"
              className="win-form__button win-form__button--danger"
              onClick={() => void onDelete()}
              disabled={!isModifyMode || saving || deleting || loadingEmployee}
            >
              Delete
            </button>
            <button
              type="button"
              className="win-form__button"
              onClick={resetForm}
              disabled={saving || deleting || loadingEmployee}
            >
              New
            </button>
            <button
              type="submit"
              className="win-form__button win-form__button--primary"
              disabled={
                saving || deleting || loadingEmployee || (isModifyMode && !isDirty)
              }
            >
              {saving ? 'Saving…' : isModifyMode ? 'Update' : 'Save'}
            </button>
          </>
        }
      >
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          <div className="gr-form mx-auto w-full max-w-[60%] shrink-0">
            <div className="grid grid-cols-1 gap-x-4 gap-y-3.5 sm:grid-cols-2 lg:grid-cols-6">
              <FormField label="Emp. Code" className="lg:col-span-2">
                <FormInput
                  readOnly
                  value={isModifyMode ? form.empCode : 'New'}
                  title={isModifyMode ? form.empCode : 'Assigned on save as EMP-001, EMP-002, …'}
                />
              </FormField>
              <FormField label="Name" className="lg:col-span-4">
                <FormInput
                  required
                  value={form.name}
                  onChange={(e) => setField('name', e.target.value)}
                />
              </FormField>
              <FormField label="Designation" className="lg:col-span-3">
                <FormInput
                  value={form.designation}
                  onChange={(e) => setField('designation', e.target.value)}
                />
              </FormField>
              <FormField label="Join Date" className="lg:col-span-3">
                <FormInput
                  type="date"
                  value={form.joinDate}
                  onChange={(e) => setField('joinDate', e.target.value)}
                />
              </FormField>
              <FormField label="Phone" className="lg:col-span-2">
                <FormInput
                  type="text"
                  inputMode="tel"
                  value={form.phone}
                  onChange={(e) => setField('phone', e.target.value)}
                />
              </FormField>
              <FormField label="Monthly Salary" className="lg:col-span-2">
                <FormattedNumberInput
                  value={form.monthlySalary}
                  onChange={(value) => setField('monthlySalary', value)}
                  fractionDigits={2}
                />
              </FormField>
              <FormField label="Status" className="lg:col-span-2">
                <FormSelect
                  value={form.isActive ? 'active' : 'inactive'}
                  onChange={(e) => setField('isActive', e.target.value === 'active')}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </FormSelect>
              </FormField>
              <FormField label="Remarks" className="lg:col-span-6">
                <FormInput
                  value={form.remarks}
                  onChange={(e) => setField('remarks', e.target.value)}
                />
              </FormField>
            </div>
          </div>
        </div>
      </PrimaryContentLayout>
    </>
  )
}
