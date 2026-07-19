import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { addJournalEntry, listJournalEntries } from '@/lib/store/journal'
import { errorResponse } from '@/lib/config/runtime'

export const dynamic = 'force-dynamic'

// GET  /api/journal — full journal (real DB rows)
// POST /api/journal — create an entry (Zod-validated)

export async function GET() {
  try {
    const entries = await listJournalEntries()
    return NextResponse.json({ ok: true, count: entries.length, entries })
  } catch (e) {
    const { body, status } = errorResponse(e)
    return NextResponse.json(body, { status })
  }
}

const entrySchema = z.object({
  symbol: z.string().min(3),
  direction: z.enum(['long', 'short']),
  setupType: z.enum([
    'pullback_continuation',
    'breakout_retest',
    'liquidity_sweep_reversal',
    'range_fade',
    'orderblock_mitigation',
  ]),
  sessionTag: z.enum(['asia', 'london', 'newyork', 'london_ny_overlap', 'asia_london_overlap', 'dead_zone']),
  regimeTag: z.enum(['trending_up', 'trending_down', 'ranging', 'volatile_expansion', 'quiet']),
  grade: z.enum(['A', 'B', 'C', 'blocked']),
  taken: z.boolean(),
  resultR: z.number().min(-10).max(50).optional(),
  resultPips: z.number().min(-5000).max(5000).optional(),
  mistakes: z.array(z.string()).max(10).default([]),
  screenshots: z.array(z.string().url()).max(6).default([]),
  notes: z.string().max(4000).default(''),
  signalId: z.string().optional(),
  entryAt: z.number().optional(),
  exitAt: z.number().optional(),
})

export async function POST(req: NextRequest) {
  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 })
  }
  const parsed = entrySchema.safeParse(raw)
  if (!parsed.success) {
    const error = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')
    return NextResponse.json({ ok: false, error }, { status: 422 })
  }
  try {
    const record = await addJournalEntry(parsed.data)
    return NextResponse.json({ ok: true, entry: record }, { status: 201 })
  } catch (e) {
    const { body, status } = errorResponse(e)
    return NextResponse.json(body, { status })
  }
}
