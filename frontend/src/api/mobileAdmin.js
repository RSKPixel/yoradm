import api from './client'

export async function fetchDevices() {
  const { data } = await api.get('/mobile-admin/devices')
  return data
}

export async function fetchRepOptions() {
  const { data } = await api.get('/mobile-admin/representatives')
  return data
}

export async function createDevice(payload) {
  const { data } = await api.post('/mobile-admin/devices', payload)
  return data
}

export async function updateDevice(deviceId, payload) {
  const { data } = await api.patch(`/mobile-admin/devices/${deviceId}`, payload)
  return data
}

export async function reissueCode(deviceId) {
  const { data } = await api.post(`/mobile-admin/devices/${deviceId}/code`)
  return data
}

export async function revokeDevice(deviceId) {
  const { data } = await api.post(`/mobile-admin/devices/${deviceId}/revoke`)
  return data
}

export async function deleteDevice(deviceId) {
  await api.delete(`/mobile-admin/devices/${deviceId}`)
}

export async function fetchMobileAudit(params = {}) {
  const { data } = await api.get('/mobile-admin/audit', { params })
  return data
}
