/**
 * CFTC Commitment of Traders (COT) data fetcher.
 *
 * Uses two free, no-auth-required government data files:
 *   TFF   — Traders in Financial Futures (FX pairs + stock indices)
 *           https://www.cftc.gov/dea/newcot/FinFutWk.txt
 *   DISAGG — Disaggregated Futures-Only (commodities: Gold, Silver)
 *           https://www.cftc.gov/dea/newcot/f_disagg.txt
 *
 * Both are updated every Friday with data as of the prior Tuesday.
 */

import type { COTReport, COTPositionGroup, COTBias } from '@/types/cot'

const TFF_URL    = 'https://www.cftc.gov/dea/newcot/FinFutWk.txt'
const DISAGG_URL = 'https://www.cftc.gov/dea/newcot/f_disagg.txt'

// Cache so we only hit CFTC once per deployment / revalidation window
let tffCache:    { data: string; ts: number } | null = null
let disaggCache: { data: string; ts: number } | null = null
const CACHE_TTL_MS = 4 * 60 * 60 * 1000  // 4 hours (data is weekly, refresh is plenty)

// ── CFTC contract codes ─────────────────────────────────────────────────────

interface InstrumentMeta {
  code: string
  source: 'tff' | 'disaggregated'
  /** True when the futures contract is the inverse of our pair symbol.
   *  E.g. JPY futures are JPY/USD but our symbol is USD/JPY.         */
  inverted: boolean
}

const INSTRUMENT_META: Record<string, InstrumentMeta> = {
  'EUR/USD': { code: '099741', source: 'tff',          inverted: false },
  'GBP/USD': { code: '096742', source: 'tff',          inverted: false },
  'USD/JPY': { code: '097741', source: 'tff',          inverted: true  },
  'USD/CHF': { code: '092741', source: 'tff',          inverted: true  },
  'AUD/USD': { code: '232741', source: 'tff',          inverted: false },
  'USD/CAD': { code: '090741', source: 'tff',          inverted: true  },
  'NZD/USD': { code: '112741', source: 'tff',          inverted: false },
  'XAU/USD': { code: '088691', source: 'disaggregated', inverted: false },
  'XAG/USD': { code: '084691', source: 'disaggregated', inverted: false },
  'NAS100':  { code: '209742', source: 'tff',          inverted: false },
  'US500':   { code: '13874A', source: 'tff',          inverted: false },
}

// ── CSV parser ──────────────────────────────────────────────────────────────

function parseCSVRow(line: string): string[] {
  const fields: string[] = []
  let inQuote = false
  let current = ''
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      inQuote = !inQuote
    } else if (ch === ',' && !inQuote) {
      fields.push(current.trim())
      current = ''
    } else {
      current += ch
    }
  }
  fields.push(current.trim())
  return fields
}

function parseCSV(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(Boolean)
  if (lines.length < 2) return { headers: [], rows: [] }

  const headers = parseCSVRow(lines[0]).map((h) => h.trim())
  const rows = lines.slice(1).map((line) => {
    const fields = parseCSVRow(line)
    const row: Record<string, string> = {}
    headers.forEach((h, i) => { row[h] = fields[i] ?? '' })
    return row
  })
  return { headers, rows }
}

// ── Data fetching with in-process cache ─────────────────────────────────────

async function fetchText(url: string, cacheRef: { current: { data: string; ts: number } | null }): Promise<string> {
  const now = Date.now()
  if (cacheRef.current && now - cacheRef.current.ts < CACHE_TTL_MS) {
    return cacheRef.current.data
  }
  const res = await fetch(url, { next: { revalidate: 14400 } })  // Next.js: revalidate every 4h
  if (!res.ok) throw new Error(`CFTC fetch failed: HTTP ${res.status}`)
  const text = await res.text()
  cacheRef.current = { data: text, ts: now }
  return text
}

// Wrapper objects so we can pass by reference
const tffRef    = { current: tffCache }
const disaggRef = { current: disaggCache }

// ── Position group extraction helpers ───────────────────────────────────────

function num(row: Record<string, string>, key: string): number {
  const val = row[key]
  if (val === undefined || val === '') return 0
  return parseFloat(val.replace(/,/g, '')) || 0
}

function extractTFFGroup(
  row: Record<string, string>,
  prefix: string,    // e.g. 'Dealer', 'Asset_Mgr', 'Lev_Money'
  oi: number
): COTPositionGroup {
  const longKey    = `${prefix}_Positions_Long_All`
  const shortKey   = `${prefix}_Positions_Short_All`
  const chgLongKey = `Change_in_${prefix}_Long_All`
  const chgShrtKey = `Change_in_${prefix}_Short_All`

  const long  = num(row, longKey)
  const short = num(row, shortKey)
  const net   = long - short
  const changeInLong  = num(row, chgLongKey)
  const changeInShort = num(row, chgShrtKey)
  const pctOfOI = oi > 0 ? ((long + short) / (oi * 2)) * 100 : 0

  return { long, short, net, changeInLong, changeInShort, changeInNet: changeInLong - changeInShort, pctOfOI }
}

