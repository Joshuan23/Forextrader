// Dealer Gamma Exposure (GEX) — computed from the live options chain.
//
// OANDA has no options data. Primary source: CBOE's free delayed-quotes feed
// (the exchange itself — no key, includes open interest, IV and GAMMA per
// contract). Fallback: Yahoo's options chain, which now requires a cookie +
// "crumb" handshake (requests without it return HTTP 401).
//
// Convention (SpotGamma-style): dealers are long call gamma, short put gamma,
// so a strike's NET GEX = callGEX − putGEX, in dollars per 1% move of spot.
//
//   GEX$ (per leg) = Γ · OI · 100 · S² · 0.01
//   Γ = exchange-supplied gamma, else Black-Scholes φ(d1) / (S · σ · √T)
//
// Gamma walls = the strikes with the largest +/- net GEX (price magnets).
// Flip level  = the strike where cumulative net GEX crosses zero (below it
//               dealers are short gamma → volatility expands; above → pins).

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

const RISK_FREE = 0.045
const YEAR_MS = 365.25 * 24 * 3600 * 1000
const CLOSE_UTC_HOUR = 21 // ~4pm ET: options expire at the close

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
  source: 'CBOE' | 'Yahoo'
  spot: number
  spotLive: boolean       // true when spot came from the live (real-time) feed
  spotAsOf: number        // ms timestamp of the spot price
  chainAsOf: string | null // when the exchange last published the chain (OI/IV)
  session: MarketSession  // pre / regular / post / closed
  chainCachedAt: number   // ms — when this server last pulled the chain
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

// Normalized chain the GEX math runs on (one expiry).
interface Leg { strike: number; side: 'call' | 'put'; oi: number; iv: number; gamma?: number }
export type MarketSession = 'pre' | 'regular' | 'post' | 'closed'
interface Chain { source: GexResult['source']; spot: number; spotLive?: boolean; spotAsOf?: number; session?: MarketSession; chainAsOf?: string | null; cachedAt?: number; expSec: number; expiries: number[]; legs: Leg[] }

const dayKey = (unixSec: number) => new Date(unixSec * 1000).toISOString().slice(0, 10)

function labelOf(unixSec: number): string {
  const d = new Date(unixSec * 1000)
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`
}

// Pick the requested expiry (matched by calendar day so values round-trip
// across sources) or the nearest one that hasn't expired yet.
function chooseExpiry(expiries: number[], requested?: number): number | undefined {
  const sorted = [...expiries].sort((a, b) => a - b)
  if (requested) {
    const hit = sorted.find((e) => dayKey(e) === dayKey(requested))
    if (hit) return hit
  }
  const now = Date.now() / 1000
  return sorted.find((e) => e > now) ?? sorted[sorted.length - 1]
}

// ── CBOE (primary) ──────────────────────────────────────────────────
interface CboeOption { option: string; iv?: number; open_interest?: number; gamma?: number }
interface CboeResp { timestamp?: string; data?: { current_price?: number; options?: CboeOption[] } }

const CBOE_INDEX = new Set(['SPX', 'NDX', 'RUT', 'VIX', 'XSP', 'DJX'])

async function fromCboe(sym: string, expiryUnix?: number): Promise<Chain> {
  const code = CBOE_INDEX.has(sym) ? `_${sym}` : sym
  const res = await fetch(`https://cdn.cboe.com/api/global/delayed_quotes/options/${code}.json`, {
    headers: { 'User-Agent': UA, Accept: 'application/json' },
    signal: AbortSignal.timeout(10000),
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`CBOE HTTP ${res.status}`)
  const json = (await res.json()) as CboeResp
  const spot = json.data?.current_price
  const opts = json.data?.options ?? []
  if (!spot || !opts.length) throw new Error('CBOE returned no chain')

  // OCC symbol: ROOT + YYMMDD + C/P + strike×1000 (8 digits)
  const parsed: (Leg & { expSec: number })[] = []
  for (const o of opts) {
    const m = /^(.+?)(\d{2})(\d{2})(\d{2})([CP])(\d{8})$/.exec(o.option)
    if (!m) continue
    const expSec = Date.UTC(2000 + Number(m[2]), Number(m[3]) - 1, Number(m[4]), CLOSE_UTC_HOUR) / 1000
    parsed.push({
      expSec,
      strike: Number(m[6]) / 1000,
      side: m[5] === 'C' ? 'call' : 'put',
      oi: o.open_interest ?? 0,
      iv: o.iv ?? 0,
      gamma: o.gamma,
    })
  }
  const expiries = [...new Set(parsed.map((p) => p.expSec))]
  const expSec = chooseExpiry(expiries, expiryUnix)
  if (!expSec) throw new Error('CBOE chain has no expiries')
  return {
    source: 'CBOE',
    spot,
    chainAsOf: json.timestamp ?? null,
    expSec,
    expiries: expiries.filter((e) => e >= Date.now() / 1000 - 86400).sort((a, b) => a - b),
    legs: parsed.filter((p) => p.expSec === expSec),
  }
}

