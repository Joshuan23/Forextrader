'use client'

import { useState, FormEvent } from 'react'
import { TrendingUp } from 'lucide-react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()
      if (data.redirect) {
        window.location.href = data.redirect
        return
      }
      setError(data.error || 'Something went wrong. Try again.')
    } catch {
      setError('Network error. Check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2 justify-center mb-8">
          <div className="w-8 h-8 rounded-lg bg-[#58a6ff] flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-white" />
          </div>
          <span className="text-lg font-semibold text-[#e6edf3]">ForexTrader Pro</span>
        </div>

        <div className="bg-[#161b22] border border-[#21262d] rounded-xl p-8">
          <h1 className="text-xl font-semibold text-[#e6edf3] mb-2">Access your account</h1>
          <p className="text-sm text-[#8b949e] mb-6">Enter the email you used to sign up.</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full px-4 py-2.5 bg-[#0f1117] border border-[#21262d] rounded-lg text-[#e6edf3] placeholder-[#484f58] text-sm focus:outline-none focus:border-[#58a6ff]"
            />

            {error && <p className="text-sm text-[#f85149]">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-[#58a6ff] hover:bg-[#4393e6] disabled:opacity-50 text-white font-medium rounded-lg text-sm transition-colors"
            >
              {loading ? 'Checking...' : 'Continue'}
            </button>
          </form>

          <p className="text-xs text-[#8b949e] text-center mt-4">
            No account?{' '}
            <a href="/" className="text-[#58a6ff] hover:underline">
              Start free trial
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}
