'use client'

import { useState, FormEvent } from 'react'
import { TrendingUp, Zap, BarChart2, FlaskConical, CheckCircle } from 'lucide-react'

export default function LandingPage() {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleWaitlist(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
    } catch {
      // network error — waitlist is best-effort, still show success
    } finally {
      setLoading(false)
    }
    setSubmitted(true)
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-[#21262d]">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#58a6ff] flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-white" />
          </div>
          <span className="font-semibold text-[#e6edf3]">ForexTrader Pro</span>
        </div>
        <a
          href="/login"
          className="text-sm text-[#8b949e] hover:text-[#e6edf3] transition-colors"
        >
          Sign in
        </a>
      </nav>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-20 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#58a6ff]/10 border border-[#58a6ff]/20 rounded-full text-xs text-[#58a6ff] font-medium mb-6">
          <span className="w-1.5 h-1.5 rounded-full bg-[#58a6ff] animate-pulse" />
          Early Access — Joining Waitlist Now
        </div>

        <h1 className="text-4xl lg:text-5xl font-bold text-[#e6edf3] max-w-2xl leading-tight mb-4">
          Institutional-Grade Forex Signals.{' '}
          <span className="text-[#58a6ff]">No Guesswork.</span>
        </h1>

        <p className="text-lg text-[#8b949e] max-w-xl mb-10">
          Smart Money Concepts, COT positioning, and backtested strategies — all in one dashboard.
          Built for serious traders.
        </p>

        {/* Waitlist form */}
        {submitted ? (
          <div className="flex items-center gap-2 text-[#3fb950] font-medium">
            <CheckCircle className="w-5 h-5" />
            You&apos;re on the list — we&apos;ll email you when we open access.
          </div>
        ) : (
          <form onSubmit={handleWaitlist} className="flex gap-2 w-full max-w-sm">
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="your@email.com"
              className="flex-1 px-4 py-3 bg-[#161b22] border border-[#21262d] rounded-lg text-[#e6edf3] placeholder-[#484f58] text-sm focus:outline-none focus:border-[#58a6ff]"
            />
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-3 bg-[#58a6ff] hover:bg-[#4393e6] disabled:opacity-50 text-white font-medium rounded-lg text-sm transition-colors whitespace-nowrap"
            >
              {loading ? '...' : 'Join Waitlist'}
            </button>
          </form>
        )}

        <p className="text-xs text-[#484f58] mt-3">$99/month after launch. Cancel anytime.</p>

        {/* Features */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-16 max-w-3xl w-full text-left">
          {[
            {
              icon: Zap,
              title: 'SMC Signals',
              desc: 'Auto-detected Fair Value Gaps, Order Blocks, and Break of Structure on live charts.',
            },
            {
              icon: BarChart2,
              title: 'COT Analysis',
              desc: 'CFTC Commitment of Traders data visualized weekly — see where institutions are positioned.',
            },
            {
              icon: FlaskConical,
              title: 'Backtesting',
              desc: 'Test any strategy on historical data with Sharpe ratio, drawdown, and win rate metrics.',
            },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="bg-[#161b22] border border-[#21262d] rounded-xl p-5">
              <div className="w-8 h-8 rounded-lg bg-[#58a6ff]/10 flex items-center justify-center mb-3">
                <Icon className="w-4 h-4 text-[#58a6ff]" />
              </div>
              <h3 className="font-semibold text-[#e6edf3] mb-1">{title}</h3>
              <p className="text-sm text-[#8b949e]">{desc}</p>
            </div>
          ))}
        </div>
      </main>

      <footer className="text-center py-6 text-xs text-[#484f58] border-t border-[#21262d]">
        © 2026 ForexTrader Pro · <a href="/login" className="hover:text-[#8b949e]">Sign in</a>
      </footer>
    </div>
  )
}
