export const ORID_RAW_STOCK_GROUP = 'Orid Raw'

/** stock_group -> default share of Orid Raw (percent). */
export const DEFAULT_ORID_YIELD_PCTS = {
  'Orid Dhall': 66,
  'Orid Dhall Split': 13,
  'Orid Dhall Rejection': 1,
  'Orid Husk': 16,
}

export const ORID_YIELD_GROUPS = Object.keys(DEFAULT_ORID_YIELD_PCTS)

export function defaultOridYieldPcts() {
  return { ...DEFAULT_ORID_YIELD_PCTS }
}
