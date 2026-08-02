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

export async function fetchBrokerage({ fyStart, month, broker } = {}) {
  const { data } = await api.get('/brokerage', {
    params: {
      fy_start: fyStart,
      month,
      broker,
    },
  })
  return data
}

export async function saveBrokerageRates({
  fyStart,
  month,
  broker,
  rates,
  tdsPercent,
} = {}) {
  const { data } = await api.post('/brokerage/rates', {
    fy_start: fyStart,
    month,
    broker,
    rates,
    tds_percent: tdsPercent ?? null,
  })
  return data
}
