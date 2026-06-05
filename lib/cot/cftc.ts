/**
 * CFTC Commitment of Traders (COT) data fetcher.
 *
 * Uses two free, no-auth-required government data files:
 *   TFF   — Traders in Financial Futures (FX pairs + stock indices)
 *           https://www.cftc.gov/dea/newcot/FinFutWk.txt
 *   DISAGG — Disaggregated Futures-Only (commodities: Gold, Silver)
 *           https://www.cftc.gov/dea/newcot/f_disagg.txt
 *
 * Both files have NO header row — data starts on line 1.
 * Columns are parsed by fixed position (verified against live CFTC data).
 *
 * TFF column map (87 cols):
 *   [2] report date YYYY-MM-DD   [3] contract code   [7] open interest
 *   Dealer:    long=[8]  short=[9]   chgLong=[25] chgShort=[26]
 *   AssetMgr:  long=[11] short=[12]  chgLong=[28] chgShort=[29]
 *   LevMoney:  long=[14] short=[15]  chgLong=[31] chgShort=[32]
 *
 * Disagg column map (191 cols):
 *   [2] report date YYYY-MM-DD   [3] contract code   [7] open interest
 *   ProdMerc:  long=[8]  short=[9]   chgLong=[56] chgShort=[57]
 *   Swap:      long=[11] short=[12]  chgLong=[59] chgShort=[60]
 *   MMoney:    long=[14] short=[15]  chgLong=[62] chgShort=[63]
 */

import type { COTReport, COTPositionGroup, COTBias } from '@/types/cot'

const TFF_URL    = 'https://www.cftc.gov/dea/newcot/FinFutWk.txt'
const DISAGG_URL = 'https://www.cftc.gov/dea/newcot/f_disagg.txt'

// Cache so we only hit CFTC once per deployment / revalidation window
let tffCache:    { data: string[][]; ts: number } | null = null
let disaggCache: { data: string[][]; ts: number } | null = null
const CACHE_TTL_MS = 4 * 60 * 60 * 1000

// ── CFTC contract codes ─────────────────────────────────────────────────────

interface InstrumentMeta {
  code: string
  source: 'tff' | 'disaggregated'
  inverted: boolean
}

const INSTRUMENT_META: Record<string, InstrumentMeta> = {
  'EUR/USD': { code: '099741', source: 'tff',           inverted: false },
  'GBP/USD': { code: '096742', source: 'tff',           inverted: false },
  'USD/JPY': { code: '097741', source: 'tff',           inverted: true  },
  'USD/CHF': { code: '092741', source: 'tff',           inverted: true  },
  'AUD/USD': { code: '232741', source: 'tff',           inverted: false },
  'USD/CAD': { code: '090741', source: 'tff',           inverted: true  },
  'NZD/USD': { code: '112741', source: 'tff',           inverted: false },
  'XAU/USD': { code: '088691', source: 'disaggregated', inverted: false },
  'XAG/USD': { code: '084691', source: 'disaggregated', inverted: false },
  'NAS100':  { code: '209742', source: 'tff',           inverted: false },
  'US500':   { code: '13874A', source: 'tff',           inverted: false },
}

// ── CSV row parser ──────────────────────────────────────────────────────────

function parseRow(line: string): string[] {
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

function parseRows(text: string): string[][] {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .filter(Boolean)
    .map(parseRow)
}

// ── Fetch helpers ───────────────────────────────────────────────────────────

async function fetchParsed(
  url: string,
  cacheRef: { current: { data: string[][]; ts: number } | null }
): Promise<string[][]> {
  const now = Date.now()
  if (cacheRef.current && now - cacheRef.current.ts < CACHE_TTL_MS) {
    return cacheRef.current.data
  }
  const res = await fetch(url, { next: { revalidate: 14400 } })
  if (!res.ok) throw new Error(`CFTC fetch failed: HTTP ${res.status}`)
  const data = parseRows(await res.text())
  cacheRef.current = { data, ts: now }
  return data
}

const tffRef    = { current: tffCache }
const disaggRef = { current: disaggCache }

// ── Positional field extractor ───────────────────────────────────────────────

function n(fields: string[], idx: number): number {
  const v = fields[idx] ?? ''
  if (v === '' || v === '.') return 0
  return parseFloat(v.replace(/,/g, '')) || 0
}

function makeGroup(
  fields: string[],
  longIdx: number,
  shortIdx: number,
  chgLongIdx: number,
  chgShortIdx: number,
  oi: number
): COTPositionGroup {
  const long  = n(fields, longIdx)
  const short = n(fields, shortIdx)
  const net   = long - short
  const changeInLong  = n(fields, chgLongIdx)
  const changeInShort = n(fields, chgShortIdx)
  const pctOfOI = oi > 0 ? ((long + short) / (oi * 2)) * 100 : 0
  return { long, short, net, changeInLong, changeInShort, changeInNet: changeInLong - changeInShort, pctOfOI }
}

// ── Institutional score and bias ─────────────────────────────────────────────

function computeScore(primaryNet: number, oi: number, inverted: boolean): number {
  if (oi === 0) return 0
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
  if (!meta) return unavailable(symbol, `No CFTC mapping for ${symbol}`)

  try {
    return meta.source === 'tff'
      ? await fetchTFF(symbol, meta)
      : await fetchDisagg(symbol, meta)
  } catch (err) {
    return unavailable(symbol, err instanceof Error ? err.message : 'Fetch error')
  }
}

async function fetchTFF(symbol: string, meta: InstrumentMeta): Promise<COTReport> {
  const rows = await fetchParsed(TFF_URL, tffRef)
  // Contract code is at column index 3 in every data row
  const row = rows.find((r) => r[3]?.trim() === meta.code)
  if (!row) return unavailable(symbol, `Code ${meta.code} not found in TFF report`)

  const oi = n(row, 7)
  const dealers   = makeGroup(row,  8,  9, 25, 26, oi)
  const assetMgrs = makeGroup(row, 11, 12, 28, 29, oi)
  const levMoney  = makeGroup(row, 14, 15, 31, 32, oi)

  const score = computeScore(assetMgrs.net, oi, meta.inverted)

  return {
    symbol,
    asOfDate:     row[2] ?? '',
    reportDate:   row[2] ?? '',
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
  const rows = await fetchParsed(DISAGG_URL, disaggRef)
  const row = rows.find((r) => r[3]?.trim() === meta.code)
  if (!row) return unavailable(symbol, `Code ${meta.code} not found in Disaggregated report`)

  const oi = n(row, 7)
  const producers  = makeGroup(row,  8,  9, 56, 57, oi)
  const swapDealers = makeGroup(row, 11, 12, 59, 60, oi)
  const managed    = makeGroup(row, 14, 15, 62, 63, oi)

  const score = computeScore(managed.net, oi, meta.inverted)

  return {
    symbol,
    asOfDate:     row[2] ?? '',
    reportDate:   row[2] ?? '',
    openInterest: oi,
    producers,
    swapDealers,
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
