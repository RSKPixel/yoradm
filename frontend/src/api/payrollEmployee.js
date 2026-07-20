import api from './client'

export async function createPayrollEmployee(payload) {
  const { data } = await api.post('/payroll/employees', payload)
  return data
}

export async function updatePayrollEmployee(employeeId, payload) {
  const { data } = await api.put(`/payroll/employees/${employeeId}`, payload)
  return data
}

export async function deletePayrollEmployee(employeeId) {
  await api.delete(`/payroll/employees/${employeeId}`)
}

export async function searchPayrollEmployees({
  q,
  activeOnly,
  page = 1,
  pageSize = 50,
} = {}) {
  const { data } = await api.get('/payroll/employees', {
    params: {
      q: q || undefined,
      active_only: activeOnly,
      page,
      page_size: pageSize,
    },
  })
  return data
}

export async function fetchPayrollEmployee(employeeId) {
  const { data } = await api.get(`/payroll/employees/${employeeId}`)
  return data
}
