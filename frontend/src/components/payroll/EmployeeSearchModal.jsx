import { MagnifyingGlassIcon } from '@heroicons/react/24/outline'
import { useEffect, useState } from 'react'
import { searchPayrollEmployees } from '../../api/payrollEmployee'
import { Modal } from '../common/Modal'
import { FormField, FormInput, FormSelect } from '../form/FormPanel'
import { formatDate } from '../../utils/formatDate'
import { getApiErrorMessage } from '../../utils/formValidation'

function formatSalary(value) {
  const num = Number(value)
  if (!Number.isFinite(num)) return '—'
  return num.toLocaleString(undefined, { maximumFractionDigits: 2 })
}

export function EmployeeSearchModal({ onClose, onSelect }) {
  const [q, setQ] = useState('')
  const [activeFilter, setActiveFilter] = useState('all')
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError('')
      try {
        const activeOnly =
          activeFilter === 'active' ? true : activeFilter === 'inactive' ? false : undefined
        const data = await searchPayrollEmployees({
          q: q.trim() || undefined,
          activeOnly,
          pageSize: 100,
        })
        if (!cancelled) setItems(data.items ?? [])
      } catch (err) {
        if (!cancelled) {
          setItems([])
          setError(getApiErrorMessage(err, 'Failed to load employees'))
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [q, activeFilter])

  return (
    <Modal
      title="Search Employees"
      titleIcon={MagnifyingGlassIcon}
      onClose={onClose}
      ariaLabelledBy="payroll-employee-search-modal-title"
      className="dc-search-modal"
    >
      <div className="dc-search-layout">
        <div className="dc-search-toolbar">
          <div className="dc-search-period dc-search-period--3">
            <FormField label="Search" className="dc-search-field">
              <FormInput
                type="text"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Code, name, designation"
              />
            </FormField>
            <FormField label="Status" className="dc-search-field">
              <FormSelect value={activeFilter} onChange={(e) => setActiveFilter(e.target.value)}>
                <option value="all">All</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </FormSelect>
            </FormField>
          </div>
          <p className="dc-search-count">
            {loading ? 'Loading…' : `${items.length} employee${items.length === 1 ? '' : 's'}`}
          </p>
        </div>

        {error ? <p className="dc-search-error">{error}</p> : null}

        <div className="dc-search-panel">
          <div className="dc-search-table-wrap">
            <table className="dc-search-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Name</th>
                  <th>Designation</th>
                  <th>Join Date</th>
                  <th className="dc-search-num">Salary</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="dc-search-empty">
                      Loading…
                    </td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="dc-search-empty">
                      No employees found.
                    </td>
                  </tr>
                ) : (
                  items.map((row) => (
                    <tr
                      key={row.id}
                      className="dc-search-row"
                      tabIndex={0}
                      onClick={() => onSelect(row.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          onSelect(row.id)
                        }
                      }}
                    >
                      <td>
                        <span className="dc-search-id">{row.emp_code}</span>
                      </td>
                      <td>{row.name}</td>
                      <td>{row.designation || '—'}</td>
                      <td>{row.join_date ? formatDate(row.join_date) : '—'}</td>
                      <td className="dc-search-num">{formatSalary(row.monthly_salary)}</td>
                      <td>{row.is_active ? 'Active' : 'Inactive'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Modal>
  )
}
