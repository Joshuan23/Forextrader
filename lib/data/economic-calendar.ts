import type { EconomicEventLite, MacroRisk } from '@/lib/engine/types'

// Economic calendar provider.
//
// Real providers (ForexFactory scrape, Finnhub, FMP, EODHD…) can be plugged
// in behind fetchCalendarEvents(). Without an API key we fall back to a
// deterministic mock calendar that mirrors the real weekly cadence of
// tier-1 releases (NFP first Friday, CPI mid-month, FOMC/ECB/BoE weeks,
// daily tier-2 data at realistic UTC times) so blackout and downgrade
// logic behaves exactly as it would in production.

interface TemplateEvent {
  title: string
  currency: string
  impact: MacroRisk
  utcHour: number
  utcMinute: number
  isCentralBank?: boolean
  // predicate on the date (UTC) deciding whether this event occurs that day
  occurs: (d: Date) => boolean
}

const nthWeekdayOfMonth = (d: Date, weekday: number): number => {
  // which occurrence of this weekday is `d` within its month (1-based)
  if (d.getUTCDay() !== weekday) return 0
  return Math.ceil(d.getUTCDate() / 7)
}

const TEMPLATE: TemplateEvent[] = [
  // ── Tier 1 — recurring monthly anchors ──
  { title: 'US Non-Farm Payrolls', currency: 'USD', impact: 'high', utcHour: 12, utcMinute: 30,
    occurs: (d) => nthWeekdayOfMonth(d, 5) === 1 },
  { title: 'US CPI (YoY)', currency: 'USD', impact: 'high', utcHour: 12, utcMinute: 30,
    occurs: (d) => nthWeekdayOfMonth(d, 2) === 2 },
  { title: 'FOMC Rate Decision', currency: 'USD', impact: 'high', utcHour: 18, utcMinute: 0, isCentralBank: true,
    occurs: (d) => nthWeekdayOfMonth(d, 3) === 3 },
  { title: 'FOMC Press Conference', currency: 'USD', impact: 'high', utcHour: 18, utcMinute: 30, isCentralBank: true,
    occurs: (d) => nthWeekdayOfMonth(d, 3) === 3 },
  { title: 'ECB Rate Decision', currency: 'EUR', impact: 'high', utcHour: 12, utcMinute: 15, isCentralBank: true,
    occurs: (d) => nthWeekdayOfMonth(d, 4) === 2 },
  { title: 'BoE Rate Decision', currency: 'GBP', impact: 'high', utcHour: 11, utcMinute: 0, isCentralBank: true,
    occurs: (d) => nthWeekdayOfMonth(d, 4) === 1 },
  { title: 'BoJ Policy Statement', currency: 'JPY', impact: 'high', utcHour: 3, utcMinute: 0, isCentralBank: true,
    occurs: (d) => nthWeekdayOfMonth(d, 5) === 3 },
  { title: 'UK CPI (YoY)', currency: 'GBP', impact: 'high', utcHour: 6, utcMinute: 0,
    occurs: (d) => nthWeekdayOfMonth(d, 3) === 2 },
  { title: 'Eurozone Flash CPI', currency: 'EUR', impact: 'high', utcHour: 9, utcMinute: 0,
    occurs: (d) => d.getUTCDate() <= 3 && d.getUTCDay() >= 1 && d.getUTCDay() <= 5 && d.getUTCDate() === 1 },
  { title: 'US Retail Sales (MoM)', currency: 'USD', impact: 'high', utcHour: 12, utcMinute: 30,
    occurs: (d) => nthWeekdayOfMonth(d, 4) === 3 },
  { title: 'RBA Rate Decision', currency: 'AUD', impact: 'high', utcHour: 4, utcMinute: 30, isCentralBank: true,
    occurs: (d) => nthWeekdayOfMonth(d, 2) === 1 },
  { title: 'BoC Rate Decision', currency: 'CAD', impact: 'high', utcHour: 13, utcMinute: 45, isCentralBank: true,
    occurs: (d) => nthWeekdayOfMonth(d, 3) === 2 },

  // ── Tier 2 — weekly rhythm ──
  { title: 'US Initial Jobless Claims', currency: 'USD', impact: 'medium', utcHour: 12, utcMinute: 30,
    occurs: (d) => d.getUTCDay() === 4 },
  { title: 'US ISM Services PMI', currency: 'USD', impact: 'medium', utcHour: 14, utcMinute: 0,
    occurs: (d) => nthWeekdayOfMonth(d, 3) === 1 },
  { title: 'German IFO Business Climate', currency: 'EUR', impact: 'medium', utcHour: 9, utcMinute: 0,
    occurs: (d) => nthWeekdayOfMonth(d, 1) === 4 },
  { title: 'German ZEW Sentiment', currency: 'EUR', impact: 'medium', utcHour: 9, utcMinute: 0,
    occurs: (d) => nthWeekdayOfMonth(d, 2) === 3 },
  { title: 'UK Retail Sales (MoM)', currency: 'GBP', impact: 'medium', utcHour: 6, utcMinute: 0,
    occurs: (d) => nthWeekdayOfMonth(d, 5) === 3 },
  { title: 'Australia Employment Change', currency: 'AUD', impact: 'medium', utcHour: 1, utcMinute: 30,
    occurs: (d) => nthWeekdayOfMonth(d, 4) === 2 },
  { title: 'Canada Employment Change', currency: 'CAD', impact: 'medium', utcHour: 12, utcMinute: 30,
    occurs: (d) => nthWeekdayOfMonth(d, 5) === 1 },
  { title: 'Japan Tokyo CPI', currency: 'JPY', impact: 'medium', utcHour: 23, utcMinute: 30,
    occurs: (d) => nthWeekdayOfMonth(d, 5) === 4 },
  { title: 'Swiss CPI (MoM)', currency: 'CHF', impact: 'medium', utcHour: 6, utcMinute: 30,
    occurs: (d) => d.getUTCDate() <= 7 && d.getUTCDay() === 1 },
  { title: 'NZ GDT Dairy Auction', currency: 'NZD', impact: 'low', utcHour: 14, utcMinute: 0,
    occurs: (d) => d.getUTCDay() === 2 && nthWeekdayOfMonth(d, 2) % 2 === 1 },
  { title: 'US Crude Oil Inventories', currency: 'USD', impact: 'low', utcHour: 14, utcMinute: 30,
    occurs: (d) => d.getUTCDay() === 3 },
  { title: 'Fed Speakers (various)', currency: 'USD', impact: 'low', utcHour: 16, utcMinute: 0,
    occurs: (d) => d.getUTCDay() === 1 || d.getUTCDay() === 3 },
]

