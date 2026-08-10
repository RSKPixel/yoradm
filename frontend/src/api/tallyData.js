import api from './client'

export async function syncTallyData() {
  const { data } = await api.post('/tally-data/sync', null, {
    timeout: 300000,
  })
  return data
}
