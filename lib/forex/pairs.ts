import type { CurrencyPair } from '@/types/forex'

export const CURRENCY_PAIRS: CurrencyPair[] = [
  // ─── Forex ───────────────────────────────────────────────────────────
  {
    symbol: 'EUR/USD', name: 'Euro / US Dollar',
    base: 'EUR', quote: 'USD', assetClass: 'forex',
    digits: 4, pipSize: 0.0001, spread: 0.2, basePrice: 1.1320,
  },
  {
    symbol: 'GBP/USD', name: 'Pound / US Dollar',
    base: 'GBP', quote: 'USD', assetClass: 'forex',
    digits: 4, pipSize: 0.0001, spread: 0.3, basePrice: 1.3580,
  },
  {
    symbol: 'USD/JPY', name: 'US Dollar / Yen',
    base: 'USD', quote: 'JPY', assetClass: 'forex',
    digits: 3, pipSize: 0.01, spread: 0.3, basePrice: 144.50,
  },
  {
    symbol: 'USD/CHF', name: 'US Dollar / Swiss Franc',
    base: 'USD', quote: 'CHF', assetClass: 'forex',
    digits: 4, pipSize: 0.0001, spread: 0.4, basePrice: 0.8820,
  },
  {
    symbol: 'AUD/USD', name: 'Aussie / US Dollar',
    base: 'AUD', quote: 'USD', assetClass: 'forex',
    digits: 4, pipSize: 0.0001, spread: 0.4, basePrice: 0.6450,
  },
  {
    symbol: 'USD/CAD', name: 'US Dollar / Canadian Dollar',
    base: 'USD', quote: 'CAD', assetClass: 'forex',
    digits: 4, pipSize: 0.0001, spread: 0.5, basePrice: 1.3820,
  },
  {
    symbol: 'NZD/USD', name: 'Kiwi / US Dollar',
    base: 'NZD', quote: 'USD', assetClass: 'forex',
    digits: 4, pipSize: 0.0001, spread: 0.6, basePrice: 0.5980,
  },
  {
    symbol: 'EUR/GBP', name: 'Euro / Pound',
    base: 'EUR', quote: 'GBP', assetClass: 'forex',
    digits: 4, pipSize: 0.0001, spread: 0.5, basePrice: 0.8340,
  },

  // ─── Metals ──────────────────────────────────────────────────────────
  {
    symbol: 'XAU/USD', name: 'Gold',
    base: 'XAU', quote: 'USD', assetClass: 'metal',
    // 1 pip = $0.10; 35-pip spread ≈ $3.50 — realistic for spot gold
    digits: 2, pipSize: 0.1, spread: 35, basePrice: 4300.00,
  },
  {
    symbol: 'XAG/USD', name: 'Silver',
    base: 'XAG', quote: 'USD', assetClass: 'metal',
    // 1 pip = $0.01; 50-pip spread ≈ $0.50 — typical spot silver
    digits: 3, pipSize: 0.01, spread: 50, basePrice: 50.500,
  },

  // ─── Indices ─────────────────────────────────────────────────────────
  {
    symbol: 'NAS100', name: 'NASDAQ 100',
    base: 'NAS100', quote: 'USD', assetClass: 'index',
    // 1 pip = 1 point; 2-pip spread = 2-point spread
    digits: 1, pipSize: 1.0, spread: 2, basePrice: 21500.0,
  },
  {
    symbol: 'US500', name: 'S&P 500',
    base: 'US500', quote: 'USD', assetClass: 'index',
    // 1 pip = 0.25 point (quarter-point ticks); 4-pip spread = 1 point
    digits: 1, pipSize: 0.25, spread: 4, basePrice: 5900.0,
  },
]

// Alias used by SMC modules
export const PAIR_CONFIGS = CURRENCY_PAIRS

export function getPairBySymbol(symbol: string): CurrencyPair | undefined {
  return CURRENCY_PAIRS.find((p) => p.symbol === symbol)
}

export function getPairsByClass(assetClass: CurrencyPair['assetClass']): CurrencyPair[] {
  return CURRENCY_PAIRS.filter((p) => p.assetClass === assetClass)
}