// ── Yahoo (fallback, needs cookie + crumb) ──────────────────────────
interface YfOption { strike: number; openInterest?: number; impliedVolatility?: number }
interface YfChain {
  optionChain?: {
    result?: {
      expirationDates?: number[]
      quote?: { regularMarketPrice?: number }
      options?: { expirationDate?: number; calls?: YfOption[]; puts?: YfOption[] }[]
    }[]
  }
}

let yfSession: { cookie: string; crumb: string; at: number } | null = null

async function yahooSession(): Promise<{ cookie: string; crumb: string }> {
  if (yfSession && Date.now() - yfSession.at < 30 * 60_000) return yfSession
  const seed = await fetch('https://fc.yahoo.com', { headers: { 'User-Agent': UA }, redirect: 'manual', signal: AbortSignal.timeout(6000) })
  const setCookies = typeof seed.headers.getSetCookie === 'function' ? seed.headers.getSetCookie() : [seed.headers.get('set-cookie') ?? '']
  const cookie = setCookies.map((c) => c.split(';')[0]).filter(Boolean).join('; ')
  if (!cookie) throw new Error('Yahoo gave no session cookie')
  const crumbRes = await fetch('https://query2.finance.yahoo.com/v1/test/getcrumb', {
    headers: { 'User-Agent': UA, Cookie: cookie },
    signal: AbortSignal.timeout(6000),
  })
  const crumb = (await crumbRes.text()).trim()
  if (!crumbRes.ok || !crumb || crumb.includes('<')) throw new Error(`Yahoo crumb HTTP ${crumbRes.status}`)
  yfSession = { cookie, crumb, at: Date.now() }
  return yfSession
}

async function fromYahoo(sym: string, expiryUnix?: number): Promise<Chain> {
  const { cookie, crumb } = await yahooSession()
  // Yahoo keys expiries at 00:00 UTC of the expiry day.
  const date = expiryUnix ? `&date=${Date.parse(`${dayKey(expiryUnix)}T00:00:00Z`) / 1000}` : ''
  const res = await fetch(
    `https://query2.finance.yahoo.com/v7/finance/options/${encodeURIComponent(sym)}?crumb=${encodeURIComponent(crumb)}${date}`,
    { headers: { 'User-Agent': UA, Cookie: cookie, Accept: 'application/json' }, signal: AbortSignal.timeout(8000), cache: 'no-store' }
  )
  if (!res.ok) {
    if (res.status === 401) yfSession = null // stale crumb — refresh next time
    throw new Error(`Yahoo HTTP ${res.status}`)
  }
  const json = (await res.json()) as YfChain
  const result = json.optionChain?.result?.[0]
  const chain = result?.options?.[0]
  const spot = result?.quote?.regularMarketPrice
  if (!result || !chain || !spot) throw new Error('Yahoo returned no chain')
  const expSec = chain.expirationDate ?? result.expirationDates?.[0] ?? Math.floor(Date.now() / 1000)
  const legs: Leg[] = [
    ...(chain.calls ?? []).map((o) => ({ strike: o.strike, side: 'call' as const, oi: o.openInterest ?? 0, iv: o.impliedVolatility ?? 0 })),
    ...(chain.puts ?? []).map((o) => ({ strike: o.strike, side: 'put' as const, oi: o.openInterest ?? 0, iv: o.impliedVolatility ?? 0 })),
  ]
  return { source: 'Yahoo', spot, expSec, expiries: result.expirationDates ?? [expSec], legs }
}

