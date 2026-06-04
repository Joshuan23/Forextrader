import { Header } from '@/components/layout/Header'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils'
import { Inbox } from 'lucide-react'
import { format, subDays, subHours } from 'date-fns'

interface HistoricalTrade {
  id: number
  pair: string
  side: 'buy' | 'sell'
  lotSize: number
  entryPrice: number
  exitPrice: number
  openTime: Date
  closeTime: Date
  pips: number
  pnl: number
}

function generateTrades(): HistoricalTrade[] {
  const now = new Date()
  return [
    { id: 1, pair: 'EUR/USD', side: 'buy', lotSize: 0.1, entryPrice: 1.0842, exitPrice: 1.0882, openTime: subDays(subHours(now, 2), 1), closeTime: subDays(now, 1), pips: 40.0, pnl: 40.00 },
    { id: 2, pair: 'GBP/USD', side: 'sell', lotSize: 0.1, entryPrice: 1.2710, exitPrice: 1.2690, openTime: subDays(subHours(now, 5), 2), closeTime: subDays(now, 2), pips: 20.0, pnl: 20.00 },
    { id: 3, pair: 'USD/JPY', side: 'buy', lotSize: 0.1, entryPrice: 149.50, exitPrice: 150.10, openTime: subDays(subHours(now, 3), 2), closeTime: subDays(now, 2), pips: 60.0, pnl: 40.05 },
    { id: 4, pair: 'AUD/USD', side: 'sell', lotSize: 0.2, entryPrice: 0.6530, exitPrice: 0.6510, openTime: subDays(subHours(now, 8), 3), closeTime: subDays(now, 3), pips: 20.0, pnl: 40.00 },
    { id: 5, pair: 'EUR/GBP', side: 'buy', lotSize: 0.1, entryPrice: 0.8540, exitPrice: 0.8520, openTime: subDays(subHours(now, 4), 4), closeTime: subDays(now, 4), pips: -20.0, pnl: -20.00 },
    { id: 6, pair: 'USD/CHF', side: 'sell', lotSize: 0.1, entryPrice: 0.9060, exitPrice: 0.9020, openTime: subDays(subHours(now, 6), 5), closeTime: subDays(now, 5), pips: 40.0, pnl: 44.25 },
    { id: 7, pair: 'NZD/USD', side: 'buy', lotSize: 0.15, entryPrice: 0.5990, exitPrice: 0.6030, openTime: subDays(subHours(now, 2), 6), closeTime: subDays(now, 6), pips: 40.0, pnl: 60.00 },
    { id: 8, pair: 'USD/CAD', side: 'sell', lotSize: 0.1, entryPrice: 1.3650, exitPrice: 1.3610, openTime: subDays(subHours(now, 7), 7), closeTime: subDays(now, 7), pips: 40.0, pnl: 29.33 },
    { id: 9, pair: 'EUR/USD', side: 'sell', lotSize: 0.1, entryPrice: 1.0895, exitPrice: 1.0915, openTime: subDays(subHours(now, 3), 8), closeTime: subDays(now, 8), pips: -20.0, pnl: -20.00 },
    { id: 10, pair: 'GBP/USD', side: 'buy', lotSize: 0.2, entryPrice: 1.2665, exitPrice: 1.2705, openTime: subDays(subHours(now, 5), 9), closeTime: subDays(now, 9), pips: 40.0, pnl: 80.00 },
    { id: 11, pair: 'USD/JPY', side: 'sell', lotSize: 0.1, entryPrice: 150.20, exitPrice: 149.80, openTime: subDays(subHours(now, 4), 10), closeTime: subDays(now, 10), pips: 40.0, pnl: 26.63 },
    { id: 12, pair: 'AUD/USD', side: 'buy', lotSize: 0.1, entryPrice: 0.6490, exitPrice: 0.6520, openTime: subDays(subHours(now, 6), 11), closeTime: subDays(now, 11), pips: 30.0, pnl: 30.00 },
    { id: 13, pair: 'EUR/USD', side: 'buy', lotSize: 0.1, entryPrice: 1.0810, exitPrice: 1.0830, openTime: subDays(subHours(now, 2), 12), closeTime: subDays(now, 12), pips: 20.0, pnl: 20.00 },
    { id: 14, pair: 'USD/CHF', side: 'buy', lotSize: 0.15, entryPrice: 0.9010, exitPrice: 0.8990, openTime: subDays(subHours(now, 8), 13), closeTime: subDays(now, 13), pips: -20.0, pnl: -33.28 },
    { id: 15, pair: 'GBP/USD', side: 'sell', lotSize: 0.1, entryPrice: 1.2750, exitPrice: 1.2700, openTime: subDays(subHours(now, 3), 14), closeTime: subDays(now, 14), pips: 50.0, pnl: 50.00 },
    { id: 16, pair: 'EUR/GBP', side: 'sell', lotSize: 0.1, entryPrice: 0.8570, exitPrice: 0.8540, openTime: subDays(subHours(now, 7), 15), closeTime: subDays(now, 15), pips: 30.0, pnl: 33.00 },
    { id: 17, pair: 'NZD/USD', side: 'sell', lotSize: 0.1, entryPrice: 0.6050, exitPrice: 0.6010, openTime: subDays(subHours(now, 4), 16), closeTime: subDays(now, 16), pips: 40.0, pnl: 40.00 },
    { id: 18, pair: 'USD/CAD', side: 'buy', lotSize: 0.1, entryPrice: 1.3590, exitPrice: 1.3560, openTime: subDays(subHours(now, 5), 17), closeTime: subDays(now, 17), pips: -30.0, pnl: -22.00 },
    { id: 19, pair: 'EUR/USD', side: 'sell', lotSize: 0.2, entryPrice: 1.0920, exitPrice: 1.0880, openTime: subDays(subHours(now, 6), 18), closeTime: subDays(now, 18), pips: 40.0, pnl: 80.00 },
    { id: 20, pair: 'USD/JPY', side: 'buy', lotSize: 0.1, entryPrice: 148.90, exitPrice: 149.60, openTime: subDays(subHours(now, 3), 19), closeTime: subDays(now, 19), pips: 70.0, pnl: 46.73 },
  ]
}

