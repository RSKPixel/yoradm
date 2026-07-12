const IST_TIME_ZONE = 'Asia/Kolkata'

/** Parse API datetimes; naive values are stored as UTC. */
export function parseApiDate(value) {
  if (!value) return null
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value

  const raw = String(value).trim()
  if (!raw) return null

  const hasTimezone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(raw)
  const normalized = hasTimezone ? raw : `${raw.replace(/ /, 'T')}Z`
  const date = new Date(normalized)
  return Number.isNaN(date.getTime()) ? null : date
}

export function formatLastLogin(value) {
  const date = parseApiDate(value)
  if (!date) return 'No previous login'

  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: IST_TIME_ZONE,
  })
}
