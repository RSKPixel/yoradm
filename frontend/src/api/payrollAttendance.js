import api from './client'

export async function fetchAttendanceSheet({ year, month }) {
  const { data } = await api.get('/payroll/attendance', {
    params: { year, month },
  })
  return data
}

export async function saveAttendanceSheet(payload) {
  const { data } = await api.put('/payroll/attendance', payload)
  return data
}
