import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { fetchAttendanceSheet, saveAttendanceSheet } from '../api/payrollAttendance'
import { FormField, FormSelect } from '../components/form/FormPanel'
import { useFormMessage } from '../components/form/FormMessage'
import { PrimaryContentLayout } from '../components/layout/PrimaryContentLayout'
import { getApiErrorMessage } from '../utils/formValidation'

const STATUS_CYCLE = ['', 'P', 'A', 'H', 'O']
const STATUS_LABEL = {
  P: 'Present',
  A: 'Absent',
  H: 'Half day',
  O: 'Holiday',
}

const MONTH_OPTIONS = [
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' },
]

function currentYearMonth() {
  const now = new Date()
  return { year: now.getFullYear(), month: now.getMonth() + 1 }
}

function yearOptions() {
  const current = new Date().getFullYear()
  return [current, current - 1, current - 2, current - 3]
}

function nextStatus(current, { isSunday = false } = {}) {
  const cycle = isSunday ? ['O', 'P', 'A', 'H'] : STATUS_CYCLE
  const idx = cycle.indexOf(current || (isSunday ? 'O' : ''))
  const safeIdx = idx >= 0 ? idx : 0
  return cycle[(safeIdx + 1) % cycle.length]
}

function isSundayDate(year, month, day) {
  return new Date(year, month - 1, day).getDay() === 0
}

function markKey(employeeId, day) {
  return `${employeeId}:${day}`
}

function countsForMarks(marks, daysInMonth) {
  let present = 0
  let absent = 0
  let half = 0
  let holiday = 0
  for (let day = 1; day <= daysInMonth; day += 1) {
    const status = marks[String(day)] || ''
    if (status === 'P') present += 1
    else if (status === 'A') absent += 1
    else if (status === 'H') half += 1
    else if (status === 'O') holiday += 1
  }
  return {
    present,
    absent,
    half,
    holiday,
    days: present + holiday + half * 0.5,
  }
}

