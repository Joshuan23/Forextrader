import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { AppState } from 'react-native'
import { getBillingProvider } from '@/billing'
import { getSupabase } from '@/lib/supabase'
import { FREE_ENTITLEMENT, isEntitled, type Entitlement } from './types'

interface EntitlementContextValue {
  entitlement: Entitlement
  entitled: boolean
  loading: boolean
  /** Billing/config failure message. Entitlement is fail-closed to FREE — never a fake paid state. */
  error: string | null
  refresh: () => Promise<void>
}

const Ctx = createContext<EntitlementContextValue>({
  entitlement: FREE_ENTITLEMENT,
  entitled: false,
  loading: true,
  error: null,
  refresh: async () => {},
})

// Entitlements refresh on mount, on login, and every foreground — the
// billing provider (RevenueCat/mock) is the source of truth on device;
// the backend `entitlements` table (synced by webhook) is authoritative
// for server-gated data.
export function EntitlementProvider({ children }: { children: React.ReactNode }) {
  const [entitlement, setEntitlement] = useState<Entitlement>(FREE_ENTITLEMENT)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      const billing = getBillingProvider()
      const supabase = getSupabase()
      const userId = supabase ? (await supabase.auth.getUser()).data.user?.id ?? null : null
      await billing.init(userId)
      setEntitlement(await billing.getEntitlement())
      setError(null)
    } catch (e) {
      // Fail-closed: configuration/billing failures resolve to FREE,
      // never a fake paid state — and the reason is surfaced to the UI.
      setEntitlement(FREE_ENTITLEMENT)
      setError(e instanceof Error ? e.message : 'Billing unavailable')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refresh()
    })
    return () => sub.remove()
  }, [refresh])

  return (
    <Ctx.Provider value={{ entitlement, entitled: isEntitled(entitlement), loading, error, refresh }}>
      {children}
    </Ctx.Provider>
  )
}

export function useEntitlement(): EntitlementContextValue {
  return useContext(Ctx)
}
