export interface COTPositionGroup {
  long: number
  short: number
  net: number
  changeInLong: number
  changeInShort: number
  changeInNet: number
  pctOfOI: number    // % of open interest this group represents
}

export type COTBias = 'strongly_bullish' | 'bullish' | 'neutral' | 'bearish' | 'strongly_bearish'

export interface COTReport {
  symbol: string
  asOfDate: string        // YYYY-MM-DD — data covers positions as of this date
  reportDate: string      // YYYY-MM-DD — report was published this date
  openInterest: number
  // Traders in Financial Futures (TFF) — FX pairs & indices
  dealers?: COTPositionGroup        // Banks / FX market-makers
  assetManagers?: COTPositionGroup  // Pension funds, institutions — true directional money
  leveragedFunds?: COTPositionGroup // Hedge funds / CTAs
  // Disaggregated — Metals (Gold, Silver)
  producers?: COTPositionGroup      // Commercial hedgers (gold miners etc.)
  swapDealers?: COTPositionGroup    // Bank swap desks
  managedMoney?: COTPositionGroup   // Hedge funds / managed accounts
  // Computed institutional signal
  institutionalBias: COTBias
  institutionalScore: number        // -100 (max short) to +100 (max long)
  // Which group drives the bias (asset managers for FX/indices, managed money for metals)
  primaryGroup: 'assetManagers' | 'managedMoney'
  source: 'tff' | 'disaggregated' | 'unavailable'
  error?: string
}
