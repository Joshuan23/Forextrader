import Link from 'next/link'
import { TrendingUp } from 'lucide-react'
import { CURRENCY_PAIRS, pairSlug } from '@/lib/forex/pairs'

// Shared chrome for the free public /tools pages. Footer links every tool
// page to every other one — internal linking for the programmatic SEO layer.
export function ToolsShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <nav className="flex items-center justify-between px-6 py-4 border-b border-[#21262d]">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#58a6ff] flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-white" />
          </div>
          <span className="font-semibold text-[#e6edf3]">ForexTrader Pro</span>
        </Link>
        <div className="flex items-center gap-5 text-sm">
          <Link href="/tools" className="text-[#8b949e] hover:text-[#e6edf3] transition-colors">
            Free Tools
          </Link>
          <Link href="/login" className="text-[#8b949e] hover:text-[#e6edf3] transition-colors">
            Sign in
          </Link>
        </div>
      </nav>

      <main className="flex-1 w-full max-w-3xl mx-auto px-4 py-10">{children}</main>

      <footer className="border-t border-[#21262d] px-6 py-8 text-xs text-[#484f58]">
        <div className="max-w-3xl mx-auto space-y-4">
          <div>
            <div className="font-medium text-[#8b949e] mb-2">Free trading tools</div>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              <Link href="/tools/position-size-calculator" className="hover:text-[#8b949e]">
                Position Size Calculator
              </Link>
              <Link href="/tools/prop-firm-drawdown-calculator" className="hover:text-[#8b949e]">
                Prop Firm Drawdown Calculator
              </Link>
            </div>
          </div>
          <div>
            <div className="font-medium text-[#8b949e] mb-2">Position size by market</div>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {CURRENCY_PAIRS.map(p => (
                <Link
                  key={p.symbol}
                  href={`/tools/position-size-calculator/${pairSlug(p.symbol)}`}
                  className="hover:text-[#8b949e]"
                >
                  {p.symbol}
                </Link>
              ))}
            </div>
          </div>
          <div className="pt-2 border-t border-[#21262d]">
            © 2026 ForexTrader Pro · <Link href="/" className="hover:text-[#8b949e]">Home</Link> ·{' '}
            <Link href="/login" className="hover:text-[#8b949e]">Sign in</Link>
            <p className="mt-2 max-w-2xl">
              Calculators are provided for education only and are not financial advice. Verify all
              prop-firm rules against your firm&apos;s official dashboard before trading.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