function mockEventsForDay(day: Date): EconomicEventLite[] {
  const out: EconomicEventLite[] = []
  for (const t of TEMPLATE) {
    if (!t.occurs(day)) continue
    const ts = Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), t.utcHour, t.utcMinute)
    out.push({
      id: `mock-${t.currency}-${t.title.replace(/\W+/g, '_')}-${ts}`,
      title: t.title,
      currency: t.currency,
      impact: t.impact,
      scheduledAt: ts,
      isCentralBank: Boolean(t.isCentralBank),
    })
  }
  return out
}

export function getMockCalendar(fromMs: number, toMs: number): EconomicEventLite[] {
  const events: EconomicEventLite[] = []
  const cursor = new Date(fromMs)
  cursor.setUTCHours(0, 0, 0, 0)
  while (cursor.getTime() <= toMs) {
    events.push(...mockEventsForDay(cursor))
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return events
    .filter((e) => e.scheduledAt >= fromMs && e.scheduledAt <= toMs)
    .sort((a, b) => a.scheduledAt - b.scheduledAt)
}

// ── Real provider: Finnhub economic calendar ─────────────────────────
// https://finnhub.io/docs/api/economic-calendar — CALENDAR_API_KEY is a
// Finnhub API key. Impact mapping: high/medium/low come straight from the
// feed; central-bank detection is keyword-based on the release title.

const CB_PATTERN = /rate decision|interest rate|fomc|ecb|boe|boj|rba|boc|snb|central bank|monetary policy|press conference/i

interface FinnhubEvent {
  country?: string
  event?: string
  impact?: string
  time?: string
  unit?: string
  estimate?: number | null
  prev?: number | null
  actual?: number | null
}

const COUNTRY_TO_CCY: Record<string, string> = {
  US: 'USD', EU: 'EUR', DE: 'EUR', FR: 'EUR', IT: 'EUR', ES: 'EUR',
  GB: 'GBP', UK: 'GBP', JP: 'JPY', AU: 'AUD', NZ: 'NZD', CA: 'CAD', CH: 'CHF', CN: 'CNY',
}

async function fetchFinnhubCalendar(fromMs: number, toMs: number, apiKey: string): Promise<EconomicEventLite[]> {
  const from = new Date(fromMs).toISOString().slice(0, 10)
  const to = new Date(toMs).toISOString().slice(0, 10)
  const url = `https://finnhub.io/api/v1/calendar/economic?from=${from}&to=${to}&token=${apiKey}`
  const res = await fetch(url, { signal: AbortSignal.timeout(10_000), cache: 'no-store' })
  if (!res.ok) throw new Error(`Economic calendar provider failed: HTTP ${res.status}`)
  const data = (await res.json()) as { economicCalendar?: FinnhubEvent[] }

  return (data.economicCalendar ?? [])
    .map((e): EconomicEventLite | null => {
      const currency = COUNTRY_TO_CCY[e.country ?? ''] ?? null
      const ts = e.time ? Date.parse(e.time) : NaN
      if (!currency || !e.event || Number.isNaN(ts)) return null
      const impact: MacroRisk =
        e.impact === 'high' ? 'high' : e.impact === 'medium' ? 'medium' : 'low'
      return {
        id: `fh-${currency}-${e.event.replace(/\W+/g, '_')}-${ts}`,
        title: e.event,
        currency,
        impact,
        scheduledAt: ts,
        isCentralBank: CB_PATTERN.test(e.event),
      }
    })
    .filter((e): e is EconomicEventLite => e !== null)
    .filter((e) => e.scheduledAt >= fromMs && e.scheduledAt <= toMs)
    .sort((a, b) => a.scheduledAt - b.scheduledAt)
}

// Provider entry point — selected by environment:
//   CALENDAR_API_KEY set        → real Finnhub calendar
//   DEVELOPMENT_DEMO_MODE=true  → deterministic template calendar
//   neither, in production      → fail loudly (blackout logic must never
//                                 run silently on fake event times)
export async function fetchCalendarEvents(fromMs: number, toMs: number): Promise<EconomicEventLite[]> {
  const apiKey = process.env.CALENDAR_API_KEY
  if (apiKey) {
    try {
      return await fetchFinnhubCalendar(fromMs, toMs, apiKey)
    } catch (e) {
      // Provider downtime: safer to degrade to the deterministic template
      // (which over-approximates blackout windows) than to trade blind.
      console.error('[calendar] real provider failed, using template fallback:', e)
      return getMockCalendar(fromMs, toMs)
    }
  }
  if (process.env.DEVELOPMENT_DEMO_MODE === 'true' || process.env.NODE_ENV !== 'production') {
    return getMockCalendar(fromMs, toMs)
  }
  const { SetupError } = await import('@/lib/config/runtime')
  throw new SetupError(
    'CALENDAR_API_KEY is not configured. Set a Finnhub API key (free tier works) so news blackouts run on real event times, or set DEVELOPMENT_DEMO_MODE=true.'
  )
}
