import { BacktestConfig, BacktestResult, BacktestTrade } from '@/types/forex'
import { generateCandles } from '@/lib/forex/data'
import { getPairBySymbol } from '@/lib/forex/pairs'
import { sma, ema, rsi, macd } from '@/lib/forex/indicators'
import { computeMetrics } from './metrics'

let tradeCounter = 0

function generateTradeId(): string {
  return `bt_${Date.now()}_${++tradeCounter}`
}

function pipsFromPrice(
  entryPrice: number,
  exitPrice: number,
  side: 'buy' | 'sell',
  pipSize: number
): number {
  const diff = side === 'buy' ? exitPrice - entryPrice : entryPrice - exitPrice
  return diff / pipSize
}

function calcPnl(
  entryPrice: number,
  exitPrice: number,
  side: 'buy' | 'sell',
  lotSize: number,
  isJpy: boolean
): number {
  const units = lotSize * 100000
  if (isJpy) {
    const diff = side === 'buy' ? exitPrice - entryPrice : entryPrice - exitPrice
    return (diff / exitPrice) * units
  } else {
    const diff = side === 'buy' ? exitPrice - entryPrice : entryPrice - exitPrice
    return diff * units
  }
}

export function runBacktest(config: BacktestConfig): BacktestResult {
  const pairInfo = getPairBySymbol(config.pair)
  if (!pairInfo) {
    return {
      config,
      trades: [],
      equity: [],
      metrics: computeMetrics([], config.initialBalance, []),
    }
  }

  const startMs = new Date(config.startDate).getTime()
  const endMs = new Date(config.endDate).getTime()
  const isJpy = config.pair.includes('JPY')

  // Generate all candles for the date range
  const minutesPerCandle = (() => {
    switch (config.timeframe) {
      case '1m': return 1
      case '5m': return 5
      case '15m': return 15
      case '1h': return 60
      case '4h': return 240
      case '1d': return 1440
    }
  })()

  const totalMinutes = (endMs - startMs) / (1000 * 60)
  const count = Math.floor(totalMinutes / minutesPerCandle)
  const candles = generateCandles(config.pair, config.timeframe, count, new Date(endMs))

  // Filter candles within date range
  const filteredCandles = candles.filter((c) => c.time >= startMs && c.time <= endMs)
  if (filteredCandles.length < 50) {
    return {
      config,
      trades: [],
      equity: [{ time: startMs, value: config.initialBalance }],
      metrics: computeMetrics([], config.initialBalance, [{ time: startMs, value: config.initialBalance }]),
    }
  }

  // Compute indicators
  const strategyId = config.strategyId
  const params = config.params

  type Signal = 'buy' | 'sell' | null

  let signals: Signal[] = new Array(filteredCandles.length).fill(null)

  if (strategyId === 'sma_crossover') {
    const fastPeriod = Number(params.fastPeriod ?? 10)
    const slowPeriod = Number(params.slowPeriod ?? 20)
    const fastSma = sma(filteredCandles, fastPeriod)
    const slowSma = sma(filteredCandles, slowPeriod)

    for (let i = 1; i < filteredCandles.length; i++) {
      if (isNaN(fastSma[i]) || isNaN(slowSma[i]) || isNaN(fastSma[i - 1]) || isNaN(slowSma[i - 1])) continue
      if (fastSma[i - 1] < slowSma[i - 1] && fastSma[i] > slowSma[i]) {
        signals[i] = 'buy'
      } else if (fastSma[i - 1] > slowSma[i - 1] && fastSma[i] < slowSma[i]) {
        signals[i] = 'sell'
      }
    }
  } else if (strategyId === 'rsi_mean_reversion') {
    const period = Number(params.period ?? 14)
    const oversold = Number(params.oversold ?? 30)
    const overbought = Number(params.overbought ?? 70)
    const rsiValues = rsi(filteredCandles, period)

    for (let i = 1; i < filteredCandles.length; i++) {
      if (isNaN(rsiValues[i]) || isNaN(rsiValues[i - 1])) continue
      if (rsiValues[i - 1] < oversold && rsiValues[i] >= oversold) {
        signals[i] = 'buy'
      } else if (rsiValues[i - 1] > overbought && rsiValues[i] <= overbought) {
        signals[i] = 'sell'
      }
    }
  } else if (strategyId === 'macd') {
    const fast = Number(params.fast ?? 12)
    const slow = Number(params.slow ?? 26)
    const signal = Number(params.signal ?? 9)
    const macdValues = macd(filteredCandles, fast, slow, signal)

    for (let i = 1; i < filteredCandles.length; i++) {
      if (isNaN(macdValues[i].macd) || isNaN(macdValues[i - 1].macd)) continue
      if (macdValues[i - 1].macd < macdValues[i - 1].signal && macdValues[i].macd > macdValues[i].signal) {
        signals[i] = 'buy'
      } else if (macdValues[i - 1].macd > macdValues[i - 1].signal && macdValues[i].macd < macdValues[i].signal) {
        signals[i] = 'sell'
      }
    }
  }

  // Simulate trades
  const trades: BacktestTrade[] = []
  const equityCurve: { time: number; value: number }[] = [
    { time: filteredCandles[0].time, value: config.initialBalance },
  ]

  let balance = config.initialBalance
  let openTrade: {
    id: string
    side: 'buy' | 'sell'
    entryTime: number
    entryPrice: number
    stopLoss: number
    takeProfit: number
  } | null = null

  const slPips = config.stopLoss * pairInfo.pipSize
  const tpPips = config.takeProfit * pairInfo.pipSize

  for (let i = 1; i < filteredCandles.length; i++) {
    const candle = filteredCandles[i]

    // Check for SL/TP hit on open trade
    if (openTrade) {
      let exitPrice: number | null = null
      let exitReason: 'sl' | 'tp' | null = null

      if (openTrade.side === 'buy') {
        if (candle.low <= openTrade.stopLoss) {
          exitPrice = openTrade.stopLoss
          exitReason = 'sl'
        } else if (candle.high >= openTrade.takeProfit) {
          exitPrice = openTrade.takeProfit
          exitReason = 'tp'
        }
      } else {
        if (candle.high >= openTrade.stopLoss) {
          exitPrice = openTrade.stopLoss
          exitReason = 'sl'
        } else if (candle.low <= openTrade.takeProfit) {
          exitPrice = openTrade.takeProfit
          exitReason = 'tp'
        }
      }

      // Close on opposite signal
      if (!exitPrice && signals[i] && signals[i] !== openTrade.side) {
        exitPrice = candle.open
        exitReason = null
      }

      if (exitPrice !== null) {
        const pips = pipsFromPrice(openTrade.entryPrice, exitPrice, openTrade.side, pairInfo.pipSize)
        const pnl = calcPnl(openTrade.entryPrice, exitPrice, openTrade.side, config.lotSize, isJpy)

        trades.push({
          id: openTrade.id,
          side: openTrade.side,
          entryTime: openTrade.entryTime,
          exitTime: candle.time,
          entryPrice: openTrade.entryPrice,
          exitPrice,
          pnl: parseFloat(pnl.toFixed(2)),
          pips: parseFloat(pips.toFixed(1)),
        })

        balance += pnl
        equityCurve.push({ time: candle.time, value: parseFloat(balance.toFixed(2)) })
        openTrade = null

        // If closed due to opposite signal, don't open a new trade on same candle
        if (exitReason === null) continue
      }
    }

    // Open new trade on signal (only if no open trade)
    if (!openTrade && signals[i]) {
      const entryPrice = filteredCandles[Math.min(i + 1, filteredCandles.length - 1)].open
      const side = signals[i]!

      const stopLoss =
        side === 'buy' ? entryPrice - slPips : entryPrice + slPips
      const takeProfit =
        side === 'buy' ? entryPrice + tpPips : entryPrice - tpPips

      openTrade = {
        id: generateTradeId(),
        side,
        entryTime: candle.time,
        entryPrice,
        stopLoss,
        takeProfit,
      }
    }
  }

  // Close any remaining open trade at last candle close
  if (openTrade) {
    const lastCandle = filteredCandles[filteredCandles.length - 1]
    const exitPrice = lastCandle.close
    const pips = pipsFromPrice(openTrade.entryPrice, exitPrice, openTrade.side, pairInfo.pipSize)
    const pnl = calcPnl(openTrade.entryPrice, exitPrice, openTrade.side, config.lotSize, isJpy)

    trades.push({
      id: openTrade.id,
      side: openTrade.side,
      entryTime: openTrade.entryTime,
      exitTime: lastCandle.time,
      entryPrice: openTrade.entryPrice,
      exitPrice,
      pnl: parseFloat(pnl.toFixed(2)),
      pips: parseFloat(pips.toFixed(1)),
    })

    balance += pnl
    equityCurve.push({ time: lastCandle.time, value: parseFloat(balance.toFixed(2)) })
  }

  equityCurve.push({ time: filteredCandles[filteredCandles.length - 1].time, value: parseFloat(balance.toFixed(2)) })

  const metrics = computeMetrics(trades, config.initialBalance, equityCurve)

  return { config, trades, equity: equityCurve, metrics }
}
