import { CurrencyPair } from '@/types/forex'

export const CURRENCY_PAIRS: CurrencyPair[] = [
  {
    symbol: 'EUR/USD',
    base: 'EUR',
    quote: 'USD',
    digits: 4,
    pipSize: 0.0001,
    spread: 0.2,
    basePrice: 1.0851,
  },
  {
    symbol: 'GBP/USD',
    base: 'GBP',
    quote: 'USD',
    digits: 4,
    pipSize: 0.0001,
    spread: 0.3,
    basePrice: 1.2694,
  },
  {
    symbol: 'USD/JPY',
    base: 'USD',
    quote: 'JPY',
    digits: 3,
    pipSize: 0.01,
    spread: 0.3,
    basePrice: 149.87,
  },
  {
    symbol: 'USD/CHF',
    base: 'USD',
    quote: 'CHF',
    digits: 4,
    pipSize: 0.0001,
    spread: 0.4,
    basePrice: 0.9042,
  },
  {
    symbol: 'AUD/USD',
    base: 'AUD',
    quote: 'USD',
    digits: 4,
    pipSize: 0.0001,
    spread: 0.4,
    basePrice: 0.6512,
  },
  {
    symbol: 'USD/CAD',
    base: 'USD',
    quote: 'CAD',
    digits: 4,
    pipSize: 0.0001,
    spread: 0.5,
    basePrice: 1.3624,
  },
  {
    symbol: 'NZD/USD',
    base: 'NZD',
    quote: 'USD',
    digits: 4,
    pipSize: 0.0001,
    spread: 0.6,
    basePrice: 0.5998,
  },
  {
    symbol: 'EUR/GBP',
    base: 'EUR',
    quote: 'GBP',
    digits: 4,
    pipSize: 0.0001,
    spread: 0.5,
    basePrice: 0.8548,
  },
]

export function getPairBySymbol(symbol: string): CurrencyPair | undefined {
  return CURRENCY_PAIRS.find((p) => p.symbol === symbol)
}
