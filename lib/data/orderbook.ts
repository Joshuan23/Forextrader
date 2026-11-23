// Real exchange central-limit-order-book (CLOB) provider.
//
// OANDA (the app's price feed) is OTC — there is no central book — so live
// Level-2 depth comes from a real exchange. Kraken's public API needs no key,
// is reachable from the US, and lists deep CRYPTO books, spot GOLD via PAXG
// (PAX Gold, 1 token = 1 fine oz, tracks XAU), some fiat FOREX pairs, and
// tokenized STOCKS (xStocks, e.g. AAPLx). We validate every instrument against
// Kraken's live AssetPairs so a dropdown never offers a book that isn't there.
//
// Docs: https://docs.kraken.com/api/docs/rest-api/get-order-book

export type AssetClass = 'Forex' | 'Crypto' | 'Stocks'

export interface Instrument {
  symbol: string      // FlowEdge-facing symbol, e.g. XAU/USD
  pair: string        // Kraken query code (altname), e.g. PAXGUSD
  venueSymbol: string // human label of the venue pair, e.g. PAXG/USD
  label: string
}

export interface InstrumentGroup {
  category: AssetClass
  instruments: { symbol: string; venueSymbol: string; label: string }[]
}

// Candidate instruments per asset class. The live validation drops any that
// Kraken does not currently list, so this list can be generous.
const CANDIDATES: Record<AssetClass, Instrument[]> = {
  Forex: [
    { symbol: 'EUR/USD', pair: 'EURUSD', venueSymbol: 'EUR/USD', label: 'Euro / US Dollar' },
    { symbol: 'GBP/USD', pair: 'GBPUSD', venueSymbol: 'GBP/USD', label: 'Pound / US Dollar' },
    { symbol: 'AUD/USD', pair: 'AUDUSD', venueSymbol: 'AUD/USD', label: 'Aussie / US Dollar' },
    { symbol: 'USD/CAD', pair: 'USDCAD', venueSymbol: 'USD/CAD', label: 'US Dollar / Canadian Dollar' },
    { symbol: 'USD/JPY', pair: 'USDJPY', venueSymbol: 'USD/JPY', label: 'US Dollar / Yen' },
    { symbol: 'USD/CHF', pair: 'USDCHF', venueSymbol: 'USD/CHF', label: 'US Dollar / Swiss Franc' },
    { symbol: 'EUR/GBP', pair: 'EURGBP', venueSymbol: 'EUR/GBP', label: 'Euro / Pound' },
    { symbol: 'EUR/JPY', pair: 'EURJPY', venueSymbol: 'EUR/JPY', label: 'Euro / Yen' },
    { symbol: 'EUR/CHF', pair: 'EURCHF', venueSymbol: 'EUR/CHF', label: 'Euro / Swiss Franc' },
    { symbol: 'EUR/AUD', pair: 'EURAUD', venueSymbol: 'EUR/AUD', label: 'Euro / Aussie' },
    { symbol: 'EUR/CAD', pair: 'EURCAD', venueSymbol: 'EUR/CAD', label: 'Euro / Canadian Dollar' },
  ],
  Crypto: [
    { symbol: 'XAU/USD', pair: 'PAXGUSD', venueSymbol: 'PAXG/USD', label: 'Gold · PAX Gold (PAXG)' },
    { symbol: 'BTC/USD', pair: 'XBTUSD', venueSymbol: 'XBT/USD', label: 'Bitcoin' },
    { symbol: 'ETH/USD', pair: 'ETHUSD', venueSymbol: 'ETH/USD', label: 'Ethereum' },
    { symbol: 'SOL/USD', pair: 'SOLUSD', venueSymbol: 'SOL/USD', label: 'Solana' },
    { symbol: 'XRP/USD', pair: 'XRPUSD', venueSymbol: 'XRP/USD', label: 'XRP' },
    { symbol: 'ADA/USD', pair: 'ADAUSD', venueSymbol: 'ADA/USD', label: 'Cardano' },
    { symbol: 'DOGE/USD', pair: 'XDGUSD', venueSymbol: 'XDG/USD', label: 'Dogecoin' },
    { symbol: 'LINK/USD', pair: 'LINKUSD', venueSymbol: 'LINK/USD', label: 'Chainlink' },
    { symbol: 'AVAX/USD', pair: 'AVAXUSD', venueSymbol: 'AVAX/USD', label: 'Avalanche' },
    { symbol: 'DOT/USD', pair: 'DOTUSD', venueSymbol: 'DOT/USD', label: 'Polkadot' },
    { symbol: 'LTC/USD', pair: 'LTCUSD', venueSymbol: 'LTC/USD', label: 'Litecoin' },
  ],
  Stocks: [
    { symbol: 'AAPLx', pair: 'AAPLxUSD', venueSymbol: 'AAPLx/USD', label: 'Apple (tokenized)' },
    { symbol: 'TSLAx', pair: 'TSLAxUSD', venueSymbol: 'TSLAx/USD', label: 'Tesla (tokenized)' },
    { symbol: 'NVDAx', pair: 'NVDAxUSD', venueSymbol: 'NVDAx/USD', label: 'Nvidia (tokenized)' },
    { symbol: 'MSFTx', pair: 'MSFTxUSD', venueSymbol: 'MSFTx/USD', label: 'Microsoft (tokenized)' },
    { symbol: 'AMZNx', pair: 'AMZNxUSD', venueSymbol: 'AMZNx/USD', label: 'Amazon (tokenized)' },
    { symbol: 'GOOGLx', pair: 'GOOGLxUSD', venueSymbol: 'GOOGLx/USD', label: 'Alphabet (tokenized)' },
    { symbol: 'METAx', pair: 'METAxUSD', venueSymbol: 'METAx/USD', label: 'Meta (tokenized)' },
    { symbol: 'SPYx', pair: 'SPYxUSD', venueSymbol: 'SPYx/USD', label: 'S&P 500 ETF (tokenized)' },
    { symbol: 'QQQx', pair: 'QQQxUSD', venueSymbol: 'QQQx/USD', label: 'Nasdaq 100 ETF (tokenized)' },
    { symbol: 'COINx', pair: 'COINxUSD', venueSymbol: 'COINx/USD', label: 'Coinbase (tokenized)' },
  ],
}

