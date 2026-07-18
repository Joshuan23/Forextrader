import { cn } from '@/lib/utils'
import type { GroupStats } from '@/lib/engine/expectancy'

// Server-rendered signed bar rows for expectancy groups. Sign is encoded
// three ways: bar direction from the center baseline, color, and the
// signed label — never color alone.
export function ExpectancyBars({ groups, unit = 'R' }: { groups: GroupStats[]; unit?: string }) {
  if (groups.length === 0) {
    return <p className="py-4 text-center text-sm text-muted-foreground">Not enough journal data.</p>
  }
  const maxAbs = Math.max(...groups.map((g) => Math.abs(g.expectancyR)), 0.1)

  return (
    <div className="space-y-2">
      {groups.map((g) => {
        const pct = (Math.abs(g.expectancyR) / maxAbs) * 100
        const pos = g.expectancyR >= 0
        return (
          <div key={g.key} className="flex items-center gap-2 text-xs">
            <span className="w-28 shrink-0 truncate text-muted-foreground sm:w-36" title={g.label}>
              {g.label}
            </span>
            <div className="relative h-4 flex-1">
              {/* center baseline */}
              <div className="absolute left-1/2 top-0 h-full w-px bg-border" />
              <div
                className={cn(
                  'absolute top-0.5 h-3 rounded-[3px]',
                  pos ? 'left-1/2 bg-long' : 'right-1/2 bg-short'
                )}
                style={{ width: `${pct / 2}%` }}
              />
            </div>
            <span
              className={cn(
                'w-16 shrink-0 text-right font-mono tabular-nums',
                pos ? 'text-long' : 'text-short'
              )}
            >
              {pos ? '+' : ''}
              {g.expectancyR.toFixed(2)}
              {unit}
            </span>
            <span className="w-12 shrink-0 text-right font-mono tabular-nums text-muted-foreground">
              n={g.trades}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// Single-hue magnitude bars (e.g. win rate by pair) with direct labels.
export function MagnitudeBars({
  rows,
}: {
  rows: { key: string; label: string; value: number; display: string; sub?: string }[]
}) {
  if (rows.length === 0) {
    return <p className="py-4 text-center text-sm text-muted-foreground">Not enough journal data.</p>
  }
  const max = Math.max(...rows.map((r) => r.value), 0.01)
  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <div key={r.key} className="flex items-center gap-2 text-xs">
          <span className="w-28 shrink-0 truncate text-muted-foreground sm:w-36" title={r.label}>
            {r.label}
          </span>
          <div className="h-3 flex-1 overflow-hidden rounded-[3px] bg-secondary">
            <div
              className="h-full rounded-[3px] bg-[#3d8ef5]"
              style={{ width: `${(r.value / max) * 100}%` }}
            />
          </div>
          <span className="w-14 shrink-0 text-right font-mono tabular-nums">{r.display}</span>
          {r.sub && <span className="w-12 shrink-0 text-right font-mono tabular-nums text-muted-foreground">{r.sub}</span>}
        </div>
      ))}
    </div>
  )
}
