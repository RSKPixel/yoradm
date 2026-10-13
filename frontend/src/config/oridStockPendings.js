/** @deprecated Browser cache removed — pendings live in yoradm_orid_stock_pending. */
export const ORID_STOCK_PENDINGS_STORAGE_KEY = 'yoradm_orid_stock_pendings'

export function clearOridStockPendingsLocal() {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(ORID_STOCK_PENDINGS_STORAGE_KEY)
}

export function readOridStockPendingsLocal() {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(ORID_STOCK_PENDINGS_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}
