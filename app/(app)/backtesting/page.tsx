'use client'

import { useState } from 'react'
import { Header } from '@/components/layout/Header'
import { EquityChart } from '@/components/charts/EquityChart'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { BacktestConfig, BacktestResult } from '@/types/forex'
import { CURRENCY_PAIRS } from '@/lib/forex/pairs'
import { formatCurrency, cn } from '@/lib/utils'
import { Play, Loader2, TrendingUp, TrendingDown } from 'lucide-react'
import { format } from 'date-fns'

const STRATEGIES = [
  {
    id: 'sma_crossover',
    name: 'SMA Crossover',
    params: [
      { key: 'fastPeriod', label: 'Fast Period', type: 'number' as const, default: 10, min: 2, max: 50 },
      { key: 'slowPeriod', label: 'Slow Period', type: 'number' as const, default: 20, min: 5, max: 200 },
    ],
  },
  {
    id: 'rsi_mean_reversion',
    name: 'RSI Mean Reversion',
    params: [
      { key: 'period', label: 'RSI Period', type: 'number' as const, default: 14, min: 2, max: 50 },
      { key: 'oversold', label: 'Oversold Level', type: 'number' as const, default: 30, min: 10, max: 45 },
      { key: 'overbought', label: 'Overbought Level', type: 'number' as const, default: 70, min: 55, max: 90 },
    ],
  },
  {
    id: 'macd',
    name: 'MACD',
    params: [
      { key: 'fast', label: 'Fast EMA', type: 'number' as const, default: 12, min: 2, max: 50 },
      { key: 'slow', label: 'Slow EMA', type: 'number' as const, default: 26, min: 10, max: 100 },
      { key: 'signal', label: 'Signal Period', type: 'number' as const, default: 9, min: 2, max: 30 },
    ],
  },
]

const oneYearAgo = new Date()
oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)

const defaultConfig = {
  strategyId: 'sma_crossover',
  pair: 'EUR/USD',
  timeframe: '1h' as const,
  startDate: oneYearAgo.toISOString().split('T')[0],
  endDate: new Date().toISOString().split('T')[0],
  initialBalance: 10000,
  lotSize: 0.1,
  stopLoss: 20,
  takeProfit: 40,
}

function inputClass(className?: string) {
  return cn(
    'w-full bg-[#0f1117] border border-[#21262d] rounded px-3 py-2 text-sm text-[#e6edf3] focus:outline-none focus:border-[#58a6ff] transition-colors',
    className
  )
}

function labelClass() {
  return 'block text-xs text-[#8b949e] mb-1 font-medium uppercase tracking-wide'
}

