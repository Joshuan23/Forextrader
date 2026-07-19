import { NextResponse } from 'next/server'
import { listStoredSignals } from '@/lib/store/signals'
import { errorResponse } from '@/lib/config/runtime'

export const dynamic = 'force-dynamic'

// GET /api/signals/:id — one persisted signal with its complete trade plan,
// layer scores, derivations, and lifecycle.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const all = await listStoredSignals(500)
    const signal = all.find((s) => s.id === params.id)
    if (!signal) return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
    return NextResponse.json({ ok: true, signal })
  } catch (e) {
    const { body, status } = errorResponse(e)
    return NextResponse.json(body, { status })
  }
}
