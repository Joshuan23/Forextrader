import { NextResponse } from 'next/server'
import { deleteJournalEntry } from '@/lib/store/journal'
import { errorResponse } from '@/lib/config/runtime'

export const dynamic = 'force-dynamic'

// DELETE /api/journal/:id
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    await deleteJournalEntry(params.id)
    return NextResponse.json({ ok: true })
  } catch (e) {
    const { body, status } = errorResponse(e)
    return NextResponse.json(body, { status })
  }
}
