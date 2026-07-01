'use client'

import { useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { TrendingUp } from 'lucide-react'

export default function SuccessInner() {
  const params = useSearchParams()
  const sessionId = params.get('session_id')

  useEffect(() => {
    if (!sessionId) return

    fetch(`/api/stripe/session?session_id=${sessionId}`)
      .then(r => r.json())
      .then(({ email, error }) => {
        if (error || !email) {
          window.location.href = '/login'
          return null
        }
        return fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        })
      })
      .then(r => r?.json())
      .then(data => {
        if (data?.redirect) window.location.href = data.redirect
      })
  }, [sessionId])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-[#3fb950]/20 flex items-center justify-center mx-auto">
          <TrendingUp className="w-6 h-6 text-[#3fb950]" />
        </div>
        <h1 className="text-2xl font-semibold text-[#e6edf3]">You&apos;re in.</h1>
        <p className="text-[#8b949e]">Setting up your account&hellip;</p>
      </div>
    </div>
  )
}
