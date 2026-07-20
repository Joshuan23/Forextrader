'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { getSupabaseBrowser } from '@/lib/supabase/client'
import { LoginCard } from './login-card'

interface AuthValue {
  user: User | null
  configured: boolean
  signOut: () => Promise<void>
}

const Ctx = createContext<AuthValue>({ user: null, configured: false, signOut: async () => {} })

// Gates the app behind Supabase Auth — but ONLY when auth is configured
// (NEXT_PUBLIC_SUPABASE_URL / _ANON_KEY present). Without those vars the app
// renders exactly as before, so enabling auth is a pure opt-in via env.
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const supabase = getSupabaseBrowser()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(Boolean(supabase))

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })
    return () => sub.subscription.unsubscribe()
  }, [supabase])

  // Auth not configured → app runs open, unchanged.
  if (!supabase) {
    return <Ctx.Provider value={{ user: null, configured: false, signOut: async () => {} }}>{children}</Ctx.Provider>
  }
  if (loading) {
    return <div className="grid min-h-screen place-items-center text-sm text-muted-foreground">Loading…</div>
  }
  if (!user) return <LoginCard />

  const signOut = async () => {
    await supabase.auth.signOut()
  }
  return <Ctx.Provider value={{ user, configured: true, signOut }}>{children}</Ctx.Provider>
}

export function useAuth(): AuthValue {
  return useContext(Ctx)
}
