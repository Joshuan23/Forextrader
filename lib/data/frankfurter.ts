/**
 * Frankfurter API — ECB exchange rates, free, no API key, fully serverless-compatible.
 * https://api.frankfurter.app
 * Covers all major FX pairs. Does NOT cover metals or indices.
 */

// Frankfurter supports these as base/quote currencies
const FRANK_CURRENCIES = new Set([
  'AUD', 'BGN', 'BRL', 'CAD', 'CHF', 'CNY', 'CZK', 'DKK',
  'EUR', 'GBP', 'HKD', 'HUF', 'IDR', 'ILS', 'INR', 'ISK',
  'JPY', 'KRW', 'MXN', 'MYR', 'NOK', 'NZD', 'PHP', 'PLN',
  'RON', 'SEK', 'SGD', 'THB', 'TRY', 'USD', 'ZAR',
])

export function franklinSupports(pair: string): boolean {
  const [b, q] = pair.split('/')
  return Boolean(b && q && FRANK_CURRENCIES.has(b) && FRANK_CURRENCIES.has(q))
}

/** Returns the current mid rate for a pair, e.g. 1.1529 for EUR/USD. */
export async function fetchFrankfurterRate(pair: string): Promise<number | null> {
  if (!franklinSupports(pair)) return null
  const [base, quote] = pair.split('/')
  try {
    const res = await fetch(
      `https://api.frankfurter.app/latest?from=${base}&to=${quote}`,
      { next: { revalidate: 300 }, signal: AbortSignal.timeout(5000) },   // ECB updates once daily; 5-min cache is plenty
    )
    if (!res.ok) return null
    const data = await res.json()
    const rate = data?.rates?.[quote]
    return typeof rate === 'number' && isFinite(rate) ? rate : null
  } catch {
    return null
  }
}

/** Returns the last `count` daily closing rates as {date, rate} pairs, oldest first. */
export async function fetchFrankfurterHistory(
  pair: string,
  count: number,
): Promise<{ date: string; rate: number }[]> {
  if (!franklinSupports(pair)) return []
  const [base, quote] = pair.split('/')
  try {
    // Fetch double the range to guarantee we always get `count` trading days
    const start = new Date(Date.now() - count * 2 * 24 * 60 * 60 * 1000)
      .toISOString().split('T')[0]
    const end   = new Date().toISOString().split('T')[0]
    const res = await fetch(
      `https://api.frankfurter.app/${start}..${end}?from=${base}&to=${quote}`,
      { next: { revalidate: 3600 }, signal: AbortSignal.timeout(5000) },
    )
    if (!res.ok) return []
    const data = await res.json()
    const dates = Object.keys(data?.rates ?? {}).sort()
    return dates.slice(-count).map(d => ({
      date: d,
      rate: (data.rates[d]?.[quote] as number),
    }))
  } catch {
    return []
  }
}