export default function BacktestingPage() {
  const [config, setConfig] = useState(defaultConfig)
  const [strategyParams, setStrategyParams] = useState<Record<string, number>>({
    fastPeriod: 10,
    slowPeriod: 20,
  })
  const [result, setResult] = useState<BacktestResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selectedStrategy = STRATEGIES.find((s) => s.id === config.strategyId) ?? STRATEGIES[0]

  const handleStrategyChange = (strategyId: string) => {
    const strategy = STRATEGIES.find((s) => s.id === strategyId)
    if (!strategy) return
    const defaultParams: Record<string, number> = {}
    strategy.params.forEach((p) => {
      defaultParams[p.key] = p.default as number
    })
    setConfig((c) => ({ ...c, strategyId }))
    setStrategyParams(defaultParams)
  }

  const runBacktest = async () => {
    setLoading(true)
    setError(null)
    try {
      const body: BacktestConfig = {
        ...config,
        params: strategyParams,
      }
      const res = await fetch('/api/backtest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error('Backtest failed')
      const data: BacktestResult = await res.json()
      setResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const m = result?.metrics

  return (
    <div className="flex flex-col min-h-screen">
      <Header title="Backtesting" subtitle="Test your strategies on historical data" />

      <main className="flex-1 p-6">
        <div className="grid grid-cols-1 xl:grid-cols-[320px_1fr] gap-6">
          {/* Left: Config Panel */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <h2 className="text-sm font-semibold text-[#e6edf3]">Strategy Configuration</h2>
              </CardHeader>
              <CardBody className="space-y-4">
                {/* Strategy */}
                <div>
                  <label className={labelClass()}>Strategy</label>
                  <select
                    className={inputClass()}
                    value={config.strategyId}
                    onChange={(e) => handleStrategyChange(e.target.value)}
                  >
                    {STRATEGIES.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>

                {/* Pair */}
                <div>
                  <label className={labelClass()}>Currency Pair</label>
                  <select
                    className={inputClass()}
                    value={config.pair}
                    onChange={(e) => setConfig((c) => ({ ...c, pair: e.target.value }))}
                  >
                    {CURRENCY_PAIRS.map((p) => (
                      <option key={p.symbol} value={p.symbol}>{p.symbol}</option>
                    ))}
                  </select>
                </div>

                {/* Timeframe */}
                <div>
                  <label className={labelClass()}>Timeframe</label>
                  <select
                    className={inputClass()}
                    value={config.timeframe}
                    onChange={(e) => setConfig((c) => ({ ...c, timeframe: e.target.value as typeof config.timeframe }))}
                  >
                    <option value="1h">1 Hour</option>
                    <option value="4h">4 Hours</option>
                    <option value="1d">1 Day</option>
                  </select>
                </div>

                {/* Date Range */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass()}>Start Date</label>
                    <input
                      type="date"
                      className={inputClass()}
                      value={config.startDate}
                      onChange={(e) => setConfig((c) => ({ ...c, startDate: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className={labelClass()}>End Date</label>
                    <input
                      type="date"
                      className={inputClass()}
                      value={config.endDate}
                      onChange={(e) => setConfig((c) => ({ ...c, endDate: e.target.value }))}
                    />
                  </div>
                </div>
              </CardBody>
            </Card>

            <Card>
              <CardHeader>
                <h2 className="text-sm font-semibold text-[#e6edf3]">Trade Settings</h2>
              </CardHeader>
              <CardBody className="space-y-4">
                <div>
                  <label className={labelClass()}>Initial Balance ($)</label>
                  <input
                    type="number"
                    className={inputClass()}
                    value={config.initialBalance}
                    onChange={(e) => setConfig((c) => ({ ...c, initialBalance: Number(e.target.value) }))}
                  />
                </div>
                <div>
                  <label className={labelClass()}>Lot Size</label>
                  <input
                    type="number"
                    className={inputClass()}
                    value={config.lotSize}
                    step={0.01}
                    min={0.01}
                    onChange={(e) => setConfig((c) => ({ ...c, lotSize: Number(e.target.value) }))}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass()}>Stop Loss (pips)</label>
                    <input
                      type="number"
                      className={inputClass()}
                      value={config.stopLoss}
                      onChange={(e) => setConfig((c) => ({ ...c, stopLoss: Number(e.target.value) }))}
                    />
                  </div>
                  <div>
                    <label className={labelClass()}>Take Profit (pips)</label>
                    <input
                      type="number"
                      className={inputClass()}
                      value={config.takeProfit}
                      onChange={(e) => setConfig((c) => ({ ...c, takeProfit: Number(e.target.value) }))}
                    />
                  </div>
                </div>
              </CardBody>
            </Card>

            {/* Strategy Params */}
            <Card>
              <CardHeader>
                <h2 className="text-sm font-semibold text-[#e6edf3]">
                  {selectedStrategy.name} Parameters
                </h2>
              </CardHeader>
              <CardBody className="space-y-4">
                {selectedStrategy.params.map((param) => (
                  <div key={param.key}>
                    <label className={labelClass()}>{param.label}</label>
                    <input
                      type="number"
                      className={inputClass()}
                      value={strategyParams[param.key] ?? param.default}
                      min={param.min}
                      max={param.max}
                      onChange={(e) =>
                        setStrategyParams((p) => ({ ...p, [param.key]: Number(e.target.value) }))
                      }
                    />
                  </div>
                ))}
              </CardBody>
            </Card>

            <button
              onClick={runBacktest}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#58a6ff] hover:bg-[#79b8ff] text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Running Backtest...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  Run Backtest
                </>
              )}
            </button>

            {error && (
              <div className="bg-[#f85149]/10 border border-[#f85149]/30 rounded p-3 text-sm text-[#f85149]">
                {error}
              </div>
            )}
          </div>

          {/* Right: Results */}
          <div className="space-y-4">
            {!result && !loading && (
              <div className="h-64 flex items-center justify-center text-[#8b949e] text-sm">
                <div className="text-center">
                  <Play className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p>Configure and run a backtest to see results</p>
                </div>
              </div>
            )}

            {loading && (
              <div className="h-64 flex items-center justify-center">
                <div className="text-center">
                  <Loader2 className="w-10 h-10 mx-auto mb-3 text-[#58a6ff] animate-spin" />
                  <p className="text-[#8b949e] text-sm">Running backtest...</p>
                </div>
              </div>
            )}

            {result && !loading && m && (
              <>
                {/* Equity Chart */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <h2 className="text-sm font-semibold text-[#e6edf3]">Equity Curve</h2>
                      <div className="flex items-center gap-2">
                        <span className={cn('text-sm font-bold', m.totalReturn >= 0 ? 'text-[#3fb950]' : 'text-[#f85149]')}>
                          {m.totalReturn >= 0 ? '+' : ''}{m.totalReturn}%
                        </span>
                        {m.totalReturn >= 0 ? (
                          <TrendingUp className="w-4 h-4 text-[#3fb950]" />
                        ) : (
                          <TrendingDown className="w-4 h-4 text-[#f85149]" />
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardBody className="p-0 pt-4 pb-2">
                    <EquityChart data={result.equity} initialBalance={result.config.initialBalance} height={250} />
                  </CardBody>
                </Card>

                {/* Metrics Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { label: 'Total Return', value: `${m.totalReturn >= 0 ? '+' : ''}${m.totalReturn}%`, positive: m.totalReturn >= 0 },
                    { label: 'Total P&L', value: formatCurrency(m.totalPnl), positive: m.totalPnl >= 0 },
                    { label: 'Win Rate', value: `${m.winRate}%`, positive: m.winRate >= 50 },
                    { label: 'Profit Factor', value: m.profitFactor.toFixed(2), positive: m.profitFactor >= 1 },
                    { label: 'Max Drawdown', value: `${m.maxDrawdown}%`, positive: m.maxDrawdown < 20 },
                    { label: 'Sharpe Ratio', value: m.sharpeRatio.toFixed(2), positive: m.sharpeRatio >= 0 },
                    { label: 'Total Trades', value: String(m.totalTrades), positive: true },
                    { label: 'Expectancy', value: `${m.expectancy >= 0 ? '+' : ''}${m.expectancy} pips`, positive: m.expectancy >= 0 },
                  ].map(({ label, value, positive }) => (
                    <Card key={label} className="p-3">
                      <p className="text-xs text-[#8b949e] mb-1">{label}</p>
                      <p className={cn('text-lg font-bold', positive ? 'text-[#3fb950]' : 'text-[#f85149]')}>{value}</p>
                    </Card>
                  ))}
                </div>

                {/* Additional Stats */}
                <div className="grid grid-cols-3 gap-3">
                  <Card className="p-3">
                    <p className="text-xs text-[#8b949e] mb-1">Winning Trades</p>
                    <p className="text-lg font-bold text-[#3fb950]">{m.winningTrades}</p>
                  </Card>
                  <Card className="p-3">
                    <p className="text-xs text-[#8b949e] mb-1">Losing Trades</p>
                    <p className="text-lg font-bold text-[#f85149]">{m.losingTrades}</p>
                  </Card>
                  <Card className="p-3">
                    <p className="text-xs text-[#8b949e] mb-1">Avg Win / Avg Loss</p>
                    <p className="text-sm font-bold text-[#e6edf3]">
                      <span className="text-[#3fb950]">+{m.avgWin}</span>
                      {' / '}
                      <span className="text-[#f85149]">{m.avgLoss}</span>
                      <span className="text-[#8b949e] text-xs ml-1">pips</span>
                    </p>
                  </Card>
                </div>

                {/* Trade List */}
                <Card>
                  <CardHeader>
                    <h2 className="text-sm font-semibold text-[#e6edf3]">
                      Trade List ({result.trades.length} trades)
                    </h2>
                  </CardHeader>
                  <div className="max-h-80 overflow-auto">
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 bg-[#161b22]">
                        <tr className="border-b border-[#21262d]">
                          <th className="text-left text-[#8b949e] px-4 py-2 font-medium">#</th>
                          <th className="text-left text-[#8b949e] px-3 py-2 font-medium">Side</th>
                          <th className="text-left text-[#8b949e] px-3 py-2 font-medium">Entry Time</th>
                          <th className="text-right text-[#8b949e] px-3 py-2 font-medium">Entry</th>
                          <th className="text-right text-[#8b949e] px-3 py-2 font-medium">Exit</th>
                          <th className="text-right text-[#8b949e] px-3 py-2 font-medium">Pips</th>
                          <th className="text-right text-[#8b949e] px-3 py-2 font-medium">P&L</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.trades.map((trade, idx) => {
                          const isWin = trade.pnl > 0
                          return (
                            <tr
                              key={trade.id}
                              className="border-b border-[#21262d]/50 hover:bg-[#21262d]/30"
                            >
                              <td className="px-4 py-2 text-[#8b949e]">{idx + 1}</td>
                              <td className="px-3 py-2">
                                <Badge variant={trade.side === 'buy' ? 'green' : 'red'}>
                                  {trade.side.toUpperCase()}
                                </Badge>
                              </td>
                              <td className="px-3 py-2 text-[#8b949e]">
                                {format(new Date(trade.entryTime), 'MMM d, HH:mm')}
                              </td>
                              <td className="px-3 py-2 text-right text-[#e6edf3] tabular-nums">
                                {trade.entryPrice}
                              </td>
                              <td className="px-3 py-2 text-right text-[#e6edf3] tabular-nums">
                                {trade.exitPrice}
                              </td>
                              <td
                                className={cn(
                                  'px-3 py-2 text-right font-medium tabular-nums',
                                  isWin ? 'text-[#3fb950]' : 'text-[#f85149]'
                                )}
                              >
                                {trade.pips > 0 ? '+' : ''}{trade.pips.toFixed(1)}
                              </td>
                              <td
                                className={cn(
                                  'px-3 py-2 text-right font-medium tabular-nums',
                                  isWin ? 'text-[#3fb950]' : 'text-[#f85149]'
                                )}
                              >
                                {trade.pnl >= 0 ? '+' : ''}${trade.pnl.toFixed(2)}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                    {result.trades.length === 0 && (
                      <div className="py-8 text-center text-[#8b949e] text-sm">
                        No trades generated. Try adjusting the strategy parameters or date range.
                      </div>
                    )}
                  </div>
                </Card>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
