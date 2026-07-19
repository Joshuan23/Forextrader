import { hasSupabaseAdmin } from '@/lib/config/runtime'
import { sbSelect, sbUpsert } from '@/lib/services/supabase-admin'
import type { EngineSignal } from '@/lib/engine/types'

// Push notification service (Expo push API).
// Fan-out: approved A/B signals → every entitled (pro/elite) user with
// signal_alerts enabled and a registered Expo push token. Failures are
// logged and reported to the caller but never fail signal ingestion.

interface PrefRow {
  user_id: string
  expo_push_token: string | null
  signal_alerts: boolean
}
interface EntRow {
  user_id: string
  plan: string
  status: string
}

export async function registerPushToken(args: {
  userId: string
  expoPushToken: string
  signalAlerts?: boolean
}): Promise<void> {
  await sbUpsert(
    'notification_preferences',
    {
      user_id: args.userId,
      expo_push_token: args.expoPushToken,
      signal_alerts: args.signalAlerts ?? true,
      updated_at: new Date().toISOString(),
    },
    'user_id'
  )
}

export async function notifyApprovedSignal(signal: EngineSignal): Promise<{ sent: number; skipped: string | null }> {
  if (!hasSupabaseAdmin()) {
    return { sent: 0, skipped: 'push_skipped: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not configured' }
  }
  if (signal.status !== 'approved' || (signal.grade !== 'A' && signal.grade !== 'B')) {
    return { sent: 0, skipped: 'not an approved A/B signal' }
  }

  const [prefs, ents] = await Promise.all([
    sbSelect<PrefRow>(
      'notification_preferences',
      'signal_alerts=eq.true&expo_push_token=not.is.null&select=user_id,expo_push_token,signal_alerts'
    ),
    sbSelect<EntRow>(
      'entitlements',
      'plan=in.(pro,elite)&status=in.(active,trialing,grace,cancelled)&select=user_id,plan,status'
    ),
  ])
  const entitled = new Set(ents.map((e) => e.user_id))
  const tokens = prefs.filter((p) => entitled.has(p.user_id)).map((p) => p.expo_push_token as string)
  if (tokens.length === 0) return { sent: 0, skipped: 'no entitled recipients' }

  const d = signal.symbol.includes('JPY') ? 3 : signal.symbol.includes('XAU') ? 2 : 5
  const title = `${signal.grade}-grade ${signal.direction === 'long' ? 'LONG' : 'SHORT'} ${signal.symbol}`
  const body = `Entry ${signal.plan.entry.toFixed(d)} · SL ${signal.plan.stopLoss.toFixed(d)} · TP1 ${signal.plan.takeProfit1.toFixed(d)} · confidence ${signal.confidence}`

  let sent = 0
  for (let i = 0; i < tokens.length; i += 100) {
    const chunk = tokens.slice(i, i + 100).map((to) => ({
      to,
      title,
      body,
      data: { signalId: signal.id, type: 'signal' },
      sound: 'default',
      priority: 'high',
    }))
    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(chunk),
      signal: AbortSignal.timeout(10_000),
    })
    if (res.ok) sent += chunk.length
    else console.error(`[push] Expo push send failed: HTTP ${res.status} ${await res.text()}`)
  }
  return { sent, skipped: null }
}
