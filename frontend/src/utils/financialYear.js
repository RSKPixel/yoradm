/** Indian financial year helpers (April → March). */

export const FY_MONTHS = [
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' },
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
]

function pad2(n) {
  return String(n).padStart(2, '0')
}

/** Calendar year in which the FY starts (April). */
export function currentFinancialYearStart() {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  return month >= 4 ? year : year - 1
}

export function formatFinancialYearLabel(fyStartYear) {
  const start = Number(fyStartYear)
  return `${start}-${String(start + 1).slice(-2)}`
}

/** Recent FYs for dropdowns (newest first). */
export function financialYearOptions(count = 5) {
  const current = currentFinancialYearStart()
  return Array.from({ length: count }, (_, i) => {
    const start = current - i
    return { value: start, label: formatFinancialYearLabel(start) }
  })
}

/**
 * Date range for an FY, optionally narrowed to one calendar month (1–12).
 * month null/''/'all' → full FY (1 Apr → 31 Mar).
 */
export function dateRangeForFinancialYear(fyStartYear, month) {
  const start = Number(fyStartYear)
  const monthNum = month === '' || month == null || month === 'all' ? null : Number(month)

  if (!Number.isFinite(start)) {
    return { dateFrom: '', dateTo: '' }
  }

  if (monthNum == null || !Number.isFinite(monthNum) || monthNum < 1 || monthNum > 12) {
    return {
      dateFrom: `${start}-04-01`,
      dateTo: `${start + 1}-03-31`,
    }
  }

  const year = monthNum >= 4 ? start : start + 1
  const lastDay = new Date(year, monthNum, 0).getDate()
  return {
    dateFrom: `${year}-${pad2(monthNum)}-01`,
    dateTo: `${year}-${pad2(monthNum)}-${pad2(lastDay)}`,
  }
}
