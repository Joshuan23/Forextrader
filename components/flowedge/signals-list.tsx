'use client'

import { useMemo, useState } from 'react'
import { SignalCard } from './signal-card'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import type { EngineSignal } from '@/lib/engine/types'
import { cn } from '@/lib/utils'

// Client-side filterable signal list with a sticky filter bar (mobile UX).
export function SignalsList({ signals }: { signals: EngineSignal[] }) {
  const [grade, setGrade] = useState('all')
  const [direction, setDirection] = useState('all')
  const [pair, setPair] = useState('all')
  const [showBlocked, setShowBlocked] = useState(true)

  const pairs = useMemo(() => [...new Set(signals.map((s) => s.symbol))], [signals])

  const filtered = signals.filter((s) => {
    if (!showBlocked && s.status === 'blocked') return false
    if (grade !== 'all' && s.grade !== grade) return false
    if (direction !== 'all' && s.direction !== direction) return false
    if (pair !== 'all' && s.symbol !== pair) return false
    return true
  })

  const approvedCount = filtered.filter((s) => s.status === 'approved').length

  return (
    <div className="space-y-3">
      <div className="sticky top-14 z-20 -mx-3 flex flex-wrap items-center gap-2 border-b bg-background/95 px-3 py-2 backdrop-blur sm:-mx-5 sm:px-5">
        <Select value={pair} onChange={(e) => setPair(e.target.value)} className="h-8 w-auto min-w-[110px] text-xs">
          <option value="all">All pairs</option>
          {pairs.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </Select>
        <Select value={grade} onChange={(e) => setGrade(e.target.value)} className="h-8 w-auto min-w-[100px] text-xs">
          <option value="all">All grades</option>
          <option value="A">A</option>
          <option value="B">B</option>
          <option value="C">C</option>
          <option value="blocked">Blocked</option>
        </Select>
        <Select value={direction} onChange={(e) => setDirection(e.target.value)} className="h-8 w-auto min-w-[100px] text-xs">
          <option value="all">Long + short</option>
          <option value="long">Long</option>
          <option value="short">Short</option>
        </Select>
        <Button
          variant={showBlocked ? 'secondary' : 'outline'}
          size="sm"
          className="h-8 text-xs"
          onClick={() => setShowBlocked(!showBlocked)}
        >
          {showBlocked ? 'Hiding nothing' : 'Blocked hidden'}
        </Button>
        <span className="ml-auto text-xs text-muted-foreground">
          {approvedCount} approved · {filtered.length - approvedCount} blocked
        </span>
      </div>

      {filtered.length === 0 ? (
        <div className={cn('rounded-lg border p-8 text-center text-sm text-muted-foreground')}>
          NO TRADE — nothing matches the current filters. Fewer signals, higher quality.
        </div>
      ) : (
        <div className="grid gap-3 xl:grid-cols-2">
          {filtered.map((s) => (
            <SignalCard key={s.id} signal={s} />
          ))}
        </div>
      )}
    </div>
  )
}
