import { BacktestMetrics, BacktestTrade } from '@/types/forex'

export function computeMetrics(
  trades: BacktestTrade[],
  initialBalance: number,
  equity: { time: number; value: number }[]
): BacktestMetrics {
  const totalTrades = trades.length
  const winningTrades = trades.filter((t) => t.pnl > 0)
  const losingTrades = trades.filter((t) => t.pnl <= 0)

  const totalPnl = trades.reduce((sum, t) => sum + t.pnl, 0)
  const finalBalance = initialBalance + totalPnl
  const totalReturn = ((finalBalance - initialBalance) / initialBalance) * 100

  const winRate = totalTrades > 0 ? (winningTrades.length / totalTrades) * 100 : 0

  const grossWins = winningTrades.reduce((sum, t) => sum + t.pnl, 0)
  const grossLosses = Math.abs(losingTrades.reduce((sum, t) => sum + t.pnl, 0))
  const profitFactor = grossLosses > 0 ? grossWins / grossLosses : grossWins > 0 ? Infinity : 0

  // Max drawdown from equity curve
  let maxDrawdown = 0
  let peak = initialBalance
  for (const point of equity) {
    if (point.value > peak) peak = point.value
    const drawdown = peak > 0 ? ((peak - point.value) / peak) * 100 : 0
    if (drawdown > maxDrawdown) maxDrawdown = drawdown
  }

  // Sharpe ratio: annualized
  // Group equity by day
  const dailyReturns: number[] = []
  if (equity.length > 1) {
    for (let i = 1; i < equity.length; i++) {
      const prev = equity[i - 1].value
      if (prev > 0) {
        dailyReturns.push((equity[i].value - prev) / prev)
      }
    }
  }

  let sharpeRatio = 0
  if (dailyReturns.length > 1) {
    const meanReturn = dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length
    const variance =
      dailyReturns.reduce((acc, r) => acc + Math.pow(r - meanReturn, 2), 0) / dailyReturns.length
    const stdDev = Math.sqrt(variance)
    const annualizedReturn = meanReturn * 252
    const riskFreeRate = 0.02
    if (stdDev > 0) {
      sharpeRatio = (annualizedReturn - riskFreeRate) / (stdDev * Math.sqrt(252))
    }
  }

  const winningPips = winningTrades.map((t) => t.pips)
  const losingPips = losingTrades.map((t) => t.pips)

  const avgWin =
    winningPips.length > 0 ? winningPips.reduce((a, b) => a + b, 0) / winningPips.length : 0
  const avgLoss =
    losingPips.length > 0 ? losingPips.reduce((a, b) => a + b, 0) / losingPips.length : 0

  const largestWin = winningPips.length > 0 ? Math.max(...winningPips) : 0
  const largestLoss = losingPips.length > 0 ? Math.min(...losingPips) : 0

  const winRateFraction = winRate / 100
  const lossRateFraction = 1 - winRateFraction
  const expectancy = winRateFraction * avgWin - lossRateFraction * Math.abs(avgLoss)

  return {
    totalReturn: parseFloat(totalReturn.toFixed(2)),
    totalPnl: parseFloat(totalPnl.toFixed(2)),
    totalTrades,
    winningTrades: winningTrades.length,
    losingTrades: losingTrades.length,
    winRate: parseFloat(winRate.toFixed(1)),
    profitFactor: parseFloat(Math.min(profitFactor, 999).toFixed(2)),
    maxDrawdown: parseFloat(maxDrawdown.toFixed(2)),
    sharpeRatio: parseFloat(sharpeRatio.toFixed(2)),
    avgWin: parseFloat(avgWin.toFixed(1)),
    avgLoss: parseFloat(avgLoss.toFixed(1)),
    largestWin: parseFloat(largestWin.toFixed(1)),
    largestLoss: parseFloat(largestLoss.toFixed(1)),
    expectancy: parseFloat(expectancy.toFixed(2)),
  }
}
