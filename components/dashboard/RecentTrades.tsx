import { Card, CardHeader } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils'

interface MockTrade {
  pair: string
  side: 'buy' | 'sell'
  entry: number
  exit: number
  pips: number
  pnl: number
}

const MOCK_TRADES: MockTrade[] = [
  { pair: 'EUR/USD', side: 'buy', entry: 1.0842, exit: 1.0882, pips: 40, pnl: 40.00 },
  { pair: 'GBP/USD', side: 'sell', entry: 1.2710, exit: 1.2690, pips: 20, pnl: 20.00 },
  { pair: 'USD/JPY', side: 'buy', entry: 149.50, exit: 150.10, pips: 60, pnl: 40.05 },
  { pair: 'AUD/USD', side: 'sell', entry: 0.6530, exit: 0.6510, pips: 20, pnl: 20.00 },
  { pair: 'EUR/GBP', side: 'buy', entry: 0.8540, exit: 0.8520, pips: -20, pnl: -20.00 },
  { pair: 'USD/CHF', side: 'sell', entry: 0.9060, exit: 0.9020, pips: 40, pnl: 44.25 },
  { pair: 'NZD/USD', side: 'buy', entry: 0.5990, exit: 0.6030, pips: 40, pnl: 40.00 },
  { pair: 'USD/CAD', side: 'sell', entry: 1.3650, exit: 1.3610, pips: 40, pnl: 29.33 },
  { pair: 'EUR/USD', side: 'sell', entry: 1.0895, exit: 1.0915, pips: -20, pnl: -20.00 },
  { pair: 'GBP/USD', side: 'buy', entry: 1.2665, exit: 1.2705, pips: 40, pnl: 40.00 },
]

export function RecentTrades() {
  return (
    <Card className="flex flex-col overflow-hidden">
      <CardHeader>
        <h2 className="text-sm font-semibold text-[#e6edf3]">Recent Trades</h2>
      </CardHeader>
      <div className="overflow-auto flex-1">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-[#21262d]">
              <th className="text-left text-[#8b949e] px-4 py-2 font-medium">Pair</th>
              <th className="text-left text-[#8b949e] px-3 py-2 font-medium">Side</th>
              <th className="text-right text-[#8b949e] px-3 py-2 font-medium">Entry</th>
              <th className="text-right text-[#8b949e] px-3 py-2 font-medium">Exit</th>
              <th className="text-right text-[#8b949e] px-3 py-2 font-medium">Pips</th>
              <th className="text-right text-[#8b949e] px-3 py-2 font-medium">P&L</th>
            </tr>
          </thead>
          <tbody>
            {MOCK_TRADES.map((trade, idx) => {
              const isWin = trade.pnl > 0
              return (
                <tr key={idx} className="border-b border-[#21262d]/50 hover:bg-[#21262d]/30 transition-colors">
                  <td className="px-4 py-2.5 font-medium text-[#e6edf3]">{trade.pair}</td>
                  <td className="px-3 py-2.5">
                    <Badge variant={trade.side === 'buy' ? 'green' : 'red'}>
                      {trade.side.toUpperCase()}
                    </Badge>
                  </td>
                  <td className="px-3 py-2.5 text-right text-[#8b949e] tabular-nums">{trade.entry}</td>
                  <td className="px-3 py-2.5 text-right text-[#8b949e] tabular-nums">{trade.exit}</td>
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
  )
}
