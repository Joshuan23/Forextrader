'use client'

import { useState } from 'react'
import { Activity } from 'lucide-react'
import { getSupabaseBrowser } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

// Full-screen sign-in / sign-up shown by AuthProvider when auth is configured
// and no session exists. Email + password via Supabase Auth.
export function LoginCard() {
  const supabase = getSupabaseBrowser()
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!supabase) return
    setBusy(true)
    setMessage(null)
    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        // onAuthStateChange in AuthProvider swaps to the app automatically.
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        if (!data.session) {
          setMessage('Account created. Check your email to confirm, then sign in.')
          setMode('signin')
        }
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Authentication failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/15">
            <Activity className="h-5 w-5 text-primary" />
          </div>
          <div className="leading-tight">
            <div className="text-base font-semibold tracking-tight">FlowEdge</div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">FX Decision Engine</div>
          </div>
        </div>

        <div className="rounded-lg border bg-card p-5">
          <h1 className="text-lg font-semibold">{mode === 'signin' ? 'Sign in' : 'Create account'}</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            {mode === 'signin' ? 'Access your trade desk.' : 'Start tracking your edge.'}
          </p>

          <form onSubmit={submit} className="mt-4 space-y-3">
            <div className="space-y-1">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <Button type="submit" disabled={busy} className="w-full">
              {busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}
            </Button>
          </form>

          {message && <p className="mt-3 text-xs text-destructive">{message}</p>}

          <button
            type="button"
            onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setMessage(null) }}
            className="mt-4 w-full text-center text-xs text-muted-foreground hover:text-foreground"
          >
            {mode === 'signin' ? "No account? Create one" : 'Have an account? Sign in'}
          </button>
        </div>
      </div>
    </div>
  )
}
