// Real exchange central-limit-order-book (CLOB) provider.
//
// OANDA (the app's price feed) is OTC — there is no central book — so live
// Level-2 depth comes from a real exchange. Kraken's public Depth endpoint
// needs no API key, is reachable from the US, and lists spot GOLD as PAXG/USD
// (PAX Gold, 1 token = 1 fine troy oz, tracks XAU closely) alongside the major
// crypto books. That gives FlowEdge a genuine resting bid/ask ladder.
//
// Docs: https://docs.kraken.com/api/docs/rest-api/get-order-book

export interface OrderBookLevel {
  price: number
  size: number       // resting size at this level
  total: number      // cumulative size from best price outward
}

export interface ExchangeOrderBook {
  instrument: string     // FlowEdge symbol, e.g. XAU/USD
  venue: string          // 'Kraken'
  venueSymbol: string    // e.g. PAXG/USD
  label: string
  bids: OrderBookLevel[] // highest price first
  asks: OrderBookLevel[] // lowest price first
  bestBid: number
  bestAsk: number
  mid: number
  spread: number
  spreadPct: number
  maxTotal: number       // largest cumulative size either side (for depth bars)
  asOf: number
}

// FlowEdge instrument → Kraken pair. Kraken returns the book under its own
// canonical pair code, so we read the sole result key rather than guess it.
const VENUE_MAP: Record<string, { pair: string; venueSymbol: string; label: string }> = {
  'XAU/USD': { pair: 'PAXGUSD', venueSymbol: 'PAXG/USD', label: 'Gold · PAX Gold (PAXG/USD)' },
  'BTC/USD': { pair: 'XBTUSD', venueSymbol: 'XBT/USD', label: 'Bitcoin (BTC/USD)' },
  'ETH/USD': { pair: 'ETHUSD', venueSymbol: 'ETH/USD', label: 'Ethereum (ETH/USD)' },
}

export const ORDERBOOK_INSTRUMENTS = Object.entries(VENUE_MAP).map(([symbol, v]) => ({
  symbol,
  venueSymbol: v.venueSymbol,
  label: v.label,
}))

export function isOrderBookSupported(instrument: string): boolean {
  return instrument in VENUE_MAP
}

type KrakenEntry = [string, string, number] // [price, volume, timestamp]

function withCumulative(rows: KrakenEntry[]): OrderBookLevel[] {
  let running = 0
  return rows.map(([p, v]) => {
    const size = Number(v)
    running += size
    return { price: Number(p), size, total: Math.round(running * 1e6) / 1e6 }
  })
}

export async function fetchExchangeOrderBook(instrument: string, depth = 20): Promise<ExchangeOrderBook> {
  const map = VENUE_MAP[instrument]
  if (!map) throw new Error(`Order book not available for ${instrument}. Supported: ${Object.keys(VENUE_MAP).join(', ')}`)

  const count = Math.min(Math.max(depth, 5), 100)
  const url = `https://api.kraken.com/0/public/Depth?pair=${map.pair}&count=${count}`
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 8000)
  let json: { error?: string[]; result?: Record<string, { asks: KrakenEntry[]; bids: KrakenEntry[] }> }
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { accept: 'application/json' }, cache: 'no-store' })
    if (!res.ok) throw new Error(`Kraken order book HTTP ${res.status}`)
    json = await res.json()
  } finally {
    clearTimeout(timer)
  }
  if (json.error && json.error.length) throw new Error(`Kraken: ${json.error.join('; ')}`)
  const book = json.result ? Object.values(json.result)[0] : undefined
  if (!book || !book.bids?.length || !book.asks?.length) throw new Error('Kraken returned an empty book')

  // Kraken gives bids high→low and asks low→high already.
  const bids = withCumulative(book.bids)
  const asks = withCumulative(book.asks)
  const bestBid = bids[0].price
  const bestAsk = asks[0].price
  const mid = (bestBid + bestAsk) / 2
  const spread = bestAsk - bestBid
  const maxTotal = Math.max(bids[bids.length - 1]?.total ?? 0, asks[asks.length - 1]?.total ?? 0)

  return {
    instrument,
    venue: 'Kraken',
    venueSymbol: map.venueSymbol,
    label: map.label,
    bids,
    asks,
    bestBid,
    bestAsk,
    mid: Math.round(mid * 1e6) / 1e6,
    spread: Math.round(spread * 1e6) / 1e6,
    spreadPct: mid > 0 ? Math.round((spread / mid) * 1e6) / 1e4 : 0, // %
    maxTotal,
    asOf: Date.now(),
  }
}
