import { SignalsList } from '@/components/flowedge/signals-list'
import { scanMarket } from '@/lib/engine'
import { getSettings } from '@/lib/store/settings'
import { listJournalEntries } from '@/lib/store/journal'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Signals' }

export default async function SignalsPage() {
  const [settings, journal] = await Promise.all([getSettings(), listJournalEntries()])
  const evals = await scanMarket(settings, journal)

  // Approved first (by confidence), then blocked — the full decision log.
  const signals = [
    ...evals.flatMap((e) => e.signals).sort((a, b) => b.confidence - a.confidence),
    ...evals.flatMap((e) => e.blocked).sort((a, b) => b.confidence - a.confidence),
  ]

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Trade Plans</h1>
        <p className="text-sm text-muted-foreground">
          Every plan carries exact entry, stop, targets, and the reasoning that approved or blocked it.
        </p>
      </div>
      <SignalsList signals={signals} />
    </div>
  )
}