const TRADES = generateTrades()

export default function PositionsPage() {
  const totalPnl = TRADES.reduce((sum, t) => sum + t.pnl, 0)
  const wins = TRADES.filter((t) => t.pnl > 0).length
  const winRate = ((wins / TRADES.length) * 100).toFixed(1)

  return (
    <div className="flex flex-col min-h-screen">
      <Header title="Positions" subtitle="Open positions and trade history" />

      <main className="flex-1 p-6 space-y-6">
        {/* Open Positions */}
        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold text-[#e6edf3]">Open Positions</h2>
          </CardHeader>
          <CardBody>
            <div className="flex flex-col items-center justify-center py-10 text-[#8b949e]">
              <Inbox className="w-12 h-12 mb-3 opacity-30" />
              <p className="text-sm font-medium">No open positions</p>
              <p className="text-xs mt-1">Run a backtest to simulate trades.</p>
            </div>
          </CardBody>
        </Card>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="p-4">
            <p className="text-xs text-[#8b949e] mb-1 uppercase tracking-wide">Total Trades</p>
            <p className="text-2xl font-bold text-[#e6edf3]">{TRADES.length}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-[#8b949e] mb-1 uppercase tracking-wide">Win Rate</p>
            <p className={cn('text-2xl font-bold', parseFloat(winRate) >= 50 ? 'text-[#3fb950]' : 'text-[#f85149]')}>
              {winRate}%
            </p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-[#8b949e] mb-1 uppercase tracking-wide">Total P&L</p>
            <p className={cn('text-2xl font-bold', totalPnl >= 0 ? 'text-[#3fb950]' : 'text-[#f85149]')}>
              {totalPnl >= 0 ? '+' : ''}${totalPnl.toFixed(2)}
            </p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-[#8b949e] mb-1 uppercase tracking-wide">Avg Trade</p>
            <p className={cn('text-2xl font-bold', totalPnl / TRADES.length >= 0 ? 'text-[#3fb950]' : 'text-[#f85149]')}>
              {(totalPnl / TRADES.length) >= 0 ? '+' : ''}${(totalPnl / TRADES.length).toFixed(2)}
            </p>
          </Card>
        </div>

        {/* Trade History */}
        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold text-[#e6edf3]">Trade History ({TRADES.length} trades)</h2>
          </CardHeader>
          <div className="overflow-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[#21262d]">
                  <th className="text-left text-[#8b949e] px-4 py-2 font-medium">#</th>
                  <th className="text-left text-[#8b949e] px-3 py-2 font-medium">Pair</th>
                  <th className="text-left text-[#8b949e] px-3 py-2 font-medium">Side</th>
                  <th className="text-right text-[#8b949e] px-3 py-2 font-medium">Lots</th>
                  <th className="text-right text-[#8b949e] px-3 py-2 font-medium">Entry Price</th>
                  <th className="text-right text-[#8b949e] px-3 py-2 font-medium">Exit Price</th>
                  <th className="text-right text-[#8b949e] px-3 py-2 font-medium">Open Time</th>
                  <th className="text-right text-[#8b949e] px-3 py-2 font-medium">Close Time</th>
                  <th className="text-right text-[#8b949e] px-3 py-2 font-medium">Pips</th>
                  <th className="text-right text-[#8b949e] px-3 py-2 font-medium">P&L</th>
                </tr>
              </thead>
              <tbody>
                {TRADES.map((trade) => {
                  const isWin = trade.pnl > 0
                  return (
                    <tr
                      key={trade.id}
                      className="border-b border-[#21262d]/50 hover:bg-[#21262d]/30 transition-colors"
                    >
                      <td className="px-4 py-2.5 text-[#8b949e]">{trade.id}</td>
                      <td className="px-3 py-2.5 font-medium text-[#e6edf3]">{trade.pair}</td>
                      <td className="px-3 py-2.5">
                        <Badge variant={trade.side === 'buy' ? 'green' : 'red'}>
                          {trade.side.toUpperCase()}
                        </Badge>
                      </td>
                      <td className="px-3 py-2.5 text-right text-[#8b949e] tabular-nums">
                        {trade.lotSize}
                      </td>
                      <td className="px-3 py-2.5 text-right text-[#e6edf3] tabular-nums">
                        {trade.entryPrice}
                      </td>
                      <td className="px-3 py-2.5 text-right text-[#e6edf3] tabular-nums">
                        {trade.exitPrice}
                      </td>
                      <td className="px-3 py-2.5 text-right text-[#8b949e]">
                        {format(trade.openTime, 'MMM d, HH:mm')}
                      </td>
                      <td className="px-3 py-2.5 text-right text-[#8b949e]">
                        {format(trade.closeTime, 'MMM d, HH:mm')}
                      </td>
                      <td
                        className={cn(
                          'px-3 py-2.5 text-right font-medium tabular-nums',
                          isWin ? 'text-[#3fb950]' : 'text-[#f85149]'
                        )}
                      >
                        {trade.pips > 0 ? '+' : ''}{trade.pips.toFixed(1)}
                      </td>
                      <td
                        className={cn(
                          'px-3 py-2.5 text-right font-medium tabular-nums',
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
          </div>
        </Card>
      </main>
    </div>
  )
}
