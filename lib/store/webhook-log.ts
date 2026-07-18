import { getDb } from '@/lib/db'

// Raw webhook audit log. Every inbound payload is stored verbatim (valid
// or not) — DB when available, bounded in-memory ring otherwise.

export interface WebhookLogEntry {
  id: string
  receivedAt: number
  sourceIp?: string
  valid: boolean
  error?: string
  payload: unknown
}

const MAX_MEMORY = 100
const globalStore = globalThis as unknown as { flowedgeWebhookLog?: WebhookLogEntry[] }

export async function logWebhook(entry: Omit<WebhookLogEntry, 'id' | 'receivedAt'>): Promise<void> {
  const db = getDb()
  if (db) {
    await db.rawWebhookLog
      .create({
        data: {
          sourceIp: entry.sourceIp,
          valid: entry.valid,
          error: entry.error,
          payload: JSON.parse(JSON.stringify(entry.payload ?? null)),
        },
      })
      .catch(() => undefined) // audit log must never break ingestion
    return
  }
  if (!globalStore.flowedgeWebhookLog) globalStore.flowedgeWebhookLog = []
  globalStore.flowedgeWebhookLog.unshift({
    ...entry,
    id: `wh-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    receivedAt: Date.now(),
  })
  if (globalStore.flowedgeWebhookLog.length > MAX_MEMORY) {
    globalStore.flowedgeWebhookLog.length = MAX_MEMORY
  }
}
