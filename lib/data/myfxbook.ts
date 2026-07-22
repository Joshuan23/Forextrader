// Myfxbook Community Outlook — free retail positioning (the non-OANDA DOM).
// Shows, per pair, the % of retail traders long vs short and their average
// entry prices. Crowded positioning = liquidity: the losing side's stops
// cluster beyond their average price, which is what price hunts.
//
// Free: create a Myfxbook account, set MYFXBOOK_EMAIL / MYFXBOOK_PASSWORD.
// (Use a dedicated account — the password is stored as an env var.)
// API: login.json → session, then get-community-outlook.json?session=…

interface Session {
  token: string
  at: number
}
let cached: Session | null = null

export function isMyfxbookConfigured(): boolean {
  return Boolean(process.env.MYFXBOOK_EMAIL && process.env.MYFXBOOK_PASSWORD)
}

async function login(): Promise<string | null> {
  if (!isMyfxbookConfigured()) return null
  if (cached && Date.now() - cached.at < 30 * 60_000) return cached.token
  try {
    const url =
      `https://www.myfxbook.com/api/login.json?email=${encodeURIComponent(process.env.MYFXBOOK_EMAIL!)}` +
      `&password=${encodeURIComponent(process.env.MYFXBOOK_PASSWORD!)}`
    const res = await fetch(url, { signal: AbortSignal.timeout(8000), cache: 'no-store' })
    if (!res.ok) return null
    const data = (await res.json()) as { error?: boolean; session?: string; message?: string }
    if (data.error || !data.session) return null
    cached = { token: data.session, at: Date.now() }
    return data.session
  } catch {
    return null
  }
}

export interface RetailSentiment {
  symbol: string      // normalized "EUR/USD"
  longPct: number
  shortPct: number
  longPrice: number | null  // crowd average long entry
  shortPrice: number | null // crowd average short entry
  totalPositions: number
}

// Myfxbook returns "EURUSD" / "XAUUSD"; normalize to our "EUR/USD" style.
function normalize(name: string): string | null {
  const up = name.toUpperCase().replace(/[^A-Z0-9]/g, '')
  const known: Record<string, string> = {
    EURUSD: 'EUR/USD', GBPUSD: 'GBP/USD', USDJPY: 'USD/JPY', USDCHF: 'USD/CHF',
    AUDUSD: 'AUD/USD', USDCAD: 'USD/CAD', NZDUSD: 'NZD/USD', EURGBP: 'EUR/GBP',
    GBPJPY: 'GBP/JPY', XAUUSD: 'XAU/USD', GOLD: 'XAU/USD', XAGUSD: 'XAG/USD', SILVER: 'XAG/USD',
  }
  return known[up] ?? null
}

function num(v: unknown): number {
  const n = typeof v === 'string' ? parseFloat(v) : typeof v === 'number' ? v : NaN
  return Number.isFinite(n) ? n : NaN
}

export async function fetchRetailSentiment(): Promise<Record<string, RetailSentiment> | null> {
  const session = await login()
  if (!session) return null
  try {
    const res = await fetch(`https://www.myfxbook.com/api/get-community-outlook.json?session=${session}`, {
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return null
    const data = (await res.json()) as { error?: boolean; symbols?: Record<string, unknown>[] }
    if (data.error || !Array.isArray(data.symbols)) return null

    const out: Record<string, RetailSentiment> = {}
    for (const s of data.symbols) {
      const name = typeof s.name === 'string' ? s.name : ''
      const symbol = normalize(name)
      if (!symbol) continue
      const longPct = num(s.longPercentage)
      const shortPct = num(s.shortPercentage)
      if (Number.isNaN(longPct) && Number.isNaN(shortPct)) continue
      const lp = num(s.longPrice)
      const sp = num(s.shortPrice)
      out[symbol] = {
        symbol,
        longPct: Math.round((Number.isNaN(longPct) ? 100 - shortPct : longPct) * 10) / 10,
        shortPct: Math.round((Number.isNaN(shortPct) ? 100 - longPct : shortPct) * 10) / 10,
        longPrice: Number.isNaN(lp) ? null : lp,
        shortPrice: Number.isNaN(sp) ? null : sp,
        totalPositions: Math.round(num(s.totalPositions)) || 0,
      }
    }
    return Object.keys(out).length ? out : null
  } catch {
    return null
  }
}
