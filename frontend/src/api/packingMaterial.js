import api from './client'

export async function fetchPackingFyStock({ fy } = {}) {
  const { data } = await api.get('/packing-material/stock', {
    params: {
      fy: fy || undefined,
    },
  })
  return data
}

export async function refreshPackingFyStock({ fy } = {}) {
  const { data } = await api.post(
    '/packing-material/stock/refresh',
    {},
    {
      params: {
        fy: fy || undefined,
      },
    },
  )
  return data
}

export async function updatePackingFyRows({ fy, rows }) {
  const { data } = await api.post(
    '/packing-material/stock/update',
    { rows },
    {
      params: {
        fy: fy || undefined,
      },
    },
  )
  return data
}

export async function setPackingFyFrozen({ fy, frozen }) {
  const { data } = await api.post(
    '/packing-material/stock/freeze',
    { frozen },
    {
      params: {
        fy: fy || undefined,
      },
    },
  )
  return data
}

export async function fetchPackingSuppliers() {
  const { data } = await api.get('/packing-material/suppliers')
  return data
}

export async function fetchPackingPurchases({ fy, skuId }) {
  const { data } = await api.get('/packing-material/purchases', {
    params: {
      fy: fy || undefined,
      sku_id: skuId,
    },
  })
  return data
}

export async function createPackingPurchase({ fy, ...payload }) {
  const { data } = await api.post('/packing-material/purchases', payload, {
    params: {
      fy: fy || undefined,
    },
  })
  return data
}

export async function updatePackingPurchase({ fy, purchaseId, ...payload }) {
  const { data } = await api.patch(`/packing-material/purchases/${purchaseId}`, payload, {
    params: {
      fy: fy || undefined,
    },
  })
  return data
}

export async function deletePackingPurchase({ fy, purchaseId }) {
  const { data } = await api.delete(`/packing-material/purchases/${purchaseId}`, {
    params: {
      fy: fy || undefined,
    },
  })
  return data
}
