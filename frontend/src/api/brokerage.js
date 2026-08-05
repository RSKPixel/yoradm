import api from './client'

export async function fetchBrokerageBrokers({ fyStart, month } = {}) {
  const { data } = await api.get('/brokerage/brokers', {
    params: {
      fy_start: fyStart,
      month,
    },
  })
  return data
}

export async function fetchBrokerage({ fyStart, month, broker, reload = false } = {}) {
  const { data } = await api.get('/brokerage', {
    params: {
      fy_start: fyStart,
      month,
      broker,
      ...(reload ? { reload: true } : {}),
    },
  })
  return data
}

export async function fetchBrokerageBuyers({ fyStart, month, broker } = {}) {
  const { data } = await api.get('/brokerage/buyers', {
    params: {
      fy_start: fyStart,
      month,
      broker,
    },
  })
  return data
}

export async function saveBrokerage({
  fyStart,
  month,
  broker,
  lines,
  tdsPercent,
} = {}) {
  const { data } = await api.post('/brokerage/save', {
    fy_start: fyStart,
    month,
    broker,
    lines,
    tds_percent: tdsPercent ?? null,
  })
  return data
}