// ── Live spot (real-time, incl. pre/after-hours) ────────────────────
// Yahoo's chart endpoint is crumb-free. We take the NEWEST trade — the last
// 1-minute bar including pre/post-market — so the price keeps moving outside
// 9:30–4:00, and read Yahoo's trading periods to label the session.
const YF_INDEX: Record<string, string> = { SPX: '^GSPC', NDX: '^NDX', RUT: '^RUT', VIX: '^VIX', DJX: '^DJI' }

interface Period { start: number; end: number }
interface YfChart {
  chart?: {
    result?: {
      meta?: {
        regularMarketPrice?: number
        regularMarketTime?: number
        currentTradingPeriod?: { pre?: Period; regular?: Period; post?: Period }
      }
      timestamp?: number[]
      indicators?: { quote?: { close?: (number | null)[] }[] }
    }[]
  }
}

interface LiveSpot { price: number; asOf: number; session: MarketSession }
const spotCache = new Map<string, { at: number; v: LiveSpot }>()
const SPOT_TTL = 3_000 // shared across viewers; Yahoo itself updates ~every few seconds

async function liveSpot(sym: string): Promise<LiveSpot> {
  const hit = spotCache.get(sym)
  if (hit && Date.now() - hit.at < SPOT_TTL) return hit.v
  const t = YF_INDEX[sym] ?? sym
  const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(t)}?interval=1m&range=1d&includePrePost=true`, {
    headers: { 'User-Agent': UA, Accept: 'application/json' },
    signal: AbortSignal.timeout(5000),
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`live spot HTTP ${res.status}`)
  const r = ((await res.json()) as YfChart).chart?.result?.[0]
  const meta = r?.meta
  if (!meta?.regularMarketPrice) throw new Error('no live spot')

  let price = meta.regularMarketPrice
  let asOf = (meta.regularMarketTime ?? 0) * 1000
  // Newest 1-minute bar (covers pre/post-market) wins if it's more recent.
  const ts = r?.timestamp ?? []
  const closes = r?.indicators?.quote?.[0]?.close ?? []
  for (let i = ts.length - 1; i >= 0; i--) {
    const c = closes[i]
    if (c != null && Number.isFinite(c)) {
      if (ts[i] * 1000 > asOf) { price = c; asOf = ts[i] * 1000 }
      break
    }
  }

  const now = Date.now() / 1000
  const p = meta.currentTradingPeriod
  const within = (x?: Period) => !!x && now >= x.start && now < x.end
  const session: MarketSession = within(p?.regular) ? 'regular' : within(p?.pre) ? 'pre' : within(p?.post) ? 'post' : 'closed'

  const v = { price, asOf: asOf || Date.now(), session }
  spotCache.set(sym, { at: Date.now(), v })
  return v
}

// ── Chain cache ─────────────────────────────────────────────────────
// The chain (OI/IV) is large and only changes slowly, so we hold it for a
// minute; every request still re-prices gamma at the live spot. That's what
// lets the page refresh every few seconds without re-downloading the chain.
const chainCache = new Map<string, { at: number; chain: Chain }>()
const CHAIN_TTL = 60_000

async function cachedChain(
  name: string,
  load: (sym: string, exp?: number) => Promise<Chain>,
  sym: string,
  exp?: number
): Promise<Chain> {
  const key = `${name}:${sym}:${exp ?? ''}`
  const hit = chainCache.get(key)
  if (hit && Date.now() - hit.at < CHAIN_TTL) return hit.chain
  const chain = { ...(await load(sym, exp)), cachedAt: Date.now() }
  chainCache.set(key, { at: Date.now(), chain })
  if (chainCache.size > 50) chainCache.delete(chainCache.keys().next().value as string)
  return chain
}

// ── GEX math (source-agnostic) ──────────────────────────────────────
export function computeGex(sym: string, c: Chain, rangePct = 0.12): GexResult {
  const { spot } = c
  const T = Math.max((c.expSec * 1000 - Date.now()) / YEAR_MS, 15 / (60 * 24 * 365)) // ≥ 15 min (0DTE gamma stays realistic)
  const lo = spot * (1 - rangePct)
  const hi = spot * (1 + rangePct)

  const byStrike = new Map<number, GexStrike>()
  for (const l of c.legs) {
    if (l.strike < lo || l.strike > hi || l.oi <= 0) continue
    // Live spot → re-price gamma at the current price (exchange gamma is as
    // stale as its spot). Otherwise prefer the exchange's own gamma.
    const model = bsGamma(spot, l.strike, T, l.iv)
    const gamma = c.spotLive ? (model > 0 ? model : l.gamma ?? 0) : (l.gamma && l.gamma > 0 ? l.gamma : model)
    if (gamma <= 0) continue
    const gex = gamma * l.oi * 100 * spot * spot * 0.01 // $ per 1% move
    const row = byStrike.get(l.strike) ?? { strike: l.strike, callGex: 0, putGex: 0, netGex: 0, callOi: 0, putOi: 0 }
    if (l.side === 'call') { row.callGex += gex; row.callOi += l.oi }
    else { row.putGex += gex; row.putOi += l.oi }
    byStrike.set(l.strike, row)
  }

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
  // Flip level: cumulative net GEX (ascending strike) crossing up through zero.
  const asc = [...rows].sort((a, b) => a.strike - b.strike)
  let cum = 0, flip: number | null = null, prevK = asc[0]?.strike
  for (const r of asc) {
    const prevCum = cum
    cum += r.netGex
    if (prevCum < 0 && cum >= 0) {
      const frac = -prevCum / (cum - prevCum)
      flip = Math.round((prevK + frac * (r.strike - prevK)) * 100) / 100
    }
    prevK = r.strike
  }

  const netGex = rows.reduce((s, r) => s + r.netGex, 0)
  const maxAbs = Math.max(...rows.map((r) => Math.abs(r.netGex)), 1)

  return {
    symbol: sym,
    source: c.source,
    spot: Math.round(spot * 100) / 100,
    spotLive: !!c.spotLive,
    spotAsOf: c.spotAsOf ?? Date.now(),
    chainAsOf: c.chainAsOf ?? null,
    session: c.session ?? 'closed',
    chainCachedAt: c.cachedAt ?? Date.now(),
    expiry: new Date(c.expSec * 1000).toISOString(),
    expiryLabel: labelOf(c.expSec),
    expiries: c.expiries.slice(0, 12).map((u) => ({ unix: u, label: labelOf(u) })),
    asOf: Date.now(),
    netGex: Math.round(netGex),
    callWall,
    putWall,
    flip,
    maxAbs,
    strikes: rows.sort((a, b) => b.strike - a.strike), // high → low for display
  }
}

export async function fetchGex(symbol: string, expiryUnix?: number): Promise<GexResult> {
  const sym = symbol.toUpperCase().trim()
  const errors: string[] = []
  const live = liveSpot(sym).catch(() => null)
  const sources: [string, (s: string, e?: number) => Promise<Chain>][] = [['cboe', fromCboe], ['yahoo', fromYahoo]]
  for (const [name, load] of sources) {
    try {
      const chain = await cachedChain(name, load, sym, expiryUnix)
      const spot = await live
      return computeGex(
        sym,
        spot ? { ...chain, spot: spot.price, spotLive: true, spotAsOf: spot.asOf, session: spot.session } : chain
      )
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e))
    }
  }
  throw new Error(`No options data for ${sym} (${errors.join(' · ')})`)
}
