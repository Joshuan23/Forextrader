'use client'

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// Browser Supabase client for auth. Reads the PUBLIC env vars (safe to ship
// to the client — the anon key is RLS-scoped). If they are absent, auth is
// simply not configured and the app runs open, exactly as before.
let cached: SupabaseClient | null | undefined

export function getSupabaseBrowser(): SupabaseClient | null {
  if (cached !== undefined) return cached
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  cached = url && key ? createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true } }) : null
  return cached
}
