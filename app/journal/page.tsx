import { Trash2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { JournalForm } from '@/components/flowedge/journal-form'
import { GradeBadge, DirectionBadge } from '@/components/flowedge/badges'
import { removeJournalEntry } from '@/app/actions/journal'
import { computeExpectancy, stayOutQuality } from '@/lib/engine/expectancy'
import { SETUP_LABELS, SESSION_LABELS } from '@/lib/engine/types'
import { listJournalEntries } from '@/lib/store/journal'
import { getSettings } from '@/lib/store/settings'
import { cn } from '@/lib/utils'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Journal' }

export default async function JournalPage() {
  const [entries, settings] = await Promise.all([listJournalEntries(), getSettings()])
  const stats = computeExpectancy(entries)
  const stayOut = stayOutQuality(entries)

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Journal</h1>
        <p className="text-sm text-muted-foreground">
          Every signal logged — taken or skipped. The expectancy layer feeds this back into live scoring.
        </p>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        <Stat label="Closed trades" value={String(stats.trades)} />
        <Stat label="Win rate" value={`${(stats.winRate * 100).toFixed(0)}%`} />
        <Stat
          label="Expectancy"
          value={`${stats.expectancyR >= 0 ? '+' : ''}${stats.expectancyR.toFixed(2)}R`}
          tone={stats.expectancyR >= 0 ? 'long' : 'short'}
        />
        <Stat
          label="Total R"
          value={`${stats.totalR >= 0 ? '+' : ''}${stats.totalR.toFixed(1)}R`}
          tone={stats.totalR >= 0 ? 'long' : 'short'}
        />
        <Stat label="Max drawdown" value={`${stats.maxDrawdownR.toFixed(1)}R`} />
        <Stat
          label="Stay-out quality"
          value={stayOut.skipped > 0 ? `${(stayOut.quality * 100).toFixed(0)}%` : '—'}
          sub={stayOut.skipped > 0 ? `${stayOut.goodSkips}/${stayOut.skipped} good skips, +${stayOut.savedR.toFixed(1)}R saved` : 'no skips logged'}
        />
      </div>

      <JournalForm symbols={settings.pairWhitelist} />

      {/* Entries */}
      <Card>
        <CardContent className="p-0 sm:p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Pair</TableHead>
                <TableHead>Dir</TableHead>
                <TableHead className="hidden md:table-cell">Setup</TableHead>
                <TableHead className="hidden sm:table-cell">Session</TableHead>
                <TableHead>Grade</TableHead>
                <TableHead>Taken</TableHead>
                <TableHead className="text-right">R</TableHead>
                <TableHead className="hidden text-right sm:table-cell">Pips</TableHead>
                <TableHead className="hidden lg:table-cell">Mistakes</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground">
                    {new Date(e.createdAt).toISOString().slice(0, 10)}
                  </TableCell>
                  <TableCell className="font-medium">{e.symbol}</TableCell>
                  <TableCell><DirectionBadge direction={e.direction} blocked={!e.taken} /></TableCell>
                  <TableCell className="hidden text-xs text-muted-foreground md:table-cell">
                    {SETUP_LABELS[e.setupType]}
                  </TableCell>
                  <TableCell className="hidden text-xs text-muted-foreground sm:table-cell">
                    {SESSION_LABELS[e.sessionTag]}
                  </TableCell>
                  <TableCell><GradeBadge grade={e.grade} /></TableCell>
                  <TableCell>
                    {e.taken ? (
                      <Badge variant="secondary">taken</Badge>
                    ) : (
                      <Badge variant="muted">skipped</Badge>
                    )}
                  </TableCell>
                  <TableCell
                    className={cn(
                      'text-right font-mono tabular-nums',
                      (e.resultR ?? 0) > 0 ? 'text-long' : (e.resultR ?? 0) < 0 ? 'text-short' : 'text-muted-foreground'
                    )}
                  >
                    {typeof e.resultR === 'number' ? `${e.resultR > 0 ? '+' : ''}${e.resultR.toFixed(2)}` : '—'}
                  </TableCell>
                  <TableCell className="hidden text-right font-mono tabular-nums text-muted-foreground sm:table-cell">
                    {typeof e.resultPips === 'number' ? e.resultPips.toFixed(1) : '—'}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    <div className="flex max-w-[220px] flex-wrap gap-1">
                      {e.mistakes.map((m) => (
                        <span key={m} className="rounded bg-short/10 px-1.5 py-0.5 text-[10px] text-short">
                          {m.replace(/_/g, ' ')}
                        </span>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <form
                      action={async () => {
                        'use server'
                        await removeJournalEntry(e.id)
                      }}
                    >
                      <button className="text-muted-foreground transition-colors hover:text-destructive" aria-label="Delete entry">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </form>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'long' | 'short' }) {
  return (
    <Card>
      <CardContent className="p-3.5">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className={cn('font-mono text-lg font-semibold tabular-nums', tone === 'long' && 'text-long', tone === 'short' && 'text-short')}>
          {value}
        </div>
        {sub && <div className="text-[11px] text-muted-foreground">{sub}</div>}
      </CardContent>
    </Card>
  )
}
