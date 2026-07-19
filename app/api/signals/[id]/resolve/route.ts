import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { resolveSignal } from '@/lib/store/signals'
import { revalidatePath } from 'next/cache'

export const dynamic = 'force-dynamic'

// POST /api/signals/:id/resolve — record the lifecycle outcome of a
// stored signal: hit_tp1 / hit_tp2 / stopped / cancelled / expired / invalid.

const bodySchema = z.object({
  outcome: z.enum(['hit_tp1', 'hit_tp2', 'stopped', 'cancelled', 'expired', 'invalid', 'active']),
})

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 })
  }
  const parsed = bodySchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: 'outcome must be one of hit_tp1|hit_tp2|stopped|cancelled|expired|invalid|active' },
      { status: 422 }
    )
  }

  const id = params.id.slice(0, 128)
  const signal = await resolveSignal(id, parsed.data.outcome)
  if (!signal) {
    return NextResponse.json({ ok: false, error: 'signal_not_found' }, { status: 404 })
  }

  revalidatePath('/signals')
  return NextResponse.json({ ok: true, signalId: id, status: parsed.data.outcome })
}
