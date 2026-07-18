'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { addJournalEntry, deleteJournalEntry } from '@/lib/store/journal'

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
  mistakes: z.array(z.string()).max(10),
  screenshots: z.array(z.string().url()).max(6),
  notes: z.string().max(4000),
  signalId: z.string().optional(),
})

export type JournalFormState = { ok: boolean; error?: string }

export async function createJournalEntry(
  _prev: JournalFormState,
  formData: FormData
): Promise<JournalFormState> {
  const raw = {
    symbol: String(formData.get('symbol') ?? ''),
    direction: String(formData.get('direction') ?? 'long'),
    setupType: String(formData.get('setupType') ?? 'pullback_continuation'),
    sessionTag: String(formData.get('sessionTag') ?? 'london'),
    regimeTag: String(formData.get('regimeTag') ?? 'ranging'),
    grade: String(formData.get('grade') ?? 'B'),
    taken: formData.get('taken') === 'on' || formData.get('taken') === 'true',
    resultR: numOrUndefined(formData.get('resultR')),
    resultPips: numOrUndefined(formData.get('resultPips')),
    mistakes: String(formData.get('mistakes') ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    screenshots: String(formData.get('screenshots') ?? '')
      .split(/[\n,]/)
      .map((s) => s.trim())
      .filter(Boolean),
    notes: String(formData.get('notes') ?? ''),
    signalId: formData.get('signalId') ? String(formData.get('signalId')) : undefined,
  }

  const parsed = entrySchema.safeParse(raw)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid entry' }
  }

  await addJournalEntry(parsed.data)
  revalidatePath('/journal')
  revalidatePath('/analytics')
  return { ok: true }
}

export async function removeJournalEntry(id: string): Promise<void> {
  await deleteJournalEntry(id)
  revalidatePath('/journal')
  revalidatePath('/analytics')
}

function numOrUndefined(v: FormDataEntryValue | null): number | undefined {
  if (v === null || v === '') return undefined
  const n = Number(v)
  return Number.isFinite(n) ? n : undefined
}
