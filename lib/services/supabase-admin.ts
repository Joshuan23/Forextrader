import { requireSupabaseAdmin } from '@/lib/config/runtime'

// Server-only Supabase access via the service role. Never import from
// client components — the service key bypasses RLS by design (entitlement
// sync, push fan-out, signal publishing).

function creds(): { url: string; key: string } {
  requireSupabaseAdmin('Supabase admin access')
  return { url: process.env.SUPABASE_URL!, key: process.env.SUPABASE_SERVICE_ROLE_KEY! }
}

export async function sbSelect<T>(table: string, query: string): Promise<T[]> {
  const { url, key } = creds()
  const res = await fetch(`${url}/rest/v1/${table}?${query}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(8000),
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`Supabase select ${table} failed: HTTP ${res.status} ${await res.text()}`)
  return (await res.json()) as T[]
}

export async function sbUpsert(table: string, row: Record<string, unknown>, onConflict?: string): Promise<void> {
  const { url, key } = creds()
  const qs = onConflict ? `?on_conflict=${onConflict}` : ''
  const res = await fetch(`${url}/rest/v1/${table}${qs}`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates',
    },
    body: JSON.stringify(row),
    signal: AbortSignal.timeout(8000),
  })
  if (!res.ok) throw new Error(`Supabase upsert ${table} failed: HTTP ${res.status} ${await res.text()}`)
}
