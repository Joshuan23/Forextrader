import type { Metadata } from 'next'
import Link from 'next/link'
import { ToolsShell } from '@/components/tools/ToolsShell'
import { PositionSizeCalculator } from '@/components/tools/PositionSizeCalculator'
import { ToolCTA } from '@/components/tools/ToolCTA'
import { CURRENCY_PAIRS, pairSlug } from '@/lib/forex/pairs'

export const metadata: Metadata = {
  title: 'Forex Position Size Calculator — Lot Size by Risk % (Free)',
  description:
    'Free forex position size calculator. Enter account size, risk percent and stop-loss in pips to get exact lot size, units and dollars per pip. Works for FX pairs, gold, silver and indices.',
}

export default function PositionSizeCalculatorPage() {
  return (
    <ToolsShell>
      <h1 className="text-3xl font-bold text-[#e6edf3] mb-2">Forex position size calculator</h1>
      <p className="text-[#8b949e] mb-8">
        Get your exact lot size from account balance, risk percentage and stop-loss distance —
        so one bad trade never blows your account or your prop-firm challenge.
      </p>

      <PositionSizeCalculator />

      <section className="mt-10 space-y-6 text-sm text-[#8b949e] leading-relaxed">
        <div>
          <h2 className="text-lg font-semibold text-[#e6edf3] mb-2">How position sizing works</h2>
          <p>
            Position size is the only risk variable fully under your control. The formula:
            <span className="text-[#e6edf3]"> lots = (account × risk%) ÷ (stop-loss pips × pip value per lot)</span>.
            Risking 1% of a $10,000 account is $100; with a 20-pip stop on EUR/USD (where one pip
            per standard lot is $10), that means a 0.50-lot position. Wider stop, smaller
            position — same dollar risk on every trade.
          </p>
        </div>
        <div>
          <h2 className="text-lg font-semibold text-[#e6edf3] mb-2">
            Why prop-firm traders size positions strictly
          </h2>
          <p>
            Challenge accounts fail on drawdown rules, not on bad ideas. A typical 2-step
            evaluation allows a 5% daily loss and 10% total drawdown. Risking 0.5–1% per trade
            means you can take five or more consecutive losses in a day without breaching the daily
            limit. Pair this calculator with our{' '}
            <Link href="/tools/prop-firm-drawdown-calculator" className="text-[#58a6ff] hover:underline">
              prop firm drawdown calculator
            </Link>{' '}
            to know exactly how much room you have left.
          </p>
        </div>
        <div>
          <h2 className="text-lg font-semibold text-[#e6edf3] mb-2">Calculators by market</h2>
          <div className="flex flex-wrap gap-2 mt-2">
            {CURRENCY_PAIRS.map(p => (
              <Link
                key={p.symbol}
                href={`/tools/position-size-calculator/${pairSlug(p.symbol)}`}
                className="px-3 py-1.5 bg-[#161b22] border border-[#21262d] hover:border-[#58a6ff]/50 rounded-lg text-xs text-[#8b949e] hover:text-[#e6edf3] transition-colors"
              >
                {p.symbol}
              </Link>
            ))}
          </div>
        </div>
      </section>

      <ToolCTA />
    </ToolsShell>
  )
}
