import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

// Conversion block placed under every free tool — turns SEO traffic into
// waitlist signups / trials.
export function ToolCTA() {
  return (
    <div className="mt-10 bg-gradient-to-br from-[#58a6ff]/10 to-transparent border border-[#58a6ff]/25 rounded-xl p-6">
      <h2 className="text-lg font-semibold text-[#e6edf3] mb-1">
        Stop calculating by hand. Trade with a live risk dashboard.
      </h2>
      <p className="text-sm text-[#8b949e] mb-4">
        ForexTrader Pro tracks your challenge limits in real time and pairs it with SMC signals,
        COT institutional positioning, and a full backtesting engine.
      </p>
      <Link
        href="/"
        className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#58a6ff] hover:bg-[#4393e6] text-white text-sm font-medium rounded-lg transition-colors"
      >
        Get early access <ArrowRight className="w-4 h-4" />
      </Link>
    </div>
  )
}