function extractDisaggGroup(
  row: Record<string, string>,
  prefix: string,    // e.g. 'M_Money', 'Prod_Merc', 'Swap'
  oi: number
): COTPositionGroup {
  // Disaggregated uses slightly different naming (some have double underscore)
  const longKey    = `${prefix}_Positions_Long_All`
  const shortKey   = `${prefix}_Positions_Short_All`
  const chgLongKey = `Change_in_${prefix}_Long_All`
  const chgShrtKey = `Change_in_${prefix}_Short_All`

  const long  = num(row, longKey)
  const short = num(row, shortKey)
  const net   = long - short
  const changeInLong  = num(row, chgLongKey)
  const changeInShort = num(row, chgShrtKey)
  const pctOfOI = oi > 0 ? ((long + short) / (oi * 2)) * 100 : 0

  return { long, short, net, changeInLong, changeInShort, changeInNet: changeInLong - changeInShort, pctOfOI }
}

// ── Institutional score and bias ─────────────────────────────────────────────

function computeScore(primaryNet: number, oi: number, inverted: boolean): number {
  if (oi === 0) return 0
  // Normalise to -100..+100 relative to open interest
  let score = Math.max(-100, Math.min(100, (primaryNet / oi) * 500))
  if (inverted) score = -score
  return parseFloat(score.toFixed(1))
}

function scoreToBias(score: number): COTBias {
  if (score >=  50) return 'strongly_bullish'
  if (score >=  15) return 'bullish'
  if (score <= -50) return 'strongly_bearish'
  if (score <= -15) return 'bearish'
  return 'neutral'
}

// ── Public API ───────────────────────────────────────────────────────────────

export async function fetchCOT(symbol: string): Promise<COTReport> {
  const meta = INSTRUMENT_META[symbol]
  if (!meta) {
    return unavailable(symbol, `No CFTC mapping for ${symbol}`)
  }

  try {
    if (meta.source === 'tff') {
      return await fetchTFF(symbol, meta)
    } else {
      return await fetchDisagg(symbol, meta)
    }
  } catch (err) {
    return unavailable(symbol, err instanceof Error ? err.message : 'Fetch error')
  }
}

async function fetchTFF(symbol: string, meta: InstrumentMeta): Promise<COTReport> {
  const text = await fetchText(TFF_URL, tffRef)
  const { rows } = parseCSV(text)

  const row = rows.find((r) =>
    r['CFTC_Contract_Market_Code']?.trim() === meta.code
  )
  if (!row) return unavailable(symbol, `Code ${meta.code} not found in TFF report`)

  const oi = num(row, 'Open_Interest_All')
  const dealers      = extractTFFGroup(row, 'Dealer',    oi)
  const assetMgrs    = extractTFFGroup(row, 'Asset_Mgr', oi)
  const levMoney     = extractTFFGroup(row, 'Lev_Money', oi)

  const score = computeScore(assetMgrs.net, oi, meta.inverted)

  return {
    symbol,
    asOfDate:    row['As_of_Date_in_Form_YYYY-MM-DD'] ?? '',
    reportDate:  row['Report_Date_as_YYYY-MM-DD'] ?? '',
    openInterest: oi,
    dealers,
    assetManagers: assetMgrs,
    leveragedFunds: levMoney,
    institutionalScore: score,
    institutionalBias:  scoreToBias(score),
    primaryGroup: 'assetManagers',
    source: 'tff',
  }
}

async function fetchDisagg(symbol: string, meta: InstrumentMeta): Promise<COTReport> {
  const text = await fetchText(DISAGG_URL, disaggRef)
  const { rows } = parseCSV(text)

  const row = rows.find((r) =>
    r['CFTC_Contract_Market_Code']?.trim() === meta.code
  )
  if (!row) return unavailable(symbol, `Code ${meta.code} not found in Disaggregated report`)

  const oi = num(row, 'Open_Interest_All')
  // Swap has a double underscore in the actual CFTC file (quirk)
  const producers  = extractDisaggGroup(row, 'Prod_Merc', oi)
  const swapDlrs   = extractDisaggGroup(row, 'Swap_',     oi)   // "Swap__Positions_Long_All"
  const managed    = extractDisaggGroup(row, 'M_Money',   oi)

  // Fall back if Swap_ didn't match (handle both naming conventions)
  const swapFixed: COTPositionGroup = swapDlrs.long === 0 && swapDlrs.short === 0
    ? extractDisaggGroup(row, 'Swap', oi)
    : swapDlrs

  const score = computeScore(managed.net, oi, meta.inverted)

  return {
    symbol,
    asOfDate:    row['As_of_Date_in_Form_YYYY-MM-DD'] ?? '',
    reportDate:  row['Report_Date_as_YYYY-MM-DD'] ?? '',
    openInterest: oi,
    producers,
    swapDealers: swapFixed,
    managedMoney: managed,
    institutionalScore: score,
    institutionalBias:  scoreToBias(score),
    primaryGroup: 'managedMoney',
    source: 'disaggregated',
  }
}

function unavailable(symbol: string, error: string): COTReport {
  return {
    symbol,
    asOfDate: '',
    reportDate: '',
    openInterest: 0,
    institutionalScore: 0,
    institutionalBias: 'neutral',
    primaryGroup: 'assetManagers',
    source: 'unavailable',
    error,
  }
}
