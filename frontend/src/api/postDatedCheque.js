import api from './client'

export async function createPostDatedCheque(payload) {
  const { data } = await api.post('/post-dated-cheques', payload)
  return data
}

export async function updatePostDatedCheque(chequeId, payload) {
  const { data } = await api.put(`/post-dated-cheques/${chequeId}`, payload)
  return data
}

export async function updatePostDatedChequeStatus(chequeId, status) {
  const { data } = await api.patch(`/post-dated-cheques/${chequeId}/status`, {
    status,
  })
  return data
}

export async function deletePostDatedCheque(chequeId) {
  await api.delete(`/post-dated-cheques/${chequeId}`)
}

export async function searchPostDatedCheques({
  dateFrom,
  dateTo,
  party,
  chequeNo,
  page = 1,
  pageSize = 50,
} = {}) {
  const { data } = await api.get('/post-dated-cheques', {
    params: {
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
      party: party || undefined,
      cheque_no: chequeNo || undefined,
      page,
      page_size: pageSize,
    },
  })
  return data
}

export async function fetchPostDatedCheque(chequeId) {
  const { data } = await api.get(`/post-dated-cheques/${chequeId}`)
  return data
}
