/**
 * Display dates as dd-mm-yyyy across the app.
 * HTML <input type="date"> values stay ISO (yyyy-mm-dd).
 */

function pad2(n) {
  return String(n).padStart(2, '0')
}

/** Parse Date, ISO datetime, or yyyy-mm-dd into a local calendar date. */
export function parseDisplayDate(value) {
  if (!value) return null
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value
  }

  const raw = String(value).trim()
  if (!raw) return null

  const isoDay = raw.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (isoDay) {
    const year = Number(isoDay[1])
    const month = Number(isoDay[2])
    const day = Number(isoDay[3])
    const date = new Date(year, month - 1, day)
    return Number.isNaN(date.getTime()) ? null : date
  }

  const date = new Date(raw)
  return Number.isNaN(date.getTime()) ? null : date
}

/** Format any supported date value as dd-mm-yyyy. */
export function formatDate(value) {
  const date = parseDisplayDate(value)
  if (!date) return ''
  return `${pad2(date.getDate())}-${pad2(date.getMonth() + 1)}-${date.getFullYear()}`
}

/** Today's date as yyyy-mm-dd for <input type="date">. */
export function todayIsoDate() {
  const now = new Date()
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`
}

/** Convert any supported date value to yyyy-mm-dd for <input type="date">. */
export function toIsoDateInput(value) {
  const date = parseDisplayDate(value)
  if (!date) return ''
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}
