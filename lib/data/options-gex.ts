// Dealer Gamma Exposure (GEX) — computed from the live options chain.
//
// OANDA has no options data, so we pull the chain from Yahoo (open interest +
// implied vol per strike) and compute dealer gamma ourselves with Black-Scholes.
// Convention (SpotGamma-style): dealers are long call gamma, short put gamma,
// so a strike's NET GEX = callGEX − putGEX, in dollars per 1% move of spot.
//
//   GEX$ (per leg) = Γ · OI · 100 · S² · 0.01
//   Γ (Black-Scholes) = φ(d1) / (S · σ · √T)
//
// Gamma walls = the strikes with the largest +/- net GEX (price magnets).
// Flip level  = the strike where cumulative net GEX crosses zero (below it
//               dealers are short gamma → volatility expands; above → pins).

const YF_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept: 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  Origin: 'https://finance.yahoo.com',
  Referer: 'https://finance.yahoo.com/',
}

const RISK_FREE = 0.045
const YEAR_MS = 365.25 * 24 * 3600 * 1000

function normPdf(x: number): number {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI)
}

function bsGamma(S: number, K: number, T: number, iv: number): number {
  if (S <= 0 || K <= 0 || T <= 0 || iv <= 0) return 0
  const d1 = (Math.log(S / K) + (RISK_FREE + 0.5 * iv * iv) * T) / (iv * Math.sqrt(T))
  return normPdf(d1) / (S * iv * Math.sqrt(T))
}

export interface GexStrike {
  strike: number
  callGex: number   // $ (≥0)
  putGex: number    // $ (≥0 magnitude)
  netGex: number    // $ call − put
  callOi: number
  putOi: number
}

export interface GexResult {
  symbol: string
  spot: number
  expiry: string          // ISO of the expiry used
  expiryLabel: string     // e.g. 11/23
  expiries: { unix: number; label: string }[]
  asOf: number
  netGex: number          // total $ net GEX
  callWall: number | null // strike with max +net GEX
  putWall: number | null  // strike with min (most −) net GEX
  flip: number | null     // zero-gamma strike (approx)
  maxAbs: number          // largest |netGex| across strikes (for bar scaling)
  strikes: GexStrike[]    // descending by strike (high at top)
}

interface YfOption { strike: number; openInterest?: number; impliedVolatility?: number }
interface YfChain {
  optionChain?: {
    result?: {
      underlyingSymbol?: string
      expirationDates?: number[]
      quote?: { regularMarketPrice?: number }
      options?: { expirationDate?: number; calls?: YfOption[]; puts?: YfOption[] }[]
    }[]
    error?: unknown
  }
}

function labelOf(unixSec: number): string {
  const d = new Date(unixSec * 1000)
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`
}

export async function fetchGex(symbol: string, expiryUnix?: number, rangePct = 0.12): Promise<GexResult> {
  const sym = symbol.toUpperCase().trim()
  const url = `https://query1.finance.yahoo.com/v7/finance/options/${encodeURIComponent(sym)}${expiryUnix ? `?date=${expiryUnix}` : ''}`
  const res = await fetch(url, { headers: YF_HEADERS, signal: AbortSignal.timeout(8000), cache: 'no-store' })
  if (!res.ok) throw new Error(`Options chain HTTP ${res.status} for ${sym}`)
  const json = (await res.json()) as YfChain
  const result = json.optionChain?.result?.[0]
  const chain = result?.options?.[0]
  const spot = result?.quote?.regularMarketPrice
  if (!result || !chain || !spot) throw new Error(`No options chain for ${sym}`)

  const expSec = chain.expirationDate ?? result.expirationDates?.[0] ?? Math.floor(Date.now() / 1000)
  const T = Math.max((expSec * 1000 - Date.now()) / YEAR_MS, 0.25 / 365) // ≥ a few hours

  const lo = spot * (1 - rangePct)
  const hi = spot * (1 + rangePct)
  const byStrike = new Map<number, GexStrike>()
  const add = (leg: YfOption[] | undefined, side: 'call' | 'put') => {
    for (const o of leg ?? []) {
      if (o.strike < lo || o.strike > hi) continue
      const oi = o.openInterest ?? 0
      const iv = o.impliedVolatility ?? 0
      if (oi <= 0 || iv <= 0) continue
      const gamma = bsGamma(spot, o.strike, T, iv)
      const gex = gamma * oi * 100 * spot * spot * 0.01 // $ per 1% move
      const row = byStrike.get(o.strike) ?? { strike: o.strike, callGex: 0, putGex: 0, netGex: 0, callOi: 0, putOi: 0 }
      if (side === 'call') { row.callGex += gex; row.callOi += oi }
      else { row.putGex += gex; row.putOi += oi }
      byStrike.set(o.strike, row)
    }
  }
  add(chain.calls, 'call')
  add(chain.puts, 'put')

  const rows = [...byStrike.values()]
  for (const r of rows) r.netGex = r.callGex - r.putGex
  if (!rows.length) throw new Error(`No open interest near spot for ${sym}`)

  // Gamma walls
  let callWall: number | null = null, putWall: number | null = null
  let maxPos = 0, maxNeg = 0
  for (const r of rows) {
    if (r.netGex > maxPos) { maxPos = r.netGex; callWall = r.strike }
    if (r.netGex < maxNeg) { maxNeg = r.netGex; putWall = r.strike }
  }
  // Flip level: cumulative net GEX (ascending strike) sign change.
  const asc = [...rows].sort((a, b) => a.strike - b.strike)
  let cum = 0, flip: number | null = null, prevCum = 0, prevK = asc[0]?.strike
  for (const r of asc) {
    prevCum = cum
    cum += r.netGex
    if (prevCum < 0 && cum >= 0) {
      // linear interpolate between prevK and r.strike
      const frac = prevCum === cum ? 0 : -prevCum / (cum - prevCum)
      flip = Math.round((prevK + frac * (r.strike - prevK)) * 100) / 100
    }
    prevK = r.strike
  }

  const netGex = rows.reduce((s, r) => s + r.netGex, 0)
  const maxAbs = Math.max(...rows.map((r) => Math.abs(r.netGex)), 1)

  return {
    symbol: sym,
    spot: Math.round(spot * 100) / 100,
    expiry: new Date(expSec * 1000).toISOString(),
    expiryLabel: labelOf(expSec),
    expiries: (result.expirationDates ?? []).slice(0, 12).map((u) => ({ unix: u, label: labelOf(u) })),
    asOf: Date.now(),
    netGex: Math.round(netGex),
    callWall,
    putWall,
    flip,
    maxAbs,
    strikes: rows.sort((a, b) => b.strike - a.strike), // high → low for display
  }
}