const BY_SYMBOL: Record<string, Instrument> = Object.fromEntries(
  (Object.values(CANDIDATES).flat()).map((i) => [i.symbol, i])
)

export function isOrderBookSupported(symbol: string): boolean {
  return symbol in BY_SYMBOL
}

// ── live Kraken pair list (cached) for validating the dropdowns ──────
let pairCache: { at: number; available: Set<string> } | null = null
const PAIR_TTL = 5 * 60_000

async function availablePairs(): Promise<Set<string>> {
  if (pairCache && Date.now() - pairCache.at < PAIR_TTL) return pairCache.available
  const res = await fetch('https://api.kraken.com/0/public/AssetPairs', {
    headers: { accept: 'application/json' },
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`Kraken AssetPairs HTTP ${res.status}`)
  const json = (await res.json()) as { error?: string[]; result?: Record<string, { altname?: string; wsname?: string; status?: string }> }
  if (json.error && json.error.length) throw new Error(`Kraken: ${json.error.join('; ')}`)
  const set = new Set<string>()
  for (const [key, v] of Object.entries(json.result ?? {})) {
    if (v.status && v.status !== 'online') continue
    set.add(key.toUpperCase())
    if (v.altname) set.add(v.altname.toUpperCase())
    if (v.wsname) set.add(v.wsname.toUpperCase())
  }
  pairCache = { at: Date.now(), available: set }
  return set
}

// Returns the categorized instruments Kraken ACTUALLY lists right now, so the
// UI only shows books that resolve. Falls back to the full candidate list if
// the validation call itself fails (so the feature still works).
export async function fetchInstrumentGroups(): Promise<{ groups: InstrumentGroup[]; validated: boolean }> {
  let available: Set<string> | null = null
  try {
    available = await availablePairs()
  } catch {
    available = null
  }
  const groups: InstrumentGroup[] = (Object.keys(CANDIDATES) as AssetClass[]).map((category) => {
    const instruments = CANDIDATES[category]
      .filter((i) => !available || available.has(i.pair.toUpperCase()) || available.has(i.venueSymbol.toUpperCase()))
      .map((i) => ({ symbol: i.symbol, venueSymbol: i.venueSymbol, label: i.label }))
    return { category, instruments }
  })
  return { groups, validated: available !== null }
}

export interface OrderBookLevel { price: number; size: number; total: number }

export interface ExchangeOrderBook {
  instrument: string
  category: AssetClass
  venue: string
  venueSymbol: string
  label: string
  bids: OrderBookLevel[]
  asks: OrderBookLevel[]
  bestBid: number
  bestAsk: number
  mid: number
  spread: number
  spreadPct: number
  maxTotal: number
  asOf: number
}

type KrakenEntry = [string, string, number]

function withCumulative(rows: KrakenEntry[]): OrderBookLevel[] {
  let running = 0
  return rows.map(([p, v]) => {
    const size = Number(v)
    running += size
    return { price: Number(p), size, total: Math.round(running * 1e6) / 1e6 }
  })
}

function categoryOf(symbol: string): AssetClass {
  for (const cat of Object.keys(CANDIDATES) as AssetClass[]) {
    if (CANDIDATES[cat].some((i) => i.symbol === symbol)) return cat
  }
  return 'Crypto'
}

export async function fetchExchangeOrderBook(symbol: string, depth = 20): Promise<ExchangeOrderBook> {
  const map = BY_SYMBOL[symbol]
  if (!map) throw new Error(`Order book not available for ${symbol}`)

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

  const bids = withCumulative(book.bids) // high→low already
  const asks = withCumulative(book.asks) // low→high already
  const bestBid = bids[0].price
  const bestAsk = asks[0].price
  const mid = (bestBid + bestAsk) / 2
  const spread = bestAsk - bestBid
  const maxTotal = Math.max(bids[bids.length - 1]?.total ?? 0, asks[asks.length - 1]?.total ?? 0)

  return {
    instrument: symbol,
    category: categoryOf(symbol),
    venue: 'Kraken',
    venueSymbol: map.venueSymbol,
    label: map.label,
    bids,
    asks,
    bestBid,
    bestAsk,
    mid: Math.round(mid * 1e6) / 1e6,
    spread: Math.round(spread * 1e6) / 1e6,
    spreadPct: mid > 0 ? Math.round((spread / mid) * 1e6) / 1e4 : 0,
    maxTotal,
    asOf: Date.now(),
  }
}