export function PayrollAttendancePage() {
  const { showError, showSuccess } = useFormMessage()
  const initial = currentYearMonth()
  const [year, setYear] = useState(initial.year)
  const [month, setMonth] = useState(initial.month)
  const [daysInMonth, setDaysInMonth] = useState(0)
  const [employees, setEmployees] = useState([])
  const [baseline, setBaseline] = useState({})
  const [edits, setEdits] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const scrollRef = useRef(null)
  const todayHeaderRef = useRef(null)

  const applySheet = useCallback((data) => {
    const nextBaseline = {}
    const rows = Array.isArray(data?.employees) ? data.employees : []
    for (const emp of rows) {
      const marks = emp.marks && typeof emp.marks === 'object' ? emp.marks : {}
      for (const [day, status] of Object.entries(marks)) {
        if (status) nextBaseline[markKey(emp.id, Number(day))] = status
      }
    }
    setEmployees(rows)
    setDaysInMonth(Number(data?.days_in_month) || 0)
    setBaseline(nextBaseline)
    setEdits({})
  }, [])

  const loadSheet = useCallback(
    async (yearValue, monthValue) => {
      setLoading(true)
      try {
        const data = await fetchAttendanceSheet({ year: yearValue, month: monthValue })
        applySheet(data)
      } catch (err) {
        setEmployees([])
        setDaysInMonth(0)
        setBaseline({})
        setEdits({})
        showError(getApiErrorMessage(err, 'Unable to load attendance'))
      } finally {
        setLoading(false)
      }
    },
    [applySheet, showError],
  )

  useEffect(() => {
    void loadSheet(year, month)
  }, [year, month, loadSheet])

  const dirtyMarks = useMemo(() => {
    const keys = new Set([...Object.keys(baseline), ...Object.keys(edits)])
    const marks = []
    for (const key of keys) {
      const edited = Object.prototype.hasOwnProperty.call(edits, key)
      const current = edited ? edits[key] : baseline[key] || ''
      const original = baseline[key] || ''
      if (current === original) continue
      const [employeeId, day] = key.split(':')
      marks.push({
        employee_id: Number(employeeId),
        day: Number(day),
        status: current || null,
      })
    }
    return marks
  }, [baseline, edits])

  const hasDirty = dirtyMarks.length > 0

  const dayColumns = useMemo(
    () => Array.from({ length: daysInMonth }, (_, i) => i + 1),
    [daysInMonth],
  )

  const todayDay = useMemo(() => {
    const now = new Date()
    if (now.getFullYear() === year && now.getMonth() + 1 === month) {
      return now.getDate()
    }
    return null
  }, [year, month])

  useEffect(() => {
    if (loading || todayDay == null) return

    const frame = requestAnimationFrame(() => {
      const scrollEl = scrollRef.current
      const todayEl = todayHeaderRef.current
      if (!scrollEl || !todayEl) return

      const codeEl = scrollEl.querySelector('thead .payroll-att__col-code')
      const nameEl = scrollEl.querySelector('thead .payroll-att__col-name')
      const stickyWidth =
        (codeEl?.getBoundingClientRect().width || 0) +
        (nameEl?.getBoundingClientRect().width || 0)

      const cellLeft = todayEl.offsetLeft
      const cellWidth = todayEl.offsetWidth
      const visibleWidth = Math.max(scrollEl.clientWidth - stickyWidth, cellWidth)
      // Keep today in view to the right of frozen Code/Name columns.
      const target = cellLeft - stickyWidth - Math.max((visibleWidth - cellWidth) / 2, 8)
      scrollEl.scrollLeft = Math.max(0, Math.min(target, scrollEl.scrollWidth - scrollEl.clientWidth))
    })

    return () => cancelAnimationFrame(frame)
  }, [loading, todayDay, year, month, employees.length, daysInMonth])

  function statusFor(employeeId, day) {
    const key = markKey(employeeId, day)
    if (Object.prototype.hasOwnProperty.call(edits, key)) return edits[key] || ''
    return baseline[key] || ''
  }

  function cycleMark(employeeId, day) {
    const key = markKey(employeeId, day)
    const current = statusFor(employeeId, day)
    const next = nextStatus(current, { isSunday: isSundayDate(year, month, day) })
    const original = baseline[key] || ''
    setEdits((prev) => {
      const copy = { ...prev }
      if (next === original) delete copy[key]
      else copy[key] = next
      return copy
    })
  }

  function setDayStatus(day, status) {
    setEdits((prev) => {
      const copy = { ...prev }
      for (const emp of employees) {
        const key = markKey(emp.id, day)
        const original = baseline[key] || ''
        if (status === original) delete copy[key]
        else copy[key] = status
      }
      return copy
    })
  }

  function toggleHolidayDay(day) {
    if (!employees.length) return
    const allHoliday = employees.every((emp) => statusFor(emp.id, day) === 'O')
    // Sundays stay holiday by default — header click only applies O, does not clear.
    if (isSundayDate(year, month, day)) {
      if (!allHoliday) setDayStatus(day, 'O')
      return
    }
    setDayStatus(day, allHoliday ? '' : 'O')
  }

  async function onSave() {
    if (!hasDirty) return
    setSaving(true)
    try {
      const data = await saveAttendanceSheet({
        year,
        month,
        marks: dirtyMarks,
      })
      applySheet(data)
      showSuccess('Attendance saved.')
    } catch (err) {
      showError(getApiErrorMessage(err, 'Failed to save attendance'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <PrimaryContentLayout
      title="Attendance"
      breadcrumb={[{ label: 'Payroll' }, { label: 'Attendance' }]}
      footer={
        <>
          <button
            type="button"
            className="win-form__button"
            disabled={loading || saving || hasDirty}
            onClick={() => void loadSheet(year, month)}
          >
            Reload
          </button>
          <button
            type="button"
            className="win-form__button win-form__button--primary"
            disabled={loading || saving || !hasDirty}
            onClick={() => void onSave()}
          >
            {saving ? 'Saving…' : 'Update'}
          </button>
        </>
      }
    >
      <div className="payroll-att">
        <div className="payroll-att__toolbar shrink-0">
          <div className="grid min-w-0 grid-cols-2 gap-x-3 sm:grid-cols-3 lg:grid-cols-5">
            <FormField label="Year" className="payroll-att__field">
              <FormSelect
                value={String(year)}
                onChange={(e) => setYear(Number(e.target.value))}
                disabled={loading || saving || hasDirty}
              >
                {yearOptions().map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </FormSelect>
            </FormField>
            <FormField label="Month" className="payroll-att__field">
              <FormSelect
                value={String(month)}
                onChange={(e) => setMonth(Number(e.target.value))}
                disabled={loading || saving || hasDirty}
              >
                {MONTH_OPTIONS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </FormSelect>
            </FormField>
          </div>
          <p className="payroll-att__legend">
            Click cell: blank → P → A → H → O → blank · Sundays default to O · Click day header = holiday for all
            <span className="payroll-att__legend-item payroll-att__mark--P">P</span>
            Present
            <span className="payroll-att__legend-item payroll-att__mark--A">A</span>
            Absent
            <span className="payroll-att__legend-item payroll-att__mark--H">H</span>
            Half
            <span className="payroll-att__legend-item payroll-att__mark--O">O</span>
            Holiday
          </p>
        </div>

        <div className="win-form__table-wrap win-form__table-shell payroll-att__table-wrap">
          <div className="win-form__table-scroll" ref={scrollRef}>
            <table className="win-form__table payroll-att__table">
              <thead>
                <tr>
                  <th className="payroll-att__col-code">Code</th>
                  <th className="payroll-att__col-name">Name</th>
                  {dayColumns.map((day) => (
                    <th
                      key={day}
                      ref={todayDay === day ? todayHeaderRef : undefined}
                      className={`payroll-att__col-day${todayDay === day ? ' is-today' : ''}`}
                    >
                      <button
                        type="button"
                        className="payroll-att__day-btn"
                        onClick={() => toggleHolidayDay(day)}
                        disabled={saving || loading || employees.length === 0}
                        title={
                          isSundayDate(year, month, day)
                            ? 'Sunday — holiday by default (click to set all to O)'
                            : 'Click to mark / clear holiday for all employees'
                        }
                      >
                        {day}
                      </button>
                    </th>
                  ))}
                  <th className="payroll-att__col-sum">P</th>
                  <th className="payroll-att__col-sum">A</th>
                  <th className="payroll-att__col-sum">H</th>
                  <th className="payroll-att__col-sum">O</th>
                  <th className="payroll-att__col-sum">Days</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td
                      colSpan={Math.max(7 + dayColumns.length, 7)}
                      className="win-form__table-empty"
                    >
                      Loading…
                    </td>
                  </tr>
                ) : employees.length === 0 ? (
                  <tr>
                    <td
                      colSpan={Math.max(7 + dayColumns.length, 7)}
                      className="win-form__table-empty"
                    >
                      No active employees. Add employees first.
                    </td>
                  </tr>
                ) : (
                  employees.map((emp) => {
                    const marks = {}
                    for (const day of dayColumns) {
                      marks[String(day)] = statusFor(emp.id, day)
                    }
                    const counts = countsForMarks(marks, daysInMonth)
                    return (
                      <tr key={emp.id}>
                        <td className="payroll-att__col-code">{emp.emp_code}</td>
                        <td className="payroll-att__col-name" title={emp.designation || ''}>
                          {emp.name}
                        </td>
                        {dayColumns.map((day) => {
                          const status = marks[String(day)] || ''
                          const isToday = todayDay === day
                          return (
                            <td
                              key={day}
                              className={`payroll-att__col-day${isToday ? ' is-today' : ''}`}
                            >
                              <button
                                type="button"
                                className={`payroll-att__mark${status ? ` payroll-att__mark--${status}` : ''}${isToday ? ' payroll-att__mark--today' : ''}`}
                                onClick={() => cycleMark(emp.id, day)}
                                disabled={saving}
                                title={
                                  status
                                    ? `${STATUS_LABEL[status] || status} — click to change`
                                    : isToday
                                      ? 'Today — mark attendance'
                                      : 'Mark attendance'
                                }
                                aria-label={`${emp.name} day ${day} ${status || 'unmarked'}${isToday ? ' (today)' : ''}`}
                              >
                                {status || '·'}
                              </button>
                            </td>
                          )
                        })}
                        <td className="payroll-att__col-sum win-form__table-num">{counts.present}</td>
                        <td className="payroll-att__col-sum win-form__table-num">{counts.absent}</td>
                        <td className="payroll-att__col-sum win-form__table-num">{counts.half}</td>
                        <td className="payroll-att__col-sum win-form__table-num">{counts.holiday}</td>
                        <td className="payroll-att__col-sum win-form__table-num">
                          {Number.isInteger(counts.days)
                            ? counts.days
                            : counts.days.toFixed(1)}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </PrimaryContentLayout>
  )
}
