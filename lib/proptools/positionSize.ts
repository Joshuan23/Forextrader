import type { CurrencyPair } from '@/types/forex'
import { CURRENCY_PAIRS } from '@/lib/forex/pairs'

// Units per 1.00 standard lot. Forex uses the 100k convention; metals use
// exchange contract sizes; indices are quoted as 1 contract paying $1/point.
export function contractSize(pair: CurrencyPair): number {
  switch (pair.assetClass) {
    case 'forex': return 100_000
    case 'metal': return pair.symbol === 'XAU/USD' ? 100 : 5_000
    case 'index': return 1
  }
}

// USD value of one unit of the quote currency, approximated from the
// configured base prices when no live rate is supplied.
function quoteToUsd(pair: CurrencyPair, price: number): number {
  if (pair.quote === 'USD') return 1
  if (pair.base === 'USD') return 1 / price
  const direct = CURRENCY_PAIRS.find(p => p.symbol === `${pair.quote}/USD`)
  if (direct) return direct.basePrice
  const inverse = CURRENCY_PAIRS.find(p => p.symbol === `USD/${pair.quote}`)
  if (inverse) return 1 / inverse.basePrice
  return 1
}

// USD value of a 1-pip move per standard lot, at the given market price.
export function pipValuePerLot(pair: CurrencyPair, price: number): number {
  return pair.pipSize * contractSize(pair) * quoteToUsd(pair, price)
}

export interface PositionSizeInput {
  accountSize: number   // account equity in USD
  riskPct: number       // % of equity risked on this trade
  stopPips: number      // stop-loss distance in pips
  pair: CurrencyPair
  price: number         // current market price of the pair
}

export interface PositionSizeResult {
  riskAmount: number    // USD at risk
  pipValue: number      // USD per pip per standard lot
  lots: number          // position size in standard lots
  units: number         // position size in base-currency units
  usdPerPip: number     // USD per pip at the computed size
}

export function calcPositionSize(input: PositionSizeInput): PositionSizeResult {
  const { accountSize, riskPct, stopPips, pair, price } = input
  const riskAmount = accountSize * (riskPct / 100)
  const pipValue = pipValuePerLot(pair, price)
  const rawLots = stopPips > 0 && pipValue > 0 ? riskAmount / (stopPips * pipValue) : 0
  const lots = Math.floor(rawLots * 100) / 100 // round DOWN to 0.01 lot — never risk more than intended
  return {
    riskAmount,
    pipValue,
    lots,
    units: Math.round(lots * contractSize(pair)),
    usdPerPip: lots * pipValue,
  }
}
