import api from './client'

export async function fetchCompanyPublic() {
  const { data } = await api.get('/company/public')
  return data
}

export async function fetchCompany() {
  const { data } = await api.get('/company')
  return data
}

export async function updateCompany(payload) {
  const { data } = await api.put('/company', payload)
  return data
}

export async function updateGeneralSettings(payload) {
  const { data } = await api.put('/company/general', payload)
  return data
}
