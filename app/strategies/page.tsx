import Link from 'next/link'
import { Header } from '@/components/layout/Header'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { TrendingUp, Activity, BarChart2, ArrowRight } from 'lucide-react'

const STRATEGIES = [
  {
    id: 'sma_crossover',
    name: 'SMA Crossover',
    icon: TrendingUp,
    iconColor: '#58a6ff',
    badge: 'Trend Following',
    badgeVariant: 'blue' as const,
    description:
      'A classic trend-following strategy that generates buy signals when the fast Simple Moving Average crosses above the slow SMA, and sell signals when it crosses below. Works best in trending markets with clear directional bias.',
    params: [
      { label: 'Fast Period', default: 10, description: 'Number of candles for fast SMA' },
      { label: 'Slow Period', default: 20, description: 'Number of candles for slow SMA' },
    ],
    pros: ['Simple and easy to understand', 'Good in trending markets', 'Clear entry/exit signals'],
    cons: ['Lagging indicator', 'Prone to whipsaws in choppy markets'],
  },
  {
    id: 'rsi_mean_reversion',
    name: 'RSI Mean Reversion',
    icon: Activity,
    iconColor: '#3fb950',
    badge: 'Mean Reversion',
    badgeVariant: 'green' as const,
    description:
      'Uses the Relative Strength Index to identify overbought and oversold conditions. Enters long when RSI crosses above the oversold threshold and shorts when it crosses below the overbought level. Best suited for ranging, non-trending markets.',
    params: [
      { label: 'RSI Period', default: 14, description: 'Lookback period for RSI calculation' },
      { label: 'Oversold Level', default: 30, description: 'RSI level considered oversold (buy zone)' },
      { label: 'Overbought Level', default: 70, description: 'RSI level considered overbought (sell zone)' },
    ],
    pros: ['Works well in ranging markets', 'Good risk/reward potential', 'Identifies extremes'],
    cons: ['Loses effectiveness in strong trends', 'Can stay overbought/oversold for extended periods'],
  },
  {
    id: 'macd',
    name: 'MACD Strategy',
    icon: BarChart2,
    iconColor: '#d29922',
    badge: 'Momentum',
    badgeVariant: 'amber' as const,
    description:
      'The Moving Average Convergence Divergence strategy generates signals when the MACD line crosses the signal line. A bullish crossover triggers a buy, while a bearish crossover triggers a sell. Combines trend-following with momentum characteristics.',
    params: [
      { label: 'Fast EMA', default: 12, description: 'Fast exponential moving average period' },
      { label: 'Slow EMA', default: 26, description: 'Slow exponential moving average period' },
      { label: 'Signal Period', default: 9, description: 'Signal line smoothing period' },
    ],
    pros: ['Combines trend and momentum', 'Widely used and battle-tested', 'Works across multiple timeframes'],
    cons: ['Lagging in nature', 'Can give false signals in volatile markets'],
  },
]

export default function StrategiesPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <Header title="Strategies" subtitle="Built-in trading strategy library" />

      <main className="flex-1 p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {STRATEGIES.map((strategy) => {
            const Icon = strategy.icon
            return (
              <Card key={strategy.id} className="flex flex-col">
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: `${strategy.iconColor}20` }}
                      >
                        <Icon className="w-5 h-5" style={{ color: strategy.iconColor }} />
                      </div>
                      <div>
                        <h3 className="font-semibold text-[#e6edf3] text-sm">{strategy.name}</h3>
                        <Badge variant={strategy.badgeVariant} className="mt-0.5">
                          {strategy.badge}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </CardHeader>

                <CardBody className="flex-1 space-y-4">
                  <p className="text-sm text-[#8b949e] leading-relaxed">{strategy.description}</p>

                  {/* Parameters */}
                  <div>
                    <h4 className="text-xs font-semibold text-[#e6edf3] uppercase tracking-wide mb-2">
                      Parameters
                    </h4>
                    <div className="space-y-2">
                      {strategy.params.map((param) => (
                        <div
                          key={param.label}
                          className="flex items-center justify-between bg-[#0f1117] rounded px-3 py-2"
                        >
                          <div>
                            <p className="text-xs text-[#e6edf3] font-medium">{param.label}</p>
                            <p className="text-xs text-[#8b949e]">{param.description}</p>
                          </div>
                          <span className="text-xs font-bold text-[#58a6ff] ml-2">
                            {param.default}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Pros & Cons */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <h4 className="text-xs font-semibold text-[#3fb950] uppercase tracking-wide mb-2">
                        Pros
                      </h4>
                      <ul className="space-y-1">
                        {strategy.pros.map((pro) => (
                          <li key={pro} className="text-xs text-[#8b949e] flex items-start gap-1">
                            <span className="text-[#3fb950] mt-0.5">+</span>
                            {pro}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold text-[#f85149] uppercase tracking-wide mb-2">
                        Cons
                      </h4>
                      <ul className="space-y-1">
                        {strategy.cons.map((con) => (
                          <li key={con} className="text-xs text-[#8b949e] flex items-start gap-1">
                            <span className="text-[#f85149] mt-0.5">-</span>
                            {con}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <Link
                    href={`/backtesting?strategy=${strategy.id}`}
                    className="flex items-center justify-center gap-2 w-full mt-auto px-4 py-2.5 bg-[#21262d] hover:bg-[#30363d] text-[#e6edf3] font-medium rounded-lg transition-colors text-sm"
                  >
                    Configure & Backtest
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </CardBody>
              </Card>
            )
          })}
        </div>
      </main>
    </div>
  )
}
