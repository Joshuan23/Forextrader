import { SignalsList } from '@/components/flowedge/signals-list'
import { TvInbox } from '@/components/flowedge/tv-inbox'
import { scanMarket } from '@/lib/engine'
import { getSettings } from '@/lib/store/settings'
import { listJournalEntries } from '@/lib/store/journal'
import { listStoredSignals } from '@/lib/store/signals'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Signals' }

export default async function SignalsPage() {
  const [settings, journal, tvSignals] = await Promise.all([
    getSettings(),
    listJournalEntries(),
    listStoredSignals(20),
  ])
  const evals = await scanMarket(settings, journal)

  // Approved first (by confidence), then blocked — the full decision log.
  const signals = [
    ...evals.flatMap((e) => e.signals).sort((a, b) => b.confidence - a.confidence),
    ...evals.flatMap((e) => e.blocked).sort((a, b) => b.confidence - a.confidence),
  ]

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Trade Plans</h1>
        <p className="text-sm text-muted-foreground">
          Every plan carries exact entry, stop, targets, and the reasoning that approved or blocked it.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          TradingView Inbox — chart detects, FlowEdge decides
        </h2>
        <TvInbox signals={tvSignals} />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Internal Scanner
        </h2>
        <SignalsList signals={signals} />
      </section>
    </div>
  )
}
