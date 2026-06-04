export type Timeframe = '1m' | '5m' | '15m' | '1h' | '4h' | '1d'

export interface Candle {
  time: number  // Unix timestamp ms
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export type AssetClass = 'forex' | 'metal' | 'index'

export interface CurrencyPair {
  symbol: string       // e.g. "EUR/USD", "XAU/USD", "NAS100"
  base: string
  quote: string
  name: string         // display name e.g. "Euro / USD", "Gold", "NASDAQ 100"
  assetClass: AssetClass
  digits: number       // decimal places
  pipSize: number      // 0.0001 for FX, 0.1 for Gold, 1.0 for NAS100
  spread: number       // in pips
  basePrice: number    // simulation base price
}

export type OrderSide = 'buy' | 'sell'
export type OrderStatus = 'open' | 'closed' | 'cancelled'

export interface Order {
  id: string
  pair: string
  side: OrderSide
  size: number        // in lots (1 lot = 100,000 units)
  entryPrice: number
  exitPrice?: number
  stopLoss?: number
  takeProfit?: number
  openTime: number
  closeTime?: number
  pnl?: number        // in USD
  status: OrderStatus
}

export interface Account {
  balance: number
  equity: number
  margin: number
  freeMargin: number
  marginLevel: number
  openPnl: number
}

export interface StrategyConfig {
  id: string
  name: string
  description: string
  params: StrategyParam[]
}

export interface StrategyParam {
  key: string
  label: string
  type: 'number' | 'select'
  default: number | string
  min?: number
  max?: number
  step?: number
  options?: string[]
}

export interface BacktestConfig {
  pair: string
  timeframe: Timeframe
  startDate: string   // ISO date string
  endDate: string
  strategyId: string
  params: Record<string, number | string>
  initialBalance: number
  lotSize: number
  stopLoss: number    // pips
  takeProfit: number  // pips
}

export interface BacktestTrade {
  id: string
  side: OrderSide
  entryTime: number
  exitTime: number
  entryPrice: number
  exitPrice: number
  pnl: number
  pips: number
}

export interface BacktestResult {
  config: BacktestConfig
  trades: BacktestTrade[]
  equity: { time: number; value: number }[]
  metrics: BacktestMetrics
}

export interface BacktestMetrics {
  totalReturn: number      // %
  totalPnl: number         // USD
  totalTrades: number
  winningTrades: number
  losingTrades: number
  winRate: number          // %
  profitFactor: number
  maxDrawdown: number      // %
  sharpeRatio: number
  avgWin: number           // pips
  avgLoss: number          // pips
  largestWin: number
  largestLoss: number
  expectancy: number       // avg pips per trade
}

export interface LivePrice {
  pair: string
  bid: number
  ask: number
  mid: number
  change: number      // % change from open
  changeAbs: number   // absolute change
  high: number
  low: number
  time: number
}
