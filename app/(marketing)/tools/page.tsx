import type { Metadata } from 'next'
import Link from 'next/link'
import { Calculator, ShieldAlert, ArrowRight } from 'lucide-react'
import { ToolsShell } from '@/components/tools/ToolsShell'
import { CURRENCY_PAIRS, pairSlug } from '@/lib/forex/pairs'

export const metadata: Metadata = {
  title: 'Free Forex & Prop Trading Tools — Position Size, Drawdown Calculators',
  description:
    'Free calculators for forex and prop-firm traders: position size / lot size calculator for every major pair, and a prop-firm drawdown calculator for challenge accounts.',
}

const TOOLS = [
  {
    href: '/tools/position-size-calculator',
    icon: Calculator,
    title: 'Position Size Calculator',
    desc: 'Exact lot size from your account, risk % and stop distance — for every major pair, gold, silver and indices.',
  },
  {
    href: '/tools/prop-firm-drawdown-calculator',
    icon: ShieldAlert,
    title: 'Prop Firm Drawdown Calculator',
    desc: 'See exactly how far you are from a daily-loss or max-drawdown violation on your challenge or funded account.',
  },
]

export default function ToolsIndexPage() {
  return (
    <ToolsShell>
      <h1 className="text-3xl font-bold text-[#e6edf3] mb-2">Free trading tools</h1>
      <p className="text-[#8b949e] mb-8">
        Built by traders, free forever. No signup required.
      </p>

      <div className="space-y-4">
        {TOOLS.map(({ href, icon: Icon, title, desc }) => (
          <Link
            key={href}
            href={href}
            className="flex items-start gap-4 bg-[#161b22] border border-[#21262d] hover:border-[#58a6ff]/50 rounded-xl p-5 transition-colors group"
          >
            <div className="w-10 h-10 rounded-lg bg-[#58a6ff]/10 flex items-center justify-center flex-shrink-0">
              <Icon className="w-5 h-5 text-[#58a6ff]" />
            </div>
            <div className="flex-1">
              <h2 className="font-semibold text-[#e6edf3] mb-1 flex items-center gap-2">
                {title}
                <ArrowRight className="w-4 h-4 text-[#484f58] group-hover:text-[#58a6ff] transition-colors" />
              </h2>
              <p className="text-sm text-[#8b949e]">{desc}</p>
            </div>
          </Link>
        ))}
      </div>

      <h2 className="text-lg font-semibold text-[#e6edf3] mt-10 mb-3">
        Position size calculator by market
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {CURRENCY_PAIRS.map(p => (
          <Link
            key={p.symbol}
            href={`/tools/position-size-calculator/${pairSlug(p.symbol)}`}
            className="px-3 py-2 bg-[#161b22] border border-[#21262d] hover:border-[#58a6ff]/50 rounded-lg text-sm text-[#8b949e] hover:text-[#e6edf3] transition-colors"
          >
            {p.symbol} <span className="text-[#484f58]">· {p.name}</span>
          </Link>
        ))}
      </div>
    </ToolsShell>
  )
}
